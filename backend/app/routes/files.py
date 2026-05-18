"""
File Routes - Handle file operations (upload, download, delete, lock, share, versions, folders)
"""

from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import File, User, ACL, Log, DeletedFile, FileVersion, Folder
from datetime import datetime
import os
import uuid
import hashlib
import io
from werkzeug.utils import secure_filename
from .notifications import create_notification
from cryptography.fernet import Fernet
import bcrypt

files_bp = Blueprint('files', __name__)

# Configure upload folder
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# Encryption helper functions
def generate_encryption_key():
    """Generate a new encryption key"""
    return Fernet.generate_key().decode('utf-8')


def encrypt_file_data(data, key):
    """Encrypt file data"""
    fernet = Fernet(key.encode())
    return fernet.encrypt(data)


def decrypt_file_data(encrypted_data, key):
    """Decrypt file data"""
    fernet = Fernet(key.encode())
    return fernet.decrypt(encrypted_data)


def hash_file_password(password):
    """Hash a file password"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_file_password(hashed_password, password):
    """Verify file password"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))


def get_file_type(filename):
    """Detect file type based on extension"""
    ext = filename.split('.')[-1].lower() if '.' in filename else 'unknown'
    
    file_type_map = {
        'document': ['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'rtf', 'md'],
        'image': ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff'],
        'video': ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg'],
        'audio': ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma'],
        'archive': ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'],
        'code': ['js', 'py', 'java', 'cpp', 'c', 'html', 'css', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'ts', 'jsx', 'tsx', 'json', 'xml', 'yaml', 'yml', 'sh', 'sql', 'dockerfile'],
        'spreadsheet': ['xls', 'xlsx', 'csv', 'ods'],
        'presentation': ['ppt', 'pptx', 'odp', 'key'],
        'pdf': ['pdf']
    }
    
    for ftype, extensions in file_type_map.items():
        if ext in extensions:
            return ftype
    return 'other'


# ==================== FOLDER ROUTES ====================

@files_bp.route('/folders', methods=['GET'])
@jwt_required()
def get_folders():
    """Get all folders for current user"""
    user_id = int(get_jwt_identity())
    parent_id = request.args.get('parent_id', type=int)
    
    query = Folder.query.filter_by(owner_id=user_id, is_deleted=False)
    if parent_id:
        query = query.filter_by(parent_id=parent_id)
    else:
        query = query.filter_by(parent_id=None)
    
    folders = query.all()
    
    return jsonify([{
        'id': f.id,
        'name': f.name,
        'parent_id': f.parent_id,
        'created_at': f.created_at.isoformat(),
        'file_count': File.query.filter_by(folder_id=f.id, owner_id=user_id, is_deleted=False).count()
    } for f in folders]), 200


@files_bp.route('/folders', methods=['POST'])
@jwt_required()
def create_folder():
    """Create a new folder"""
    user_id = int(get_jwt_identity())
    data = request.get_json()
    
    name = data.get('name', '').strip()
    parent_id = data.get('parent_id')
    
    if not name:
        return jsonify({'error': 'Folder name is required'}), 400
    
    # Check if parent folder exists and belongs to user
    if parent_id:
        parent = Folder.query.filter_by(id=parent_id, owner_id=user_id).first()
        if not parent:
            return jsonify({'error': 'Parent folder not found'}), 404
    
    # Check for duplicate folder name in same location
    existing = Folder.query.filter_by(
        owner_id=user_id, 
        parent_id=parent_id, 
        name=name, 
        is_deleted=False
    ).first()
    
    if existing:
        return jsonify({'error': 'A folder with this name already exists'}), 409
    
    new_folder = Folder(
        name=name,
        parent_id=parent_id,
        owner_id=user_id,
        created_at=datetime.utcnow()
    )
    
    db.session.add(new_folder)
    
    log = Log(
        user=User.query.get(user_id).username,
        action='FOLDER_CREATE',
        resource=name,
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Folder created successfully',
        'folder': {
            'id': new_folder.id,
            'name': new_folder.name,
            'parent_id': new_folder.parent_id,
            'created_at': new_folder.created_at.isoformat()
        }
    }), 201


@files_bp.route('/folders/<int:folder_id>', methods=['DELETE'])
@jwt_required()
def delete_folder(folder_id):
    """Delete a folder and all its contents"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    folder = Folder.query.filter_by(id=folder_id, owner_id=user_id, is_deleted=False).first()
    if not folder:
        return jsonify({'error': 'Folder not found'}), 404
    
    # Mark folder as deleted
    folder.is_deleted = True
    
    # Move all files in folder to recycle bin
    files_in_folder = File.query.filter_by(folder_id=folder_id, owner_id=user_id, is_deleted=False).all()
    for file in files_in_folder:
        file.is_deleted = True
        
        deleted_file = DeletedFile(
            original_id=file.id,
            filename=file.filename,
            original_filename=file.original_filename,
            size=file.size,
            owner_id=user_id,
            file_type=file.file_type,
            deleted_date=datetime.utcnow(),
            permanent_delete_days=30
        )
        db.session.add(deleted_file)
        
        user.storage_used -= file.size
    
    log = Log(
        user=user.username,
        action='FOLDER_DELETE',
        resource=folder.name,
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    
    db.session.commit()
    
    return jsonify({'message': 'Folder and its contents deleted successfully'}), 200


# ==================== FILE ROUTES ====================

@files_bp.route('/files', methods=['GET'])
@jwt_required()
def get_files():
    """Get all files owned by current user (optionally filtered by folder)"""
    user_id = int(get_jwt_identity())
    folder_id = request.args.get('folder_id', type=int)
    
    query = File.query.filter_by(owner_id=user_id, is_deleted=False)
    
    if folder_id:
        # Check if folder belongs to user
        folder = Folder.query.filter_by(id=folder_id, owner_id=user_id).first()
        if not folder:
            return jsonify({'error': 'Folder not found'}), 404
        query = query.filter_by(folder_id=folder_id)
    else:
        query = query.filter_by(folder_id=None)
    
    files = query.all()
    
    return jsonify([{
        'id': f.id,
        'filename': f.original_filename,
        'file_type': f.file_type,
        'file_size': f.size,
        'upload_date': f.created_at.isoformat(),
        'is_shared': f.is_shared,
        'is_encrypted': f.is_encrypted if hasattr(f, 'is_encrypted') else False,
        'folder_id': f.folder_id
    } for f in files]), 200


@files_bp.route('/files/<int:file_id>', methods=['GET'])
@jwt_required()
def get_file(file_id):
    """Get file details by ID"""
    user_id = int(get_jwt_identity())
    file = File.query.filter_by(id=file_id, owner_id=user_id, is_deleted=False).first()
    if not file:
        return jsonify({'error': 'File not found'}), 404
    owner = User.query.get(file.owner_id)
    return jsonify({
        'id': file.id,
        'filename': file.original_filename,
        'file_type': file.file_type,
        'size': file.size,
        'created_at': file.created_at.isoformat(),
        'updated_at': file.updated_at.isoformat(),
        'owner': owner.username if owner else 'Unknown',
        'is_shared': file.is_shared,
        'is_locked': file.is_locked,
        'version': file.version,
        'is_encrypted': file.is_encrypted if hasattr(file, 'is_encrypted') else False,
        'folder_id': file.folder_id
    }), 200


@files_bp.route('/files/upload', methods=['POST'])
@jwt_required()
def upload_file():
    """Upload a new file with optional encryption and folder"""
    user_id = int(get_jwt_identity())

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    original_filename = secure_filename(file.filename)
    
    # Get options from form data
    require_password = request.form.get('require_password') == 'true'
    file_password = request.form.get('file_password')
    folder_id = request.form.get('folder_id', type=int)
    
    # Check folder if specified
    if folder_id:
        folder = Folder.query.filter_by(id=folder_id, owner_id=user_id).first()
        if not folder:
            return jsonify({'error': 'Folder not found'}), 404
    
    # Validate password if required
    if require_password and (not file_password or len(file_password) < 4):
        return jsonify({'error': 'Password is required and must be at least 4 characters'}), 400
    
    # Read file data
    file_data = file.read()
    file_size = len(file_data)
    
    # Check storage quota
    if user.storage_used + file_size > user.storage_quota:
        return jsonify({'error': 'Storage quota exceeded'}), 400
    
    # Handle encryption if password is set
    encryption_key = None
    file_password_hash = None
    final_file_data = file_data
    is_encrypted = False
    
    if require_password and file_password:
        encryption_key = generate_encryption_key()
        final_file_data = encrypt_file_data(file_data, encryption_key)
        file_password_hash = hash_file_password(file_password)
        is_encrypted = True
    
    # Generate unique filename
    unique_filename = f"{uuid.uuid4().hex}_{original_filename}"
    file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
    
    # Save encrypted or plain file
    with open(file_path, 'wb') as f:
        f.write(final_file_data)
    
    # Detect file type
    file_type = get_file_type(original_filename)
    
    # Check for storage warning
    storage_percentage = ((user.storage_used + file_size) / user.storage_quota) * 100
    if storage_percentage >= 90:
        create_notification(
            user_id=user_id,
            title="⚠️ Storage Almost Full",
            message=f"You have used {storage_percentage:.1f}% of your storage quota. Consider cleaning up old files or upgrading your plan.",
            notification_type="warning"
        )
    elif storage_percentage >= 75:
        create_notification(
            user_id=user_id,
            title="📊 Storage Warning",
            message=f"You have used {storage_percentage:.1f}% of your storage quota.",
            notification_type="info"
        )
    
    # Calculate checksum
    sha256_hash = hashlib.sha256()
    sha256_hash.update(file_data)
    checksum = sha256_hash.hexdigest()
    
    existing_file = File.query.filter_by(original_filename=original_filename, owner_id=user_id).first()
    version = (existing_file.version + 1) if existing_file else 1
    
    new_file = File(
        filename=unique_filename,
        original_filename=original_filename,
        file_path=file_path,
        file_type=file_type,
        size=file_size,
        owner_id=user_id,
        folder_id=folder_id,
        is_shared=False,
        is_deleted=False,
        is_locked=False,
        version=version,
        checksum=checksum,
        is_encrypted=is_encrypted,
        file_password_hash=file_password_hash,
        encryption_key=encryption_key
    )
    db.session.add(new_file)
    db.session.flush()
    
    # Save version record
    file_version = FileVersion(
        file_id=new_file.id,
        version_number=version,
        filename=unique_filename,
        file_path=file_path,
        size=file_size,
        checksum=checksum,
        author_id=user_id,
        comment=request.form.get('comment', f'Version {version}')
    )
    db.session.add(file_version)
    
    user.storage_used += file_size
    
    log = Log(
        user=user.username,
        action='FILE_UPLOAD',
        resource=original_filename,
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    db.session.commit()
    
    # Success notification
    create_notification(
        user_id=user_id,
        title="✅ File Upload Successful",
        message=f"Your file '{original_filename}' has been uploaded successfully. Size: {file_size / 1024:.2f} KB" + (f" [Password Protected]" if is_encrypted else ""),
        notification_type="success",
        resource_type="file",
        resource_id=new_file.id
    )
    
    return jsonify({
        'message': 'File uploaded successfully',
        'file_id': new_file.id,
        'filename': original_filename,
        'file_type': file_type,
        'size': file_size,
        'version': version,
        'is_encrypted': is_encrypted
    }), 201


# ==================== FILE OPERATIONS (RENAME, MOVE, SHARE) ====================

@files_bp.route('/files/<int:file_id>/rename', methods=['PUT'])
@jwt_required()
def rename_file(file_id):
    """Rename a file"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    data = request.get_json()
    
    new_filename = data.get('filename', '').strip()
    
    if not new_filename:
        return jsonify({'error': 'New filename is required'}), 400
    
    file = File.query.filter_by(id=file_id, owner_id=user_id, is_deleted=False).first()
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    old_filename = file.original_filename
    file.original_filename = new_filename
    
    log = Log(
        user=user.username,
        action='FILE_RENAME',
        resource=f'{old_filename} -> {new_filename}',
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    
    db.session.commit()
    
    return jsonify({'message': 'File renamed successfully'}), 200


@files_bp.route('/files/<int:file_id>/move', methods=['PUT'])
@jwt_required()
def move_file(file_id):
    """Move a file to a different folder"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    data = request.get_json()
    
    folder_id = data.get('folder_id')
    
    file = File.query.filter_by(id=file_id, owner_id=user_id, is_deleted=False).first()
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    # Check destination folder
    if folder_id:
        folder = Folder.query.filter_by(id=folder_id, owner_id=user_id).first()
        if not folder:
            return jsonify({'error': 'Destination folder not found'}), 404
    
    old_folder_id = file.folder_id
    file.folder_id = folder_id
    
    log = Log(
        user=user.username,
        action='FILE_MOVE',
        resource=f'File {file.original_filename} moved from folder {old_folder_id} to {folder_id}',
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    
    db.session.commit()
    
    return jsonify({'message': 'File moved successfully'}), 200


@files_bp.route('/files/<int:file_id>/share', methods=['POST'])
@jwt_required()
def share_file(file_id):
    """Share a file with another user"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    data = request.get_json()
    
    email = data.get('email', '').strip()
    permissions = data.get('permissions', {})
    
    if not email:
        return jsonify({'error': 'Email address is required'}), 400
    
    # Find target user
    target_user = User.query.filter_by(email=email).first()
    if not target_user:
        return jsonify({'error': 'User not found with this email'}), 404
    
    file = File.query.filter_by(id=file_id, owner_id=user_id, is_deleted=False).first()
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    # Check if ACL already exists
    existing_acl = ACL.query.filter_by(file_id=file_id, user_id=target_user.id).first()
    if existing_acl:
        return jsonify({'error': 'File already shared with this user'}), 409
    
    # Create ACL
    new_acl = ACL(
        file_id=file_id,
        user_id=target_user.id,
        can_read=permissions.get('read', True),
        can_write=permissions.get('write', False),
        can_delete=permissions.get('delete', False),
        can_share=False,
        granted_by=user_id,
        granted_at=datetime.utcnow()
    )
    db.session.add(new_acl)
    
    # Update file is_shared flag
    file.is_shared = True
    
    # Create notification for target user
    create_notification(
        user_id=target_user.id,
        title="📁 File Shared With You",
        message=f"{user.username} shared '{file.original_filename}' with you.",
        notification_type="info",
        resource_type="file",
        resource_id=file_id
    )
    
    log = Log(
        user=user.username,
        action='FILE_SHARE',
        resource=f'{file.original_filename} shared with {target_user.username}',
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    
    db.session.commit()
    
    return jsonify({
        'message': f'File shared successfully with {target_user.username}',
        'shared_with': target_user.username,
        'permissions': permissions
    }), 200


@files_bp.route('/files/<int:file_id>/unshare/<int:target_user_id>', methods=['DELETE'])
@jwt_required()
def unshare_file(file_id, target_user_id):
    """Remove sharing from a user"""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    
    file = File.query.filter_by(id=file_id, owner_id=current_user_id, is_deleted=False).first()
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    acl = ACL.query.filter_by(file_id=file_id, user_id=target_user_id).first()
    if not acl:
        return jsonify({'error': 'File is not shared with this user'}), 404
    
    db.session.delete(acl)
    
    # Check if any other ACLs exist for this file
    remaining_acls = ACL.query.filter_by(file_id=file_id).first()
    if not remaining_acls:
        file.is_shared = False
    
    log = Log(
        user=user.username,
        action='FILE_UNSHARE',
        resource=f'{file.original_filename} unshared with user {target_user_id}',
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    
    db.session.commit()
    
    return jsonify({'message': 'File access revoked successfully'}), 200


@files_bp.route('/files/<int:file_id>/shared-with', methods=['GET'])
@jwt_required()
def get_shared_with(file_id):
    """Get list of users the file is shared with"""
    current_user_id = int(get_jwt_identity())
    
    file = File.query.filter_by(id=file_id, owner_id=current_user_id, is_deleted=False).first()
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    acls = ACL.query.filter_by(file_id=file_id).all()
    
    return jsonify([{
        'user_id': a.user_id,
        'username': User.query.get(a.user_id).username,
        'email': User.query.get(a.user_id).email,
        'permissions': {
            'read': a.can_read,
            'write': a.can_write,
            'delete': a.can_delete,
            'share': a.can_share
        },
        'shared_at': a.granted_at.isoformat()
    } for a in acls if a.user_id != current_user_id]), 200


# ==================== DOWNLOAD, DELETE, RESTORE ====================

@files_bp.route('/files/download/<int:file_id>', methods=['GET', 'POST'])
@jwt_required()
def download_file(file_id):
    """Download a file with optional password verification"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    # Handle POST for password-protected files
    file_password = None
    if request.method == 'POST':
        data = request.get_json() or {}
        file_password = data.get('password')
    
    file = File.query.filter_by(id=file_id, is_deleted=False).first()
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    has_access = False
    if file.owner_id == user_id:
        has_access = True
    else:
        acl = ACL.query.filter_by(file_id=file_id, user_id=user_id, can_read=True).first()
        if acl:
            has_access = True
    
    if not has_access and user.role != 'global_admin':
        return jsonify({'error': 'Access denied'}), 403
    
    # Check if file is password protected
    if hasattr(file, 'is_encrypted') and file.is_encrypted and file.file_password_hash:
        if not file_password:
            return jsonify({'error': 'Password required', 'requires_password': True}), 402
        if not verify_file_password(file.file_password_hash, file_password):
            return jsonify({'error': 'Invalid password'}), 401
    
    # Read file data
    with open(file.file_path, 'rb') as f:
        file_data = f.read()
    
    # Decrypt if necessary
    if hasattr(file, 'is_encrypted') and file.is_encrypted and file.encryption_key:
        try:
            file_data = decrypt_file_data(file_data, file.encryption_key)
        except Exception as e:
            return jsonify({'error': 'Failed to decrypt file'}), 500
    
    log = Log(
        user=user.username,
        action='FILE_DOWNLOAD',
        resource=file.original_filename,
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    db.session.commit()
    
    # Download notification for large files (>10MB)
    if file.size > 10485760:
        create_notification(
            user_id=user_id,
            title="📥 Large File Downloaded",
            message=f"Large file '{file.original_filename}' ({file.size / 1048576:.2f} MB) was downloaded.",
            notification_type="info",
            resource_type="file",
            resource_id=file_id
        )
    
    return send_file(
        io.BytesIO(file_data),
        as_attachment=True,
        download_name=file.original_filename,
        mimetype='application/octet-stream'
    )


@files_bp.route('/files/<int:file_id>', methods=['DELETE'])
@jwt_required()
def delete_file(file_id):
    """Soft delete a file (move to recycle bin)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    file = File.query.filter_by(id=file_id, owner_id=user_id, is_deleted=False).first()
    if not file:
        return jsonify({'error': 'File not found'}), 404

    file.is_deleted = True

    deleted_file = DeletedFile(
        original_id=file.id,
        filename=file.filename,
        original_filename=file.original_filename,
        size=file.size,
        owner_id=user_id,
        file_type=file.file_type,
        deleted_date=datetime.utcnow(),
        permanent_delete_days=30
    )
    db.session.add(deleted_file)
    user.storage_used -= file.size

    log = Log(
        user=user.username,
        action='FILE_DELETE',
        resource=file.original_filename,
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    db.session.commit()

    # Deletion notification
    create_notification(
        user_id=user_id,
        title="🗑️ File Deleted",
        message=f"Your file '{file.original_filename}' has been moved to recycle bin. It will be permanently deleted after 30 days.",
        notification_type="warning",
        resource_type="file",
        resource_id=file_id
    )

    return jsonify({'message': 'File moved to recycle bin'}), 200


@files_bp.route('/files/<int:file_id>/restore', methods=['POST'])
@jwt_required()
def restore_file(file_id):
    """Restore a file from recycle bin"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    file = File.query.filter_by(id=file_id, owner_id=user_id, is_deleted=True).first()
    if not file:
        return jsonify({'error': 'File not found'}), 404

    file.is_deleted = False
    DeletedFile.query.filter_by(original_id=file_id).delete()
    user.storage_used += file.size

    log = Log(
        user=user.username,
        action='FILE_RESTORE',
        resource=file.original_filename,
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    db.session.commit()

    # Restore notification
    create_notification(
        user_id=user_id,
        title="🔄 File Restored",
        message=f"Your file '{file.original_filename}' has been restored from recycle bin.",
        notification_type="success",
        resource_type="file",
        resource_id=file_id
    )

    return jsonify({'message': 'File restored successfully'}), 200


@files_bp.route('/files/<int:file_id>/permanent', methods=['DELETE'])
@jwt_required()
def permanent_delete(file_id):
    """Permanently delete a file"""
    user_id = int(get_jwt_identity())
    filename = None

    file = File.query.filter_by(id=file_id, owner_id=user_id, is_deleted=True).first()
    if not file:
        return jsonify({'error': 'File not found'}), 404

    filename = file.original_filename

    if os.path.exists(file.file_path):
        os.remove(file.file_path)

    # Delete all versions files
    versions = FileVersion.query.filter_by(file_id=file_id).all()
    for v in versions:
        if os.path.exists(v.file_path) and v.file_path != file.file_path:
            os.remove(v.file_path)
        db.session.delete(v)

    DeletedFile.query.filter_by(original_id=file_id).delete()
    db.session.delete(file)
    db.session.commit()

    # Permanent deletion notification
    create_notification(
        user_id=user_id,
        title="⚠️ File Permanently Deleted",
        message=f"Your file '{filename}' has been permanently deleted from the system.",
        notification_type="error",
        resource_type="file",
        resource_id=file_id
    )

    return jsonify({'message': 'File permanently deleted'}), 200


@files_bp.route('/files/recycle-bin', methods=['GET'])
@jwt_required()
def get_recycle_bin():
    user_id = int(get_jwt_identity())
    deleted_files = DeletedFile.query.filter_by(owner_id=user_id).all()
    return jsonify([{
        'id': df.id,
        'original_id': df.original_id,
        'filename': df.original_filename,
        'size': df.size,
        'file_type': df.file_type,
        'deleted_date': df.deleted_date.isoformat(),
        'permanent_delete_days': df.permanent_delete_days
    } for df in deleted_files]), 200


@files_bp.route('/files/recycle-bin/empty', methods=['DELETE'])
@jwt_required()
def empty_recycle_bin():
    """Empty recycle bin for current user"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    deleted_count = 0

    deleted_files = DeletedFile.query.filter_by(owner_id=user_id).all()

    for df in deleted_files:
        file = File.query.get(df.original_id)
        if file:
            if os.path.exists(file.file_path):
                os.remove(file.file_path)
            versions = FileVersion.query.filter_by(file_id=file.id).all()
            for v in versions:
                if os.path.exists(v.file_path) and v.file_path != file.file_path:
                    os.remove(v.file_path)
                db.session.delete(v)
            db.session.delete(file)
        db.session.delete(df)
        deleted_count += 1

    db.session.commit()

    # Empty recycle bin notification
    if deleted_count > 0:
        create_notification(
            user_id=user_id,
            title="🗑️ Recycle Bin Emptied",
            message=f"You have permanently deleted {deleted_count} file(s) from recycle bin.",
            notification_type="info"
        )

    return jsonify({'message': 'Recycle bin emptied'}), 200


@files_bp.route('/files/shared-with-me', methods=['GET'])
@jwt_required()
def get_shared_with_me():
    """Get files shared with current user"""
    user_id = int(get_jwt_identity())
    acls = ACL.query.filter_by(user_id=user_id, can_read=True).all()
    shared_files = []

    for acl in acls:
        file = File.query.get(acl.file_id)
        if file and not file.is_deleted:
            owner = User.query.get(file.owner_id)
            shared_files.append({
                'id': file.id,
                'filename': file.original_filename,
                'file_type': file.file_type,
                'owner': owner.username if owner else 'Unknown',
                'size': file.size,
                'shared_at': acl.granted_at.isoformat(),
                'permissions': {
                    'read': acl.can_read,
                    'write': acl.can_write,
                    'delete': acl.can_delete,
                    'share': acl.can_share
                }
            })

    return jsonify(shared_files), 200


# ==================== VERSION HISTORY ROUTES ====================

@files_bp.route('/files/versions', methods=['GET'])
@jwt_required()
def get_all_versions():
    """Get all file versions for the current user"""
    user_id = int(get_jwt_identity())

    user_files = File.query.filter_by(owner_id=user_id, is_deleted=False).all()

    all_versions = []
    for file in user_files:
        versions = FileVersion.query.filter_by(file_id=file.id).order_by(
            FileVersion.version_number.desc()
        ).all()

        for v in versions:
            author = User.query.get(v.author_id)
            all_versions.append({
                'id': v.id,
                'file_id': file.id,
                'filename': file.original_filename,
                'file_type': file.file_type,
                'version_number': v.version_number,
                'size': v.size,
                'author': author.username if author else 'Unknown',
                'created_at': v.created_at.isoformat(),
                'comment': v.comment or f'Version {v.version_number}',
                'checksum': v.checksum,
                'is_latest': v.version_number == file.version
            })

    all_versions.sort(key=lambda x: x['created_at'], reverse=True)

    return jsonify(all_versions), 200


@files_bp.route('/files/<int:file_id>/versions', methods=['GET'])
@jwt_required()
def get_file_versions(file_id):
    """Get all versions of a specific file"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    file = File.query.filter_by(id=file_id, is_deleted=False).first()
    if not file:
        return jsonify({'error': 'File not found'}), 404

    # Check access
    has_access = file.owner_id == user_id
    if not has_access:
        acl = ACL.query.filter_by(file_id=file_id, user_id=user_id, can_read=True).first()
        has_access = acl is not None
    if not has_access and user.role != 'global_admin':
        return jsonify({'error': 'Access denied'}), 403

    versions = FileVersion.query.filter_by(file_id=file_id).order_by(
        FileVersion.version_number.desc()
    ).all()

    owner = User.query.get(file.owner_id)

    return jsonify({
        'file': {
            'id': file.id,
            'filename': file.original_filename,
            'file_type': file.file_type,
            'owner': owner.username if owner else 'Unknown',
            'current_version': file.version,
            'total_versions': len(versions)
        },
        'versions': [{
            'id': v.id,
            'version_number': v.version_number,
            'size': v.size,
            'author': User.query.get(v.author_id).username if User.query.get(v.author_id) else 'Unknown',
            'created_at': v.created_at.isoformat(),
            'comment': v.comment or f'Version {v.version_number}',
            'checksum': v.checksum,
            'is_latest': v.version_number == file.version
        } for v in versions]
    }), 200


@files_bp.route('/files/<int:file_id>/versions/<int:version_id>/download', methods=['GET'])
@jwt_required()
def download_version(file_id, version_id):
    """Download a specific version of a file"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    file = File.query.filter_by(id=file_id, is_deleted=False).first()
    if not file:
        return jsonify({'error': 'File not found'}), 404

    has_access = file.owner_id == user_id
    if not has_access:
        acl = ACL.query.filter_by(file_id=file_id, user_id=user_id, can_read=True).first()
        has_access = acl is not None
    if not has_access and user.role != 'global_admin':
        return jsonify({'error': 'Access denied'}), 403

    version = FileVersion.query.filter_by(id=version_id, file_id=file_id).first()
    if not version:
        return jsonify({'error': 'Version not found'}), 404

    download_name = f"{file.original_filename.rsplit('.', 1)[0]}_v{version.version_number}.{file.original_filename.rsplit('.', 1)[-1]}"

    return send_file(version.file_path, as_attachment=True, download_name=download_name)


@files_bp.route('/files/<int:file_id>/versions/<int:version_id>/restore', methods=['POST'])
@jwt_required()
def restore_version(file_id, version_id):
    """Restore a specific version as the current version"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    file = File.query.filter_by(id=file_id, owner_id=user_id, is_deleted=False).first()
    if not file:
        return jsonify({'error': 'File not found or access denied'}), 404

    version = FileVersion.query.filter_by(id=version_id, file_id=file_id).first()
    if not version:
        return jsonify({'error': 'Version not found'}), 404

    new_version_number = file.version + 1
    new_version = FileVersion(
        file_id=file.id,
        version_number=new_version_number,
        filename=version.filename,
        file_path=version.file_path,
        size=version.size,
        checksum=version.checksum,
        author_id=user_id,
        comment=f'Restored from version {version.version_number}'
    )
    db.session.add(new_version)

    file.version = new_version_number
    file.filename = version.filename
    file.file_path = version.file_path
    file.size = version.size
    file.checksum = version.checksum

    log = Log(
        user=user.username,
        action='FILE_RESTORE',
        resource=f'{file.original_filename} (restored to v{version.version_number})',
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    db.session.commit()

    create_notification(
        user_id=user_id,
        title="🔄 Version Restored",
        message=f"File '{file.original_filename}' has been restored to version {version.version_number}.",
        notification_type="success",
        resource_type="file",
        resource_id=file_id
    )

    return jsonify({
        'message': f'File restored to version {version.version_number}',
        'new_version': new_version_number
    }), 200


# ==================== LOCK / UNLOCK ====================
# In your files.py, update the lock and unlock functions:

@files_bp.route('/files/<int:file_id>/lock', methods=['POST'])
@jwt_required()
def lock_file(file_id):
    """Lock a file for editing (pessimistic locking)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    # Check if user has write permission (owner or ACL with write)
    file = File.query.filter_by(id=file_id, is_deleted=False).first()
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    # Check write access
    has_write_access = False
    if file.owner_id == user_id:
        has_write_access = True
    else:
        acl = ACL.query.filter_by(file_id=file_id, user_id=user_id, can_write=True).first()
        if acl:
            has_write_access = True
    
    if not has_write_access and user.role != 'global_admin':
        return jsonify({'error': 'You do not have write permission for this file'}), 403
    
    # Check if file is already locked by another user
    if file.is_locked and file.locked_by != user_id:
        locked_by_user = User.query.get(file.locked_by)
        return jsonify({
            'error': f'File is already locked by {locked_by_user.username}',
            'locked_by': locked_by_user.username,
            'locked_at': file.locked_at.isoformat() if file.locked_at else None
        }), 409
    
    # Lock the file
    file.is_locked = True
    file.locked_by = user_id
    file.locked_at = datetime.utcnow()
    
    # Log the action
    log = Log(
        user=user.username,
        action='FILE_LOCK',
        resource=file.original_filename,
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    
    db.session.commit()
    
    # Notify other users (optional - create notification for other users with access)
    # This would notify other users that the file is being edited
    if file.is_shared:
        # Get all users with access to this file
        acls = ACL.query.filter_by(file_id=file_id).all()
        for acl in acls:
            if acl.user_id != user_id:
                create_notification(
                    user_id=acl.user_id,
                    title="🔒 File Locked",
                    message=f"{user.username} is editing '{file.original_filename}'. The file is locked until they finish.",
                    notification_type="warning",
                    resource_type="file",
                    resource_id=file_id
                )
    
    return jsonify({
        'message': 'File locked successfully',
        'locked_by': user.username,
        'locked_at': file.locked_at.isoformat()
    }), 200


@files_bp.route('/files/<int:file_id>/unlock', methods=['POST'])
@jwt_required()
def unlock_file(file_id):
    """Unlock a file after editing"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    file = File.query.filter_by(id=file_id, is_deleted=False).first()
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    # Only the user who locked the file or the owner/admin can unlock
    if file.locked_by != user_id and file.owner_id != user_id and user.role != 'global_admin':
        return jsonify({'error': 'You cannot unlock this file'}), 403
    
    if not file.is_locked:
        return jsonify({'error': 'File is not locked'}), 400
    
    # Unlock the file
    file.is_locked = False
    locked_by_user = User.query.get(file.locked_by)
    file.locked_by = None
    file.locked_at = None
    
    # Log the action
    log = Log(
        user=user.username,
        action='FILE_UNLOCK',
        resource=file.original_filename,
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    
    db.session.commit()
    
    # Notify other users that the file is now available
    if file.is_shared:
        acls = ACL.query.filter_by(file_id=file_id).all()
        for acl in acls:
            if acl.user_id != user_id:
                create_notification(
                    user_id=acl.user_id,
                    title="🔓 File Unlocked",
                    message=f"'{file.original_filename}' has been unlocked and is now available for editing.",
                    notification_type="success",
                    resource_type="file",
                    resource_id=file_id
                )
    
    return jsonify({
        'message': 'File unlocked successfully',
        'unlocked_by': user.username
    }), 200


@files_bp.route('/files/<int:file_id>/lock-status', methods=['GET'])
@jwt_required()
def get_lock_status(file_id):
    """Get lock status of a file"""
    file = File.query.get(file_id)
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    if file.is_locked and file.locked_by:
        locked_by_user = User.query.get(file.locked_by)
        return jsonify({
            'is_locked': True,
            'locked_by': locked_by_user.username if locked_by_user else 'Unknown',
            'locked_at': file.locked_at.isoformat() if file.locked_at else None,
            'can_unlock': file.locked_by == int(get_jwt_identity())  # Add this line
        }), 200
    
    return jsonify({'is_locked': False}), 200


@files_bp.route('/files/<int:file_id>/force-unlock', methods=['POST'])
@jwt_required()
def force_unlock_file(file_id):
    """Force unlock a file (owner or admin only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    file = File.query.filter_by(id=file_id, is_deleted=False).first()
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    # Only owner or admin can force unlock
    if file.owner_id != user_id and user.role != 'global_admin':
        return jsonify({'error': 'Only the file owner can force unlock'}), 403
    
    if not file.is_locked:
        return jsonify({'error': 'File is not locked'}), 400
    
    locked_by_user = User.query.get(file.locked_by)
    
    file.is_locked = False
    file.locked_by = None
    file.locked_at = None
    
    # Log the action
    log = Log(
        user=user.username,
        action='FILE_FORCE_UNLOCK',
        resource=file.original_filename,
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    
    db.session.commit()
    
    return jsonify({
        'message': f'File unlocked successfully (was locked by {locked_by_user.username if locked_by_user else "Unknown"})'
    }), 200


# ==================== SEARCH ====================

@files_bp.route('/files/search', methods=['GET'])
@jwt_required()
def search_files():
    user_id = int(get_jwt_identity())
    query = request.args.get('q', '').lower()
    file_type = request.args.get('file_type', 'all')
    sort_by = request.args.get('sort_by', 'relevance')

    files = File.query.filter_by(owner_id=user_id, is_deleted=False).all()

    if query:
        files = [f for f in files if query in f.original_filename.lower()]
    if file_type != 'all':
        files = [f for f in files if f.file_type == file_type]

    if sort_by == 'date_desc':
        files.sort(key=lambda x: x.created_at, reverse=True)
    elif sort_by == 'date_asc':
        files.sort(key=lambda x: x.created_at)
    elif sort_by == 'name_asc':
        files.sort(key=lambda x: x.original_filename)
    elif sort_by == 'name_desc':
        files.sort(key=lambda x: x.original_filename, reverse=True)
    elif sort_by == 'size_desc':
        files.sort(key=lambda x: x.size, reverse=True)
    elif sort_by == 'size_asc':
        files.sort(key=lambda x: x.size)

    return jsonify([{
        'id': f.id,
        'filename': f.original_filename,
        'file_type': f.file_type,
        'file_size': f.size,
        'upload_date': f.created_at.isoformat(),
        'is_shared': f.is_shared
    } for f in files]), 200