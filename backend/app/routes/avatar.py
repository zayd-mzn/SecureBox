"""
Avatar Routes - Handle user profile picture upload and retrieval
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User, Log
from datetime import datetime
import base64
import re

avatar_bp = Blueprint('avatar', __name__)


def validate_base64_image(base64_string):
    """Validate base64 image string"""
    # Check if it's a valid base64 data URL
    pattern = r'^data:image/(jpeg|jpg|png|gif|webp|bmp);base64,'
    if not re.match(pattern, base64_string):
        return None, None
    
    # Extract mime type and base64 data
    mime_match = re.match(r'data:image/([^;]+);base64,', base64_string)
    if not mime_match:
        return None, None
    
    mime_type = f"image/{mime_match.group(1)}"
    base64_data = re.sub(pattern, '', base64_string)
    
    # Check size (limit to 2MB)
    import math
    size_in_bytes = len(base64_data) * 3 / 4  # Approximate size
    if size_in_bytes > 2 * 1024 * 1024:  # 2MB limit
        return None, None
    
    return mime_type, base64_data


@avatar_bp.route('/avatar', methods=['POST'])
@jwt_required()
def upload_avatar():
    """Upload/Update user avatar"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    
    if not data or 'avatar' not in data:
        return jsonify({'error': 'No avatar data provided'}), 400
    
    avatar_base64 = data['avatar']
    
    # Validate and process avatar
    mime_type, clean_base64 = validate_base64_image(avatar_base64)
    
    if not mime_type:
        return jsonify({'error': 'Invalid image format. Use JPEG, PNG, GIF, WEBP, or BMP (max 2MB)'}), 400
    
    # Save avatar to database
    user.avatar_base64 = avatar_base64  # Store full data URL
    user.avatar_mime_type = mime_type
    user.avatar_updated_at = datetime.utcnow()
    
    # Log the action
    log = Log(
        user=user.username,
        action='AVATAR_UPLOAD',
        resource=f'User {user.username} updated avatar',
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Avatar updated successfully',
        'avatar_url': avatar_base64[:100] + '...'  # Don't return full base64 in response
    }), 200


@avatar_bp.route('/avatar', methods=['DELETE'])
@jwt_required()
def delete_avatar():
    """Delete user avatar"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Remove avatar
    user.avatar_base64 = None
    user.avatar_mime_type = None
    user.avatar_updated_at = None
    
    # Log the action
    log = Log(
        user=user.username,
        action='AVATAR_DELETE',
        resource=f'User {user.username} removed avatar',
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    
    db.session.commit()
    
    return jsonify({'message': 'Avatar removed successfully'}), 200


@avatar_bp.route('/avatar/<int:user_id>', methods=['GET'])
@jwt_required()
def get_avatar(user_id):
    """Get user avatar by ID"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Check permissions (users can only see their own avatar unless admin)
    if current_user_id != user_id and current_user.role != 'global_admin':
        return jsonify({'error': 'Access denied'}), 403
    
    if not user.avatar_base64:
        return jsonify({'has_avatar': False}), 200
    
    return jsonify({
        'has_avatar': True,
        'avatar': user.avatar_base64,
        'mime_type': user.avatar_mime_type,
        'updated_at': user.avatar_updated_at.isoformat() if user.avatar_updated_at else None
    }), 200


@avatar_bp.route('/avatar/batch', methods=['POST'])
@jwt_required()
def get_avatars_batch():
    """Get multiple user avatars in one request (for efficiency)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    data = request.get_json()
    user_ids = data.get('user_ids', [])
    
    if not user_ids:
        return jsonify({'avatars': {}}), 200
    
    # Admin can see all avatars, regular users only their own
    if current_user.role != 'global_admin':
        user_ids = [uid for uid in user_ids if uid == current_user_id]
    
    users = User.query.filter(User.id.in_(user_ids)).all()
    
    avatars = {}
    for user in users:
        if user.avatar_base64:
            avatars[str(user.id)] = {
                'avatar': user.avatar_base64,
                'mime_type': user.avatar_mime_type
            }
    
    return jsonify({'avatars': avatars}), 200