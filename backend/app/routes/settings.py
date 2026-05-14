"""
Settings Routes - User settings management
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db, bcrypt
from ..models import User, Log
from datetime import datetime
import re

settings_bp = Blueprint('settings', __name__)


def is_strong_password(password):
    """Check if password meets security requirements"""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r'[0-9]', password):
        return False, "Password must contain at least one number"
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Password must contain at least one special character"
    return True, ""


@settings_bp.route('/settings/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Get current user profile"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'username': user.username,
        'email': user.email,
        'full_name': getattr(user, 'full_name', user.username),
        'phone': getattr(user, 'phone', ''),
        'avatar': user.avatar_base64 if user.avatar_base64 else None,
        'has_avatar': user.avatar_base64 is not None
    }), 200


@settings_bp.route('/settings/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """Update user profile"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    
    # Update username (check uniqueness)
    if 'username' in data and data['username'] != user.username:
        existing = User.query.filter_by(username=data['username']).first()
        if existing:
            return jsonify({'error': 'Username already taken'}), 409
        user.username = data['username']
    
    # Update email (check uniqueness)
    if 'email' in data and data['email'] != user.email:
        existing = User.query.filter_by(email=data['email']).first()
        if existing:
            return jsonify({'error': 'Email already registered'}), 409
        user.email = data['email']
    
    # Update other fields
    if 'full_name' in data:
        user.full_name = data['full_name']
    if 'phone' in data:
        user.phone = data['phone']
    
    # Log the action
    log = Log(
        user=user.username,
        action='PROFILE_UPDATE',
        resource='Profile information updated',
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Profile updated successfully',
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'full_name': getattr(user, 'full_name', user.username),
            'phone': getattr(user, 'phone', '')
        }
    }), 200


@settings_bp.route('/settings/password', methods=['PUT'])
@jwt_required()
def change_password():
    """Change user password"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    confirm_password = data.get('confirm_password')
    
    if not current_password or not new_password or not confirm_password:
        return jsonify({'error': 'All password fields are required'}), 400
    
    # Verify current password
    if not bcrypt.check_password_hash(user.password_hash, current_password):
        return jsonify({'error': 'Current password is incorrect'}), 401
    
    # Check if new password matches confirmation
    if new_password != confirm_password:
        return jsonify({'error': 'New passwords do not match'}), 400
    
    # Validate password strength
    is_valid, message = is_strong_password(new_password)
    if not is_valid:
        return jsonify({'error': message}), 400
    
    # Update password
    user.password_hash = bcrypt.generate_password_hash(new_password).decode('utf-8')
    
    # Log the action
    log = Log(
        user=user.username,
        action='PASSWORD_CHANGE',
        resource='Password changed',
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    
    db.session.commit()
    
    return jsonify({'message': 'Password changed successfully'}), 200


@settings_bp.route('/settings/mfa/status', methods=['GET'])
@jwt_required()
def get_mfa_status():
    """Get MFA status for current user"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'mfa_enabled': user.mfa_enabled,
        'mfa_method': 'totp' if user.mfa_enabled else None
    }), 200


@settings_bp.route('/settings/mfa/setup', methods=['POST'])
@jwt_required()
def setup_mfa():
    """Setup MFA for user"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Generate TOTP secret
    import pyotp
    secret = pyotp.random_base32()
    
    # Store secret temporarily (in a real app, you'd have a pending_mfa_secret field)
    user.mfa_secret = secret
    
    # Generate provisioning URI
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(user.email, issuer_name="SecureBox")
    
    # In a real implementation, you'd generate a QR code here
    # For now, return the secret
    db.session.commit()
    
    return jsonify({
        'secret': secret,
        'provisioning_uri': provisioning_uri
    }), 200


@settings_bp.route('/settings/mfa/verify', methods=['POST'])
@jwt_required()
def verify_mfa():
    """Verify and enable MFA"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    verification_code = data.get('verification_code')
    
    if not verification_code:
        return jsonify({'error': 'Verification code is required'}), 400
    
    import pyotp
    totp = pyotp.TOTP(user.mfa_secret)
    
    if not totp.verify(verification_code):
        return jsonify({'error': 'Invalid verification code'}), 400
    
    user.mfa_enabled = True
    
    # Log the action
    log = Log(
        user=user.username,
        action='MFA_ENABLE',
        resource='Two-Factor Authentication enabled',
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    
    db.session.commit()
    
    return jsonify({'message': 'MFA enabled successfully'}), 200


@settings_bp.route('/settings/mfa/disable', methods=['POST'])
@jwt_required()
def disable_mfa():
    """Disable MFA for user"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    user.mfa_enabled = False
    user.mfa_secret = None
    
    # Log the action
    log = Log(
        user=user.username,
        action='MFA_DISABLE',
        resource='Two-Factor Authentication disabled',
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    
    db.session.commit()
    
    return jsonify({'message': 'MFA disabled successfully'}), 200


@settings_bp.route('/settings/preferences', methods=['GET'])
@jwt_required()
def get_preferences():
    """Get user preferences"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Get or create preferences
    if not hasattr(user, 'preferences') or not user.preferences:
        user.preferences = {
            'language': 'en',
            'theme': 'light',
            'date_format': 'MM/DD/YYYY',
            'timezone': 'America/New_York',
            'default_view': 'list',
            'items_per_page': 25,
            'email_notifications': True,
            'push_notifications': False,
            'upload_success': True,
            'download_activity': False,
            'share_requests': True,
            'storage_warnings': True,
            'security_alerts': True,
            'weekly_digest': False,
            'profile_visibility': 'team',
            'show_email': False,
            'show_activity': True,
            'allow_file_indexing': True
        }
        db.session.commit()
    
    return jsonify(user.preferences), 200


@settings_bp.route('/settings/preferences', methods=['PUT'])
@jwt_required()
def update_preferences():
    """Update user preferences"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    
    # Get existing preferences or create new
    if not hasattr(user, 'preferences') or not user.preferences:
        user.preferences = {}
    
    # Update preferences
    for key, value in data.items():
        user.preferences[key] = value
    
    # Log the action
    log = Log(
        user=user.username,
        action='PREFERENCES_UPDATE',
        resource='User preferences updated',
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    
    db.session.commit()
    
    return jsonify({'message': 'Preferences updated successfully'}), 200


@settings_bp.route('/settings/notifications', methods=['GET'])
@jwt_required()
def get_notification_settings():
    """Get notification settings"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if not hasattr(user, 'preferences') or not user.preferences:
        user.preferences = {}
        db.session.commit()
    
    return jsonify({
        'email_notifications': user.preferences.get('email_notifications', True),
        'push_notifications': user.preferences.get('push_notifications', False),
        'upload_success': user.preferences.get('upload_success', True),
        'download_activity': user.preferences.get('download_activity', False),
        'share_requests': user.preferences.get('share_requests', True),
        'storage_warnings': user.preferences.get('storage_warnings', True),
        'security_alerts': user.preferences.get('security_alerts', True),
        'weekly_digest': user.preferences.get('weekly_digest', False)
    }), 200


@settings_bp.route('/settings/notifications', methods=['PUT'])
@jwt_required()
def update_notification_settings():
    """Update notification settings"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if not hasattr(user, 'preferences') or not user.preferences:
        user.preferences = {}
    
    data = request.get_json()
    
    notification_keys = [
        'email_notifications', 'push_notifications', 'upload_success',
        'download_activity', 'share_requests', 'storage_warnings',
        'security_alerts', 'weekly_digest'
    ]
    
    for key in notification_keys:
        if key in data:
            user.preferences[key] = data[key]
    
    db.session.commit()
    
    return jsonify({'message': 'Notification settings updated successfully'}), 200


@settings_bp.route('/settings/privacy', methods=['GET'])
@jwt_required()
def get_privacy_settings():
    """Get privacy settings"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if not hasattr(user, 'preferences') or not user.preferences:
        user.preferences = {}
        db.session.commit()
    
    return jsonify({
        'profile_visibility': user.preferences.get('profile_visibility', 'team'),
        'show_email': user.preferences.get('show_email', False),
        'show_activity': user.preferences.get('show_activity', True),
        'allow_file_indexing': user.preferences.get('allow_file_indexing', True)
    }), 200


@settings_bp.route('/settings/privacy', methods=['PUT'])
@jwt_required()
def update_privacy_settings():
    """Update privacy settings"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if not hasattr(user, 'preferences') or not user.preferences:
        user.preferences = {}
    
    data = request.get_json()
    
    privacy_keys = ['profile_visibility', 'show_email', 'show_activity', 'allow_file_indexing']
    
    for key in privacy_keys:
        if key in data:
            user.preferences[key] = data[key]
    
    db.session.commit()
    
    return jsonify({'message': 'Privacy settings updated successfully'}), 200


@settings_bp.route('/settings/export-data', methods=['POST'])
@jwt_required()
def export_data():
    """Export user data"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Log the action
    log = Log(
        user=user.username,
        action='DATA_EXPORT',
        resource='User requested data export',
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    db.session.commit()
    
    # In a real implementation, you would generate a ZIP file with user data
    return jsonify({
        'message': 'Data export initiated. You will receive an email when ready.',
        'export_id': f"export_{user.id}_{datetime.utcnow().timestamp()}"
    }), 200


@settings_bp.route('/settings/delete-account', methods=['DELETE'])
@jwt_required()
def delete_account():
    """Delete user account"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    password = data.get('password')
    
    if not password:
        return jsonify({'error': 'Password is required to delete account'}), 400
    
    # Verify password
    if not bcrypt.check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Password is incorrect'}), 401
    
    # Log before deletion
    log = Log(
        user=user.username,
        action='ACCOUNT_DELETE',
        resource='User account deleted',
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    db.session.commit()
    
    # Delete user (cascade will handle related records)
    db.session.delete(user)
    db.session.commit()
    
    return jsonify({'message': 'Account deleted successfully'}), 200