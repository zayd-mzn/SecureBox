"""
File Routes - Handle file operations (upload, download, delete, lock, share, versions)
"""

from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import File, User, ACL, Log, DeletedFile, FileVersion
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

    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    original_filename = secure_filename(file.filename)
    unique_filename = f"{uuid.uuid4().hex}_{original_filename}"

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

    file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
    file.save(file_path)
    file_size = os.path.getsize(file_path)

    if user.storage_used + file_size > user.storage_quota:
        os.remove(file_path)
        return jsonify({'error': 'Storage quota exceeded'}), 400

    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
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
        is_shared=False,
        is_deleted=False,
        is_locked=False,
        version=version,
        checksum=checksum
    )
    db.session.add(new_file)
    db.session.flush()  # get new_file.id

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

    return jsonify({
        'message': 'File uploaded successfully',
        'file_id': new_file.id,
        'filename': original_filename,
        'file_type': file_type,
        'size': file_size,
        'version': version
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

    has_access = False
    if file.owner_id == user_id:
        has_access = True
    else:
        acl = ACL.query.filter_by(file_id=file_id, user_id=user_id, can_read=True).first()
        if acl:
            has_access = True

    if not has_access and user.role != 'global_admin':
        return jsonify({'error': 'Access denied'}), 403

    log = Log(
        user=user.username,
        action='FILE_DOWNLOAD',
        resource=file.original_filename,
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    db.session.commit()

    return send_file(file.file_path, as_attachment=True, download_name=file.original_filename)


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

    return jsonify({'message': 'File restored successfully'}), 200


@files_bp.route('/files/<int:file_id>/permanent', methods=['DELETE'])
@jwt_required()
def permanent_delete(file_id):
    """Permanently delete a file"""
    user_id = int(get_jwt_identity())

    file = File.query.filter_by(id=file_id, owner_id=user_id, is_deleted=True).first()
    if not file:
        return jsonify({'error': 'File not found'}), 404

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

    return jsonify({'message': 'File permanently deleted'}), 200


@files_bp.route('/files/recycle-bin', methods=['GET'])
@jwt_required()
def get_recycle_bin():
    user_id = int(get_jwt_identity())
    deleted_files = DeletedFile.query.filter_by(owner_id=user_id).all()
    return jsonify([{
        'id': df.id,
        'original_id': df.original_id,   # ← AJOUTER CETTE LIGNE
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


# ─────────────────────────────────────────────
#  VERSION HISTORY ROUTES (nouvelles routes)
# ─────────────────────────────────────────────

@files_bp.route('/files/versions', methods=['GET'])
@jwt_required()
def get_all_versions():
    """Get all file versions for the current user"""
    user_id = int(get_jwt_identity())

    # Get all files owned by user
    user_files = File.query.filter_by(owner_id=user_id, is_deleted=False).all()
    file_ids = [f.id for f in user_files]

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

    # Sort by date desc
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

    # Create new version entry for the restored version
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

    # Update file to point to restored version
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

    return jsonify({
        'message': f'File restored to version {version.version_number}',
        'new_version': new_version_number
    }), 200


# ─────────────────────────────────────────────
#  LOCK / UNLOCK
# ─────────────────────────────────────────────

@files_bp.route('/files/<int:file_id>/lock', methods=['POST'])
@jwt_required()
def lock_file(file_id):
    user_id = int(get_jwt_identity())
    file = File.query.filter_by(id=file_id, owner_id=user_id, is_deleted=False).first()
    if not file:
        return jsonify({'error': 'File not found'}), 404
    if file.is_locked:
        return jsonify({'error': 'File is already locked by another user'}), 409
    file.is_locked = True
    file.locked_by = user_id
    file.locked_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'message': 'File locked successfully'}), 200


@files_bp.route('/files/<int:file_id>/unlock', methods=['POST'])
@jwt_required()
def unlock_file(file_id):
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