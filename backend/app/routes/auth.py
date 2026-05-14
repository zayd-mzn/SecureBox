from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token
from ..extensions import bcrypt, db
from ..models import User
from datetime import datetime, timedelta, timezone
import pyotp

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()

    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password are required'}), 400

    user = User.query.filter(
        (User.username == data['username']) | (User.email == data['username'])
    ).first()

    # Generic response for invalid credentials to prevent enumeration
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401

    # Brute force protection
    if user.locked_until and user.locked_until > datetime.now():
        remaining_time = (user.locked_until - datetime.now()).total_seconds() // 60
        return jsonify({
            'error': f'Account locked due to multiple failed attempts. Try again in {int(remaining_time)} minutes.'
        }), 429

    if not bcrypt.check_password_hash(user.password_hash, data['password']):
        if user.failed_attempts is None:
            user.failed_attempts = 0
            
        user.failed_attempts += 1
        print(f"Failed login attempt {user.failed_attempts} for user {user.username}")
        
        if user.failed_attempts >= 5:
            user.locked_until = datetime.now() + timedelta(minutes=15)
            print(f"Account locked for user {user.username}")
        
        db.session.commit()
        return jsonify({'error': 'Invalid credentials'}), 401

    # Reset brute force counters on successful password match
    if user.failed_attempts > 0 or user.locked_until:
        user.failed_attempts = 0
        user.locked_until = None
        db.session.commit()

    if not user.is_active:
        return jsonify({'error': 'Account is disabled'}), 403

    # Check for MFA requirement
    if user.mfa_enabled:
        return jsonify({
            'mfa_required': True,
            'user_id': user.id,
            'message': 'MFA validation required'
        }), 200

    # Successful login without MFA
    access_token = create_access_token(identity=str(user.id))

    return jsonify({
        'access_token': access_token,
        'token_type': 'Bearer',
        'mfa_required': False,
        'message': 'Login successful',
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role,
            'has_avatar': user.avatar_base64 is not None
        }
    }), 200

@auth_bp.route('/login/mfa', methods=['POST'])
def login_mfa():
    data = request.get_json()
    user_id = data.get('user_id')
    mfa_code = data.get('code')

    if not user_id or not mfa_code:
        return jsonify({'error': 'User ID and MFA code are required'}), 400

    user = User.query.get(user_id)
    
    if not user or not user.mfa_enabled:
        return jsonify({'error': 'Invalid request or MFA not enabled'}), 400

    # Verify TOTP code with a 30-second tolerance window
    totp = pyotp.TOTP(user.mfa_secret)
    if not totp.verify(mfa_code, valid_window=1):
        return jsonify({'error': 'Invalid MFA code'}), 401

    # Finalize login
    access_token = create_access_token(identity=str(user.id))

    return jsonify({
        'access_token': access_token,
        'token_type': 'Bearer',
        'message': 'MFA login successful',
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role,
            'has_avatar': user.avatar_base64 is not None
        }
    }), 200

    