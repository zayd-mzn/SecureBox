"""
Workspace Routes - Space Admin workspace management with invitation codes
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User, File, ACL, Log, Notification
from datetime import datetime
import random
import string

workspace_bp = Blueprint('workspace', __name__)


# ─────────────────────────────────────────────
# Helper: generate a short invitation code
# ─────────────────────────────────────────────
def generate_invite_code(length=8):
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))


def log_action(user, action, resource, request, status='success'):
    entry = Log(
        user=user.username,
        action=action,
        resource=resource,
        ip_address=request.remote_addr,
        status=status
    )
    db.session.add(entry)


def notify(user_id, title, message, ntype='info', resource_type=None, resource_id=None):
    n = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=ntype,
        resource_type=resource_type,
        resource_id=resource_id,
        created_at=datetime.utcnow()
    )
    db.session.add(n)


# ─────────────────────────────────────────────
# Import the Workspace models (defined in models.py)
# ─────────────────────────────────────────────
from ..models import Workspace, WorkspaceMember


# ══════════════════════════════════════════════
#  SPACE ADMIN – Create a workspace
# ══════════════════════════════════════════════
@workspace_bp.route('/workspaces', methods=['POST'])
@jwt_required()
def create_workspace():
    user_id = int(get_jwt_identity())
    current_user = User.query.get(user_id)

    if not current_user or current_user.role not in ('space_admin', 'global_admin'):
        return jsonify({'error': 'Only Space Admins can create workspaces'}), 403

    data = request.get_json()
    name = (data.get('name') or '').strip()
    description = (data.get('description') or '').strip()

    if not name:
        return jsonify({'error': 'Workspace name is required'}), 400

    # Generate a unique invite code
    code = generate_invite_code()
    while Workspace.query.filter_by(invite_code=code).first():
        code = generate_invite_code()

    ws = Workspace(
        name=name,
        description=description,
        admin_id=user_id,
        invite_code=code,
        created_at=datetime.utcnow()
    )
    db.session.add(ws)
    db.session.flush()   # get ws.id before commit

    # Admin is automatically a member
    member = WorkspaceMember(
        workspace_id=ws.id,
        user_id=user_id,
        joined_at=datetime.utcnow()
    )
    db.session.add(member)

    log_action(current_user, 'WORKSPACE_CREATE', name, request)
    db.session.commit()

    return jsonify({
        'message': 'Workspace created successfully',
        'workspace': _ws_dict(ws, current_user)
    }), 201


# ══════════════════════════════════════════════
#  ALL USERS – Join via invite code
# ══════════════════════════════════════════════
@workspace_bp.route('/workspaces/join', methods=['POST'])
@jwt_required()
def join_workspace():
    user_id = int(get_jwt_identity())
    current_user = User.query.get(user_id)

    data = request.get_json()
    code = (data.get('invite_code') or '').strip().upper()

    if not code:
        return jsonify({'error': 'Invitation code is required'}), 400

    ws = Workspace.query.filter_by(invite_code=code, is_active=True).first()
    if not ws:
        return jsonify({'error': 'Invalid or expired invitation code'}), 404

    # Already a member?
    existing = WorkspaceMember.query.filter_by(
        workspace_id=ws.id, user_id=user_id
    ).first()
    if existing:
        return jsonify({'error': 'You are already a member of this workspace'}), 409

    member = WorkspaceMember(
        workspace_id=ws.id,
        user_id=user_id,
        joined_at=datetime.utcnow()
    )
    db.session.add(member)

    # Notify the workspace admin
    admin = User.query.get(ws.admin_id)
    notify(
        ws.admin_id,
        'New Member Joined',
        f'{current_user.username} joined your workspace "{ws.name}"',
        ntype='info',
        resource_type='workspace',
        resource_id=ws.id
    )

    # Give the new member read access on all files already in the workspace
    ws_files = File.query.filter_by(workspace_id=ws.id, is_deleted=False).all()
    for f in ws_files:
        existing_acl = ACL.query.filter_by(file_id=f.id, user_id=user_id).first()
        if not existing_acl:
            acl = ACL(
                file_id=f.id,
                user_id=user_id,
                can_read=True,
                can_write=False,
                can_delete=False,
                can_share=False,
                granted_by=ws.admin_id,
                granted_at=datetime.utcnow()
            )
            db.session.add(acl)

    log_action(current_user, 'WORKSPACE_JOIN', ws.name, request)
    db.session.commit()

    return jsonify({
        'message': f'You joined workspace "{ws.name}" successfully',
        'workspace': _ws_dict(ws, current_user)
    }), 200


# ══════════════════════════════════════════════
#  ALL USERS – List my workspaces
# ══════════════════════════════════════════════
@workspace_bp.route('/workspaces', methods=['GET'])
@jwt_required()
def list_workspaces():
    user_id = int(get_jwt_identity())
    current_user = User.query.get(user_id)

    # Workspaces where user is a member
    memberships = WorkspaceMember.query.filter_by(user_id=user_id).all()
    ws_ids = [m.workspace_id for m in memberships]
    workspaces = Workspace.query.filter(Workspace.id.in_(ws_ids)).all()

    return jsonify([_ws_dict(ws, current_user) for ws in workspaces]), 200


# ══════════════════════════════════════════════
#  Get workspace detail + members + files
# ══════════════════════════════════════════════
@workspace_bp.route('/workspaces/<int:ws_id>', methods=['GET'])
@jwt_required()
def get_workspace(ws_id):
    user_id = int(get_jwt_identity())
    current_user = User.query.get(user_id)

    ws = Workspace.query.get(ws_id)
    if not ws:
        return jsonify({'error': 'Workspace not found'}), 404

    # Check membership (global_admin can see all)
    if current_user.role != 'global_admin':
        member = WorkspaceMember.query.filter_by(
            workspace_id=ws_id, user_id=user_id
        ).first()
        if not member:
            return jsonify({'error': 'Access denied'}), 403

    # Members
    members = (
        db.session.query(User, WorkspaceMember)
        .join(WorkspaceMember, User.id == WorkspaceMember.user_id)
        .filter(WorkspaceMember.workspace_id == ws_id)
        .all()
    )
    members_list = [{
        'id': u.id,
        'username': u.username,
        'full_name': u.full_name,
        'role': u.role,
        'joined_at': wm.joined_at.isoformat()
    } for u, wm in members]

    # Files in workspace
    files = File.query.filter_by(workspace_id=ws_id, is_deleted=False).all()
    files_list = [{
        'id': f.id,
        'filename': f.original_filename,
        'size': f.size,
        'file_type': f.file_type,
        'owner': User.query.get(f.owner_id).username,
        'created_at': f.created_at.isoformat()
    } for f in files]

    data = _ws_dict(ws, current_user)
    data['members'] = members_list
    data['files'] = files_list
    return jsonify(data), 200


# ══════════════════════════════════════════════
#  SPACE ADMIN – Remove member
# ══════════════════════════════════════════════
@workspace_bp.route('/workspaces/<int:ws_id>/members/<int:member_id>', methods=['DELETE'])
@jwt_required()
def remove_member(ws_id, member_id):
    user_id = int(get_jwt_identity())
    current_user = User.query.get(user_id)

    ws = Workspace.query.get(ws_id)
    if not ws:
        return jsonify({'error': 'Workspace not found'}), 404

    if ws.admin_id != user_id and current_user.role != 'global_admin':
        return jsonify({'error': 'Only the workspace admin can remove members'}), 403

    if member_id == ws.admin_id:
        return jsonify({'error': 'Cannot remove the workspace admin'}), 400

    membership = WorkspaceMember.query.filter_by(
        workspace_id=ws_id, user_id=member_id
    ).first()
    if not membership:
        return jsonify({'error': 'Member not found in this workspace'}), 404

    db.session.delete(membership)

    # Remove their ACLs on workspace files
    ws_files = File.query.filter_by(workspace_id=ws_id).all()
    for f in ws_files:
        ACL.query.filter_by(file_id=f.id, user_id=member_id).delete()

    removed_user = User.query.get(member_id)
    log_action(current_user, 'WORKSPACE_REMOVE_MEMBER',
               f'{removed_user.username} from {ws.name}', request)
    db.session.commit()

    return jsonify({'message': 'Member removed successfully'}), 200


# ══════════════════════════════════════════════
#  SPACE ADMIN – Regenerate invite code
# ══════════════════════════════════════════════
@workspace_bp.route('/workspaces/<int:ws_id>/regenerate-code', methods=['POST'])
@jwt_required()
def regenerate_code(ws_id):
    user_id = int(get_jwt_identity())
    current_user = User.query.get(user_id)

    ws = Workspace.query.get(ws_id)
    if not ws:
        return jsonify({'error': 'Workspace not found'}), 404

    if ws.admin_id != user_id and current_user.role != 'global_admin':
        return jsonify({'error': 'Only the workspace admin can regenerate the code'}), 403

    new_code = generate_invite_code()
    while Workspace.query.filter_by(invite_code=new_code).first():
        new_code = generate_invite_code()

    ws.invite_code = new_code
    log_action(current_user, 'WORKSPACE_REGEN_CODE', ws.name, request)
    db.session.commit()

    return jsonify({'invite_code': new_code}), 200


# ══════════════════════════════════════════════
#  SPACE ADMIN – Delete workspace
# ══════════════════════════════════════════════
@workspace_bp.route('/workspaces/<int:ws_id>', methods=['DELETE'])
@jwt_required()
def delete_workspace(ws_id):
    user_id = int(get_jwt_identity())
    current_user = User.query.get(user_id)

    ws = Workspace.query.get(ws_id)
    if not ws:
        return jsonify({'error': 'Workspace not found'}), 404

    if ws.admin_id != user_id and current_user.role != 'global_admin':
        return jsonify({'error': 'Only the workspace admin can delete a workspace'}), 403

    # Remove ACLs on workspace files
    ws_files = File.query.filter_by(workspace_id=ws_id).all()
    for f in ws_files:
        ACL.query.filter_by(file_id=f.id).delete()
        f.workspace_id = None   # detach files from workspace but keep them

    # Remove all memberships
    WorkspaceMember.query.filter_by(workspace_id=ws_id).delete()

    log_action(current_user, 'WORKSPACE_DELETE', ws.name, request)
    db.session.delete(ws)
    db.session.commit()

    return jsonify({'message': 'Workspace deleted successfully'}), 200


# ══════════════════════════════════════════════
#  SPACE ADMIN – Upload file into workspace
#  (delegates to the existing /api/files/upload, just sets workspace_id)
# ══════════════════════════════════════════════
@workspace_bp.route('/workspaces/<int:ws_id>/files', methods=['POST'])
@jwt_required()
def upload_workspace_file(ws_id):
    """Upload a file directly into a workspace and auto-grant read ACL to all members."""
    from flask import request as req
    import os, uuid, hashlib
    from werkzeug.utils import secure_filename
    from .files import validate_mime_type

    user_id = int(get_jwt_identity())
    current_user = User.query.get(user_id)

    ws = Workspace.query.get(ws_id)
    if not ws:
        return jsonify({'error': 'Workspace not found'}), 404

    # Only admin can upload to workspace
    if ws.admin_id != user_id and current_user.role != 'global_admin':
        return jsonify({'error': 'Only the workspace admin can upload files'}), 403

    if 'file' not in req.files:
        return jsonify({'error': 'No file provided'}), 400

    file = req.files['file']
    if not file.filename:
        return jsonify({'error': 'No file selected'}), 400

    # Use same upload folder as files.py
    UPLOAD_FOLDER = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'uploads'
    )
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    original_filename = file.filename
    safe_name = secure_filename(original_filename)
    unique_name = f"{uuid.uuid4().hex}_{safe_name}"
    file_path = os.path.join(UPLOAD_FOLDER, unique_name)

    file_data = file.read()
    checksum = hashlib.sha256(file_data).hexdigest()

    # Validate actual MIME type
    mime_valid, detected_mime = validate_mime_type(file_data, original_filename)
    if not mime_valid:
        return jsonify({'error': f'File type not allowed (detected: {detected_mime})'}), 400

    # Check quota
    if current_user.storage_used + len(file_data) > current_user.storage_quota:
        return jsonify({'error': 'Storage quota exceeded'}), 413

    with open(file_path, 'wb') as f:
        f.write(file_data)

    # Detect file type
    ext = original_filename.rsplit('.', 1)[-1].lower() if '.' in original_filename else 'unknown'
    file_type_map = {
        'document': ['pdf', 'doc', 'docx', 'txt', 'odt', 'rtf', 'md'],
        'image': ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'],
        'video': ['mp4', 'avi', 'mov', 'mkv', 'webm'],
        'audio': ['mp3', 'wav', 'ogg', 'm4a', 'flac'],
        'archive': ['zip', 'rar', '7z', 'tar', 'gz'],
        'code': ['js', 'py', 'java', 'cpp', 'c', 'html', 'css', 'php', 'ts', 'json', 'xml', 'sh', 'sql'],
        'spreadsheet': ['xls', 'xlsx', 'csv'],
        'presentation': ['ppt', 'pptx']
    }
    file_type = 'other'
    for ft, exts in file_type_map.items():
        if ext in exts:
            file_type = ft
            break

    new_file = File(
        filename=unique_name,
        original_filename=original_filename,
        file_path=file_path,
        file_type=file_type,
        size=len(file_data),
        owner_id=user_id,
        workspace_id=ws_id,
        checksum=checksum,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.session.add(new_file)
    db.session.flush()

    # Update quota
    current_user.storage_used += len(file_data)

    # Auto-grant read ACL to all workspace members (except admin who already owns it)
    members = WorkspaceMember.query.filter_by(workspace_id=ws_id).all()
    for m in members:
        if m.user_id == user_id:
            continue
        acl = ACL(
            file_id=new_file.id,
            user_id=m.user_id,
            can_read=True,
            can_write=False,
            can_delete=False,
            can_share=False,
            granted_by=user_id,
            granted_at=datetime.utcnow()
        )
        db.session.add(acl)
        notify(
            m.user_id,
            'New file in workspace',
            f'{current_user.username} uploaded "{original_filename}" to workspace "{ws.name}"',
            ntype='info',
            resource_type='file',
            resource_id=new_file.id
        )

    log_action(current_user, 'WORKSPACE_FILE_UPLOAD', original_filename, req)
    db.session.commit()

    return jsonify({
        'message': 'File uploaded to workspace successfully',
        'file': {
            'id': new_file.id,
            'filename': original_filename,
            'size': new_file.size,
            'file_type': file_type
        }
    }), 201


# ──────────────────────────────────────────────
# Serializer helper
# ──────────────────────────────────────────────
def _ws_dict(ws, current_user):
    admin = User.query.get(ws.admin_id)
    member_count = WorkspaceMember.query.filter_by(workspace_id=ws.id).count()
    file_count = File.query.filter_by(workspace_id=ws.id, is_deleted=False).count()
    is_admin = (ws.admin_id == current_user.id)

    d = {
        'id': ws.id,
        'name': ws.name,
        'description': ws.description,
        'admin_id': ws.admin_id,
        'admin_username': admin.username if admin else 'unknown',
        'member_count': member_count,
        'file_count': file_count,
        'is_active': ws.is_active,
        'created_at': ws.created_at.isoformat(),
        'is_admin': is_admin
    }
    # Only expose invite code to the workspace admin and global_admin
    if is_admin or current_user.role == 'global_admin':
        d['invite_code'] = ws.invite_code
    return d
