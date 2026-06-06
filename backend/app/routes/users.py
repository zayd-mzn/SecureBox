"""
User Routes - All user management operations
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db, bcrypt
from ..models import User, Log
from datetime import datetime

user_bp = Blueprint('user', __name__)


@user_bp.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    """Get all users (admin and space_admin)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if current_user.role not in ('global_admin', 'space_admin'):
        return jsonify({'error': 'Unauthorized'}), 403
    
    users = User.query.all()
    
    return jsonify([{
        'id': u.id,
        'username': u.username,
        'email': u.email,
        'role': u.role,
        'is_active': u.is_active,
        'storage_used': u.storage_used,
        'storage_quota': u.storage_quota,
        'created_at': u.created_at.isoformat(),
        'has_avatar': u.avatar_base64 is not None
    } for u in users]), 200


@user_bp.route('/users/avatars/batch', methods=['POST'])
@jwt_required()
def get_users_avatars_batch():
    """Get avatars for multiple users in one request (admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'global_admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    user_ids = data.get('user_ids', [])
    
    if not user_ids:
        return jsonify({'avatars': {}}), 200
    
    users = User.query.filter(User.id.in_(user_ids)).all()
    
    avatars = {}
    for user in users:
        if user.avatar_base64:
            avatars[str(user.id)] = {
                'avatar': user.avatar_base64,
                'mime_type': user.avatar_mime_type,
                'username': user.username
            }
    
    return jsonify({'avatars': avatars}), 200


@user_bp.route('/users/avatars/by-username/batch', methods=['POST'])
@jwt_required()
def get_users_avatars_by_username_batch():
    """Get avatars for multiple usernames in one request (admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'global_admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    usernames = data.get('usernames', [])
    
    if not usernames:
        return jsonify({'avatars': {}}), 200
    
    users = User.query.filter(User.username.in_(usernames)).all()
    
    avatars = {}
    for user in users:
        if user.avatar_base64:
            avatars[user.username] = {
                'avatar': user.avatar_base64,
                'mime_type': user.avatar_mime_type,
                'user_id': user.id
            }
    
    return jsonify({'avatars': avatars}), 200


@user_bp.route('/users/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    """Get user by ID (admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'global_admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'role': user.role,
        'is_active': user.is_active,
        'storage_used': user.storage_used,
        'storage_quota': user.storage_quota,
        'has_avatar': user.avatar_base64 is not None
    }), 200


@user_bp.route('/users/<int:user_id>/role', methods=['PUT'])
@jwt_required()
def update_user_role(user_id):
    """Update user role (admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'global_admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    new_role = data.get('role')
    
    if new_role not in ['user', 'space_admin', 'global_admin']:
        return jsonify({'error': 'Invalid role'}), 400
    
    user.role = new_role
    
    log = Log(
        user=current_user.username,
        action='PERMISSION_CHANGE',
        resource=f'User {user.username} role changed to {new_role}',
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    db.session.commit()
    
    return jsonify({'message': 'Role updated successfully'}), 200


@user_bp.route('/users/<int:user_id>/status', methods=['PUT'])
@jwt_required()
def update_user_status(user_id):
    """Activate/deactivate user (admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'global_admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    user.is_active = data.get('is_active', True)
    
    db.session.commit()
    
    return jsonify({'message': 'Status updated successfully'}), 200


@user_bp.route('/users/<int:user_id>/quota', methods=['PUT'])
@jwt_required()
def update_user_quota(user_id):
    """Update user storage quota (admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'global_admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    new_quota = data.get('quota')
    
    if not new_quota or new_quota < 0:
        return jsonify({'error': 'Invalid quota value'}), 400
    
    user.storage_quota = new_quota
    db.session.commit()
    
    return jsonify({'message': 'Quota updated successfully'}), 200


@user_bp.route('/users', methods=['POST'])
@jwt_required()
def create_user():
    """Create new user (admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'global_admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    
    if User.query.filter_by(username=data.get('username')).first():
        return jsonify({'error': 'Username already exists'}), 400
    
    if User.query.filter_by(email=data.get('email')).first():
        return jsonify({'error': 'Email already exists'}), 400
    
    new_user = User(
        username=data.get('username'),
        email=data.get('email'),
        role=data.get('role', 'user'),
        is_active=True,
        storage_quota=data.get('storage_quota', 5368709120),
        storage_used=0
    )
    new_user.password_hash = bcrypt.generate_password_hash(data.get('password', 'password123')).decode('utf-8')
    
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify({
        'message': 'User created successfully',
        'user': {
            'id': new_user.id,
            'username': new_user.username,
            'email': new_user.email,
            'role': new_user.role
        }
    }), 201


@user_bp.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    """Delete user (admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'global_admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    if user_id == current_user_id:
        return jsonify({'error': 'Cannot delete your own account'}), 400
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    db.session.delete(user)
    db.session.commit()
    
    return jsonify({'message': 'User deleted successfully'}), 200


@user_bp.route('/users/search', methods=['GET'])
@jwt_required()
def search_users():
    """Search users by query (admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'global_admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    query = request.args.get('q', '').lower()
    role_filter = request.args.get('role', 'all')
    status_filter = request.args.get('status', 'all')
    sort_by = request.args.get('sort_by', 'name_asc')
    
    users = User.query.all()
    
    if query:
        users = [u for u in users if query in u.username.lower() or query in u.email.lower()]
    
    if role_filter != 'all':
        users = [u for u in users if u.role == role_filter]
    
    if status_filter != 'all':
        is_active = status_filter == 'active'
        users = [u for u in users if u.is_active == is_active]
    
    if sort_by == 'name_asc':
        users.sort(key=lambda x: x.username)
    elif sort_by == 'name_desc':
        users.sort(key=lambda x: x.username, reverse=True)
    elif sort_by == 'email_asc':
        users.sort(key=lambda x: x.email)
    elif sort_by == 'email_desc':
        users.sort(key=lambda x: x.email, reverse=True)
    elif sort_by == 'date_asc':
        users.sort(key=lambda x: x.created_at)
    elif sort_by == 'date_desc':
        users.sort(key=lambda x: x.created_at, reverse=True)
    
    return jsonify([{
        'id': u.id,
        'username': u.username,
        'email': u.email,
        'role': u.role,
        'is_active': u.is_active,
        'storage_used': u.storage_used,
        'storage_quota': u.storage_quota,
        'created_at': u.created_at.isoformat()
    } for u in users]), 200