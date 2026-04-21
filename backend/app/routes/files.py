"""
File Routes - Handle file operations (upload, download, delete, lock, share)
"""

from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import File, User, ACL, Log, DeletedFile
from datetime import datetime
import os
import uuid
import hashlib
from werkzeug.utils import secure_filename

files_bp = Blueprint('files', __name__)

# Configure upload folder
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@files_bp.route('/files', methods=['GET'])
@jwt_required()
def get_files():
    """Get all files owned by current user"""
    user_id = int(get_jwt_identity())
    
    files = File.query.filter_by(owner_id=user_id, is_deleted=False).all()
    
    return jsonify([{
        'id': f.id,
        'filename': f.original_filename,
        'file_type': f.file_type,
        'file_size': f.size,
        'upload_date': f.created_at.isoformat(),
        'is_shared': f.is_shared
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
        'version': file.version
    }), 200


@files_bp.route('/files/upload', methods=['POST'])
@jwt_required()
def upload_file():
    """Upload a new file"""
    user_id = int(get_jwt_identity())
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Get user and check quota
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Secure filename and generate unique name
    original_filename = secure_filename(file.filename)
    unique_filename = f"{uuid.uuid4().hex}_{original_filename}"
    
    # Determine file type
    ext = original_filename.split('.')[-1].lower() if '.' in original_filename else 'unknown'
    file_type_map = {
        'document': ['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx', 'odt'],
        'image': ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'],
        'video': ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'],
        'audio': ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'],
        'archive': ['zip', 'rar', '7z', 'tar', 'gz', 'bz2']
    }
    
    file_type = 'other'
    for ftype, extensions in file_type_map.items():
        if ext in extensions:
            file_type = ftype
            break
    
    # Save file
    file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
    file.save(file_path)
    
    # Calculate file size and checksum
    file_size = os.path.getsize(file_path)
    
    # Check quota
    if user.storage_used + file_size > user.storage_quota:
        os.remove(file_path)
        return jsonify({'error': 'Storage quota exceeded'}), 400
    
    # Calculate checksum
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    checksum = sha256_hash.hexdigest()
    
    # Get current max version for this file (if exists)
    existing_file = File.query.filter_by(original_filename=original_filename, owner_id=user_id).first()
    version = (existing_file.version + 1) if existing_file else 1
    
    # Save to database
    new_file = File(
        filename=unique_filename,
        original_filename=original_filename,
        file_path=file_path,
        file_type=file_type,
        size=file_size,
        owner_id=user_id,
        is_shared=False,
        is_deleted=False,
        is_locked=False,
        version=version,
        checksum=checksum
    )
    
    db.session.add(new_file)
    
    # Update user storage
    user.storage_used += file_size
    
    # Log activity
    log = Log(
        user=user.username,
        action='FILE_UPLOAD',
        resource=original_filename,
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    
    db.session.commit()
    
    return jsonify({
        'message': 'File uploaded successfully',
        'file_id': new_file.id,
        'filename': original_filename,
        'file_type': file_type,
        'size': file_size
    }), 201


@files_bp.route('/files/download/<int:file_id>', methods=['GET'])
@jwt_required()
def download_file(file_id):
    """Download a file"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    file = File.query.filter_by(id=file_id, is_deleted=False).first()
    
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    # Check permissions (owner or shared with read access)
    has_access = False
    if file.owner_id == user_id:
        has_access = True
    else:
        acl = ACL.query.filter_by(file_id=file_id, user_id=user_id, can_read=True).first()
        if acl:
            has_access = True
    
    if not has_access and user.role != 'global_admin':
        return jsonify({'error': 'Access denied'}), 403
    
    # Log download
    log = Log(
        user=user.username,
        action='FILE_DOWNLOAD',
        resource=file.original_filename,
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    db.session.commit()
    
    return send_file(
        file.file_path,
        as_attachment=True,
        download_name=file.original_filename
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
    
    # Soft delete
    file.is_deleted = True
    
    # Add to deleted files table
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
    
    # Update user storage
    user.storage_used -= file.size
    
    # Log deletion
    log = Log(
        user=user.username,
        action='FILE_DELETE',
        resource=file.original_filename,
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    
    db.session.commit()
    
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
    
    # Restore file
    file.is_deleted = False
    
    # Remove from deleted files
    DeletedFile.query.filter_by(original_id=file_id).delete()
    
    # Update user storage
    user.storage_used += file.size
    
    # Log restore
    log = Log(
        user=user.username,
        action='FILE_RESTORE',
        resource=file.original_filename,
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    
    db.session.commit()
    
    return jsonify({'message': 'File restored successfully'}), 200


@files_bp.route('/files/<int:file_id>/permanent', methods=['DELETE'])
@jwt_required()
def permanent_delete(file_id):
    """Permanently delete a file"""
    user_id = int(get_jwt_identity())
    
    file = File.query.filter_by(id=file_id, owner_id=user_id, is_deleted=True).first()
    
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    # Delete physical file
    if os.path.exists(file.file_path):
        os.remove(file.file_path)
    
    # Remove from deleted files
    DeletedFile.query.filter_by(original_id=file_id).delete()
    
    # Delete from database
    db.session.delete(file)
    
    db.session.commit()
    
    return jsonify({'message': 'File permanently deleted'}), 200


@files_bp.route('/files/recycle-bin', methods=['GET'])
@jwt_required()
def get_recycle_bin():
    """Get all deleted files for current user"""
    user_id = int(get_jwt_identity())
    
    deleted_files = DeletedFile.query.filter_by(owner_id=user_id).all()
    
    return jsonify([{
        'id': df.id,
        'filename': df.original_filename,
        'size': df.size,
        'deleted_date': df.deleted_date.isoformat(),
        'permanent_delete_days': df.permanent_delete_days
    } for df in deleted_files]), 200


@files_bp.route('/files/recycle-bin/empty', methods=['DELETE'])
@jwt_required()
def empty_recycle_bin():
    """Empty recycle bin for current user"""
    user_id = int(get_jwt_identity())
    
    deleted_files = DeletedFile.query.filter_by(owner_id=user_id).all()
    
    for df in deleted_files:
        file = File.query.get(df.original_id)
        if file:
            if os.path.exists(file.file_path):
                os.remove(file.file_path)
            db.session.delete(file)
        db.session.delete(df)
    
    db.session.commit()
    
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


@files_bp.route('/files/<int:file_id>/lock', methods=['POST'])
@jwt_required()
def lock_file(file_id):
    """Lock a file for editing (pessimistic locking)"""
    user_id = int(get_jwt_identity())
    
    file = File.query.filter_by(id=file_id, owner_id=user_id, is_deleted=False).first()
    
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    if file.is_locked:
        return jsonify({'error': f'File is already locked by another user'}), 409
    
    file.is_locked = True
    file.locked_by = user_id
    file.locked_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({'message': 'File locked successfully'}), 200


@files_bp.route('/files/<int:file_id>/unlock', methods=['POST'])
@jwt_required()
def unlock_file(file_id):
    """Unlock a file"""
    user_id = int(get_jwt_identity())
    
    file = File.query.filter_by(id=file_id, owner_id=user_id, is_deleted=False).first()
    
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    file.is_locked = False
    file.locked_by = None
    file.locked_at = None
    
    db.session.commit()
    
    return jsonify({'message': 'File unlocked successfully'}), 200


@files_bp.route('/files/search', methods=['GET'])
@jwt_required()
def search_files():
    """Search files by query"""
    user_id = int(get_jwt_identity())
    query = request.args.get('q', '').lower()
    file_type = request.args.get('file_type', 'all')
    sort_by = request.args.get('sort_by', 'relevance')
    
    files = File.query.filter_by(owner_id=user_id, is_deleted=False).all()
    
    # Filter by search query
    if query:
        files = [f for f in files if query in f.original_filename.lower()]
    
    # Filter by file type
    if file_type != 'all':
        files = [f for f in files if f.file_type == file_type]
    
    # Sort results
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