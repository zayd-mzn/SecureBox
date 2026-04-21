"""
Admin Routes - User management, system stats, ACL management
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db, bcrypt
from ..models import User, File, ACL, Log
from datetime import datetime
import random

admin_bp = Blueprint('admin', __name__)


@admin_bp.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    """Get all users (admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'global_admin':
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
        'created_at': u.created_at.isoformat()
    } for u in users]), 200


@admin_bp.route('/users/<int:user_id>', methods=['GET'])
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
        'storage_quota': user.storage_quota
    }), 200


@admin_bp.route('/users/<int:user_id>/role', methods=['PUT'])
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
    
    # Log action
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


@admin_bp.route('/users/<int:user_id>/status', methods=['PUT'])
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


@admin_bp.route('/users/<int:user_id>/quota', methods=['PUT'])
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


@admin_bp.route('/users', methods=['POST'])
@jwt_required()
def create_user():
    """Create new user (admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'global_admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    
    # Check if user exists
    if User.query.filter_by(username=data.get('username')).first():
        return jsonify({'error': 'Username already exists'}), 400
    
    if User.query.filter_by(email=data.get('email')).first():
        return jsonify({'error': 'Email already exists'}), 400
    
    # Create user
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


@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
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


@admin_bp.route('/users/search', methods=['GET'])
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
    
    # Filter by search query
    if query:
        users = [u for u in users if query in u.username.lower() or query in u.email.lower()]
    
    # Filter by role
    if role_filter != 'all':
        users = [u for u in users if u.role == role_filter]
    
    # Filter by status
    if status_filter != 'all':
        is_active = status_filter == 'active'
        users = [u for u in users if u.is_active == is_active]
    
    # Sort results
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


@admin_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_admin_stats():
    """Get system statistics (admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'global_admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    total_users = User.query.count()
    total_files = File.query.filter_by(is_deleted=False).count()
    total_storage = sum([f.size for f in File.query.filter_by(is_deleted=False).all()])
    active_users = User.query.filter_by(is_active=True).count()
    
    return jsonify({
        'total_users': total_users,
        'total_files': total_files,
        'total_storage': total_storage,
        'active_users': active_users
    }), 200


@admin_bp.route('/quota-settings', methods=['GET'])
@jwt_required()
def get_quota_settings():
    """Get quota settings (admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'global_admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    users = User.query.all()
    total_quota = sum([u.storage_quota for u in users])
    used_quota = sum([u.storage_used for u in users])
    
    return jsonify({
        'global_admin': 28,
        'space_admin': 45,
        'user': 62,
        'total_quota': total_quota,
        'used_quota': used_quota,
        'available_quota': total_quota - used_quota,
        'average_usage': (used_quota / total_quota * 100) if total_quota > 0 else 0
    }), 200


@admin_bp.route('/quota-stats', methods=['GET'])
@jwt_required()
def get_quota_stats():
    """Get quota statistics by role (admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'global_admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    global_admins = User.query.filter_by(role='global_admin').all()
    space_admins = User.query.filter_by(role='space_admin').all()
    regular_users = User.query.filter_by(role='user').all()
    
    def calculate_usage(users):
        if not users:
            return 0
        total_quota = sum([u.storage_quota for u in users])
        used_quota = sum([u.storage_used for u in users])
        return (used_quota / total_quota * 100) if total_quota > 0 else 0
    
    return jsonify({
        'global_admin': round(calculate_usage(global_admins), 1),
        'space_admin': round(calculate_usage(space_admins), 1),
        'user': round(calculate_usage(regular_users), 1)
    }), 200


@admin_bp.route('/acls', methods=['GET'])
@jwt_required()
def get_acls():
    """Get all ACL rules (admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'global_admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    acls = ACL.query.all()
    
    return jsonify([{
        'id': a.id,
        'file_id': a.file_id,
        'file_name': File.query.get(a.file_id).original_filename if File.query.get(a.file_id) else 'Unknown',
        'user_id': a.user_id,
        'user_name': User.query.get(a.user_id).username if User.query.get(a.user_id) else 'Unknown',
        'can_read': a.can_read,
        'can_write': a.can_write,
        'can_delete': a.can_delete,
        'can_share': a.can_share
    } for a in acls]), 200