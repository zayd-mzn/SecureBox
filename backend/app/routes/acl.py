"""
ACL Routes - Access Control List management
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User, File, ACL, Log
from datetime import datetime

acl_bp = Blueprint('acl', __name__)


def get_space_users(space_admin_id):
    """Get all users that belong to the same space as a Space Admin"""
    space_admin = User.query.get(space_admin_id)
    if not space_admin:
        return []
    
    # For Space Admin, they can manage ACLs for files owned by:
    # 1. Themselves
    # 2. Regular users (role='user')
    # 3. Other Space Admins (role='space_admin') - optional, depends on requirements
    
    # Get all users with role 'user' or 'space_admin'
    users_in_space = User.query.filter(
        User.role.in_(['user', 'space_admin']),
        User.is_active == True
    ).all()
    
    # Also include the space admin themselves
    user_ids = [u.id for u in users_in_space]
    if space_admin_id not in user_ids:
        user_ids.append(space_admin_id)
    
    return user_ids


def get_accessible_files(user):
    """Get files that the current user can access based on their role"""
    if user.role == 'global_admin':
        # Global admin can see all files
        return File.query.filter_by(is_deleted=False).all()
    elif user.role == 'space_admin':
        # Space admin can see files owned by users in their space
        space_user_ids = get_space_users(user.id)
        return File.query.filter(
            File.owner_id.in_(space_user_ids),
            File.is_deleted == False
        ).all()
    else:
        # Regular user can only see their own files
        return File.query.filter_by(owner_id=user.id, is_deleted=False).all()


def get_accessible_acls(user):
    """Get ACLs that the current user can see based on their role"""
    if user.role == 'global_admin':
        # Global admin can see all ACLs
        return ACL.query.all()
    elif user.role == 'space_admin':
        # Space admin can see ACLs for files owned by users in their space
        space_user_ids = get_space_users(user.id)
        
        # Get files owned by space users
        space_files = File.query.filter(
            File.owner_id.in_(space_user_ids),
            File.is_deleted == False
        ).all()
        
        file_ids = [f.id for f in space_files]
        
        # Get ACLs for those files
        if file_ids:
            return ACL.query.filter(ACL.file_id.in_(file_ids)).all()
        return []
    else:
        # Regular user can only see ACLs for their own files
        user_files = File.query.filter_by(owner_id=user.id, is_deleted=False).all()
        file_ids = [f.id for f in user_files]
        
        if file_ids:
            return ACL.query.filter(ACL.file_id.in_(file_ids)).all()
        return []


def can_manage_acl(user, acl):
    """Check if user can manage a specific ACL"""
    if user.role == 'global_admin':
        return True
    
    if user.role == 'space_admin':
        # Space admin can manage ACL if the file owner is in their space
        file = File.query.get(acl.file_id)
        if file:
            space_user_ids = get_space_users(user.id)
            return file.owner_id in space_user_ids
        return False
    
    # Regular user can only manage ACLs for their own files
    file = File.query.get(acl.file_id)
    return file and file.owner_id == user.id


def can_create_acl(user, file_id):
    """Check if user can create an ACL for a file"""
    if user.role == 'global_admin':
        return True
    
    file = File.query.get(file_id)
    if not file:
        return False
    
    if user.role == 'space_admin':
        # Space admin can create ACL if the file owner is in their space
        space_user_ids = get_space_users(user.id)
        return file.owner_id in space_user_ids
    
    # Regular user can only create ACLs for their own files
    return file.owner_id == user.id


@acl_bp.route('/acls', methods=['GET'])
@jwt_required()
def get_acls():
    """Get ACL rules based on user role"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if not current_user:
        return jsonify({'error': 'User not found'}), 404
    
    # Get accessible ACLs based on role
    acls = get_accessible_acls(current_user)
    
    return jsonify([{
        'id': a.id,
        'file_id': a.file_id,
        'user_id': a.user_id,
        'can_read': a.can_read,
        'can_write': a.can_write,
        'can_delete': a.can_delete,
        'can_share': a.can_share,
        'granted_by': a.granted_by,
        'granted_at': a.granted_at.isoformat() if a.granted_at else None
    } for a in acls]), 200


@acl_bp.route('/acls/<int:acl_id>', methods=['GET'])
@jwt_required()
def get_acl(acl_id):
    """Get a specific ACL rule"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if not current_user:
        return jsonify({'error': 'User not found'}), 404
    
    acl = ACL.query.get(acl_id)
    if not acl:
        return jsonify({'error': 'ACL rule not found'}), 404
    
    # Check if user has permission to view this ACL
    if not can_manage_acl(current_user, acl):
        return jsonify({'error': 'Unauthorized to view this ACL'}), 403
    
    return jsonify({
        'id': acl.id,
        'file_id': acl.file_id,
        'user_id': acl.user_id,
        'can_read': acl.can_read,
        'can_write': acl.can_write,
        'can_delete': acl.can_delete,
        'can_share': acl.can_share,
        'granted_by': acl.granted_by,
        'granted_at': acl.granted_at.isoformat() if acl.granted_at else None
    }), 200


@acl_bp.route('/acls', methods=['POST'])
@jwt_required()
def create_acl():
    """Create a new ACL rule"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if not current_user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    
    # Validate required fields
    if not data.get('file_id'):
        return jsonify({'error': 'file_id is required'}), 400
    if not data.get('user_id'):
        return jsonify({'error': 'user_id is required'}), 400
    
    # Check if file exists
    file = File.query.get(data['file_id'])
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    # Check if user has permission to create ACL for this file
    if not can_create_acl(current_user, data['file_id']):
        return jsonify({'error': 'Unauthorized to create ACL for this file'}), 403
    
    # Check if target user exists
    target_user = User.query.get(data['user_id'])
    if not target_user:
        return jsonify({'error': 'Target user not found'}), 404
    
    # Check if ACL already exists for this file and user
    existing_acl = ACL.query.filter_by(
        file_id=data['file_id'],
        user_id=data['user_id']
    ).first()
    
    if existing_acl:
        return jsonify({'error': 'ACL rule already exists for this file and user'}), 409
    
    # Create new ACL
    new_acl = ACL(
        file_id=data['file_id'],
        user_id=data['user_id'],
        can_read=data.get('can_read', False),
        can_write=data.get('can_write', False),
        can_delete=data.get('can_delete', False),
        can_share=data.get('can_share', False),
        granted_by=current_user_id,
        granted_at=datetime.utcnow()
    )
    
    db.session.add(new_acl)
    
    # Update file is_shared flag if share permission is granted
    if new_acl.can_share or new_acl.can_read:
        file.is_shared = True
        db.session.add(file)
    
    # Log the action
    log = Log(
        user=current_user.username,
        action='ACL_CREATE',
        resource=f'File: {file.original_filename}, User: {target_user.username}',
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    
    db.session.commit()
    
    return jsonify({
        'message': 'ACL rule created successfully',
        'acl': {
            'id': new_acl.id,
            'file_id': new_acl.file_id,
            'user_id': new_acl.user_id,
            'can_read': new_acl.can_read,
            'can_write': new_acl.can_write,
            'can_delete': new_acl.can_delete,
            'can_share': new_acl.can_share
        }
    }), 201


@acl_bp.route('/acls/<int:acl_id>', methods=['PUT'])
@jwt_required()
def update_acl(acl_id):
    """Update an ACL rule"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if not current_user:
        return jsonify({'error': 'User not found'}), 404
    
    acl = ACL.query.get(acl_id)
    if not acl:
        return jsonify({'error': 'ACL rule not found'}), 404
    
    # Check if user has permission to update this ACL
    if not can_manage_acl(current_user, acl):
        return jsonify({'error': 'Unauthorized to update this ACL'}), 403
    
    data = request.get_json()
    
    # Update fields
    if 'can_read' in data:
        acl.can_read = data['can_read']
    if 'can_write' in data:
        acl.can_write = data['can_write']
    if 'can_delete' in data:
        acl.can_delete = data['can_delete']
    if 'can_share' in data:
        acl.can_share = data['can_share']
    
    # Update file is_shared flag
    file = File.query.get(acl.file_id)
    if file:
        # Check if any ACL grants share or read access
        any_share_or_read = ACL.query.filter(
            ACL.file_id == acl.file_id,
            (ACL.can_share == True) | (ACL.can_read == True)
        ).first()
        file.is_shared = any_share_or_read is not None
        db.session.add(file)
    
    # Log the action
    log = Log(
        user=current_user.username,
        action='ACL_UPDATE',
        resource=f'ACL ID: {acl_id}',
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    
    db.session.commit()
    
    return jsonify({'message': 'ACL rule updated successfully'}), 200


@acl_bp.route('/acls/<int:acl_id>', methods=['DELETE'])
@jwt_required()
def delete_acl(acl_id):
    """Delete an ACL rule"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if not current_user:
        return jsonify({'error': 'User not found'}), 404
    
    acl = ACL.query.get(acl_id)
    if not acl:
        return jsonify({'error': 'ACL rule not found'}), 404
    
    # Check if user has permission to delete this ACL
    if not can_manage_acl(current_user, acl):
        return jsonify({'error': 'Unauthorized to delete this ACL'}), 403
    
    file_id = acl.file_id
    
    db.session.delete(acl)
    
    # Update file is_shared flag if no more ACLs
    remaining_acls = ACL.query.filter_by(file_id=file_id).first()
    if not remaining_acls:
        file = File.query.get(file_id)
        if file:
            file.is_shared = False
            db.session.add(file)
    
    # Log the action
    log = Log(
        user=current_user.username,
        action='ACL_DELETE',
        resource=f'ACL ID: {acl_id}',
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    
    db.session.commit()
    
    return jsonify({'message': 'ACL rule deleted successfully'}), 200


@acl_bp.route('/acls/file/<int:file_id>', methods=['GET'])
@jwt_required()
def get_acls_by_file(file_id):
    """Get all ACL rules for a specific file"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if not current_user:
        return jsonify({'error': 'User not found'}), 404
    
    file = File.query.get(file_id)
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    # Check if user has access to this file's ACLs
    if current_user.role == 'global_admin':
        pass  # Global admin can see all
    elif current_user.role == 'space_admin':
        space_user_ids = get_space_users(current_user.id)
        if file.owner_id not in space_user_ids:
            return jsonify({'error': 'Unauthorized to view ACLs for this file'}), 403
    else:
        if file.owner_id != current_user.id:
            return jsonify({'error': 'Unauthorized to view ACLs for this file'}), 403
    
    acls = ACL.query.filter_by(file_id=file_id).all()
    
    return jsonify([{
        'id': a.id,
        'file_id': a.file_id,
        'user_id': a.user_id,
        'user_name': User.query.get(a.user_id).username if User.query.get(a.user_id) else 'Unknown',
        'can_read': a.can_read,
        'can_write': a.can_write,
        'can_delete': a.can_delete,
        'can_share': a.can_share
    } for a in acls]), 200


@acl_bp.route('/acls/user/<int:user_id>', methods=['GET'])
@jwt_required()
def get_acls_by_user(user_id):
    """Get all ACL rules for a specific user"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if not current_user:
        return jsonify({'error': 'User not found'}), 404
    
    target_user = User.query.get(user_id)
    if not target_user:
        return jsonify({'error': 'User not found'}), 404
    
    # Permission check
    if current_user.role != 'global_admin' and current_user.id != user_id:
        # Space admin can see ACLs for users in their space
        if current_user.role == 'space_admin':
            space_user_ids = get_space_users(current_user.id)
            if user_id not in space_user_ids:
                return jsonify({'error': 'Unauthorized to view ACLs for this user'}), 403
        else:
            return jsonify({'error': 'Unauthorized to view ACLs for this user'}), 403
    
    acls = ACL.query.filter_by(user_id=user_id).all()
    
    return jsonify([{
        'id': a.id,
        'file_id': a.file_id,
        'file_name': File.query.get(a.file_id).original_filename if File.query.get(a.file_id) else 'Unknown',
        'can_read': a.can_read,
        'can_write': a.can_write,
        'can_delete': a.can_delete,
        'can_share': a.can_share
    } for a in acls]), 200


@acl_bp.route('/acls/check', methods=['POST'])
@jwt_required()
def check_permission():
    """Check if a user has permission for a file"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    data = request.get_json()
    file_id = data.get('file_id')
    permission = data.get('permission')  # read, write, delete, share
    
    if not file_id or not permission:
        return jsonify({'error': 'file_id and permission are required'}), 400
    
    file = File.query.get(file_id)
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    # Owner has all permissions
    if file.owner_id == current_user_id:
        return jsonify({'has_permission': True}), 200
    
    # Check ACL
    acl = ACL.query.filter_by(file_id=file_id, user_id=current_user_id).first()
    
    if not acl:
        return jsonify({'has_permission': False}), 200
    
    permission_map = {
        'read': acl.can_read,
        'write': acl.can_write,
        'delete': acl.can_delete,
        'share': acl.can_share
    }
    
    has_permission = permission_map.get(permission, False)
    
    return jsonify({'has_permission': has_permission}), 200