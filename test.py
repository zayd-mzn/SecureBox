from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token
from ..extensions import bcrypt, db
from ..models import User, Log
from datetime import datetime, timedelta, timezone
import pyotp

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


def create_log(user, action, resource, ip_address, status='success', details=None):
    """Helper function to create a log entry"""
    log_entry = Log(
        user=user.username if user else 'unknown',
        action=action,
        resource=resource,
        ip_address=ip_address,
        status=status,
        timestamp=datetime.utcnow()
    )
    db.session.add(log_entry)


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    ip_address = request.remote_addr

    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password are required'}), 400

    user = User.query.filter(
        (User.username == data['username']) | (User.email == data['username'])
    ).first()

    # Generic response for invalid credentials to prevent enumeration
    if not user:
        # Log failed attempt (user not found)
        log_entry = Log(
            user=data.get('username', 'unknown'),
            action='LOGIN_FAILED',
            resource=f'User not found: {data.get("username")}',
            ip_address=ip_address,
            status='failed',
            timestamp=datetime.utcnow()
        )
        db.session.add(log_entry)
        db.session.commit()
        return jsonify({'error': 'Invalid credentials'}), 401

    # Brute force protection
    if user.locked_until and user.locked_until > datetime.now():
        remaining_time = (user.locked_until - datetime.now()).total_seconds() // 60
        # Log lockout attempt
        log_entry = Log(
            user=user.username,
            action='LOGIN_BLOCKED',
            resource=f'Account locked - too many failed attempts',
            ip_address=ip_address,
            status='failed',
            timestamp=datetime.utcnow()
        )
        db.session.add(log_entry)
        db.session.commit()
        return jsonify({
            'error': f'Account locked due to multiple failed attempts. Try again in {int(remaining_time)} minutes.'
        }), 429

    if not bcrypt.check_password_hash(user.password_hash, data['password']):
        if user.failed_attempts is None:
            user.failed_attempts = 0
            
        user.failed_attempts += 1
        
        # Log failed password attempt
        log_entry = Log(
            user=user.username,
            action='LOGIN_FAILED',
            resource=f'Invalid password (attempt {user.failed_attempts}/5)',
            ip_address=ip_address,
            status='failed',
            timestamp=datetime.utcnow()
        )
        db.session.add(log_entry)
        
        if user.failed_attempts >= 5:
            user.locked_until = datetime.now() + timedelta(minutes=15)
            # Log account lockout
            lock_log = Log(
                user=user.username,
                action='ACCOUNT_LOCKED',
                resource=f'Account locked due to {user.failed_attempts} failed attempts',
                ip_address=ip_address,
                status='failed',
                timestamp=datetime.utcnow()
            )
            db.session.add(lock_log)
        
        db.session.commit()
        return jsonify({'error': 'Invalid credentials'}), 401

    # Reset brute force counters on successful password match
    if user.failed_attempts > 0 or user.locked_until:
        # Log that account was unlocked
        if user.locked_until:
            unlock_log = Log(
                user=user.username,
                action='ACCOUNT_UNLOCKED',
                resource='Account unlocked after successful login',
                ip_address=ip_address,
                status='success',
                timestamp=datetime.utcnow()
            )
            db.session.add(unlock_log)
        
        user.failed_attempts = 0
        user.locked_until = None
        db.session.commit()

    if not user.is_active:
        # Log disabled account attempt
        log_entry = Log(
            user=user.username,
            action='LOGIN_FAILED',
            resource='Account is disabled',
            ip_address=ip_address,
            status='failed',
            timestamp=datetime.utcnow()
        )
        db.session.add(log_entry)
        db.session.commit()
        return jsonify({'error': 'Account is disabled'}), 403

    # Check for MFA requirement
    if user.mfa_enabled:
        # Log MFA request
        log_entry = Log(
            user=user.username,
            action='MFA_REQUIRED',
            resource='MFA code required for login',
            ip_address=ip_address,
            status='pending',
            timestamp=datetime.utcnow()
        )
        db.session.add(log_entry)
        db.session.commit()
        
        return jsonify({
            'mfa_required': True,
            'user_id': user.id,
            'message': 'MFA validation required'
        }), 200

    # Successful login without MFA
    access_token = create_access_token(identity=str(user.id))
    
    # Log successful login
    log_entry = Log(
        user=user.username,
        action='LOGIN_SUCCESS',
        resource='User logged in successfully',
        ip_address=ip_address,
        status='success',
        timestamp=datetime.utcnow()
    )
    db.session.add(log_entry)
    db.session.commit()

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
    ip_address = request.remote_addr

    if not user_id or not mfa_code:
        return jsonify({'error': 'User ID and MFA code are required'}), 400

    user = User.query.get(user_id)
    
    if not user or not user.mfa_enabled:
        # Log invalid MFA request
        log_entry = Log(
            user=user.username if user else 'unknown',
            action='MFA_FAILED',
            resource='Invalid MFA request',
            ip_address=ip_address,
            status='failed',
            timestamp=datetime.utcnow()
        )
        db.session.add(log_entry)
        db.session.commit()
        return jsonify({'error': 'Invalid request or MFA not enabled'}), 400

    # Verify TOTP code with a 30-second tolerance window
    totp = pyotp.TOTP(user.mfa_secret)
    if not totp.verify(mfa_code, valid_window=1):
        # Log failed MFA attempt
        log_entry = Log(
            user=user.username,
            action='MFA_FAILED',
            resource='Invalid TOTP code',
            ip_address=ip_address,
            status='failed',
            timestamp=datetime.utcnow()
        )
        
        # Track MFA failures (optional brute force protection for MFA)
        if hasattr(user, 'mfa_failed_attempts'):
            user.mfa_failed_attempts = (user.mfa_failed_attempts or 0) + 1
            if user.mfa_failed_attempts >= 3:
                log_entry.resource = 'Multiple MFA failures - consider security review'
        else:
            user.mfa_failed_attempts = 1
        
        db.session.add(log_entry)
        db.session.commit()
        return jsonify({'error': 'Invalid MFA code'}), 401
    
    # Reset MFA failed attempts on success
    if hasattr(user, 'mfa_failed_attempts') and user.mfa_failed_attempts:
        user.mfa_failed_attempts = 0

    # Finalize login
    access_token = create_access_token(identity=str(user.id))
    
    # Log successful MFA login
    log_entry = Log(
        user=user.username,
        action='LOGIN_SUCCESS',
        resource='MFA login successful',
        ip_address=ip_address,
        status='success',
        timestamp=datetime.utcnow()
    )
    db.session.add(log_entry)
    
    # Also log MFA verification success
    mfa_log = Log(
        user=user.username,
        action='MFA_VERIFIED',
        resource='MFA code verified successfully',
        ip_address=ip_address,
        status='success',
        timestamp=datetime.utcnow()
    )
    db.session.add(mfa_log)
    
    db.session.commit()

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