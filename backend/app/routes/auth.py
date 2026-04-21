from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token
from ..extensions import bcrypt, db
from ..models import User

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()

    # Validate input
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password are required'}), 400

    # Find user by username or email
    user = User.query.filter(
        (User.username == data['username']) | (User.email == data['username'])
    ).first()

    # Check user exists and password is correct
    if not user or not bcrypt.check_password_hash(user.password_hash, data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401

    # Check account is active
    if not user.is_active:
        return jsonify({'error': 'Account is disabled'}), 403

    # Generate JWT token
    access_token = create_access_token(identity=str(user.id))

    # MFA check (not yet implemented)
    if user.mfa_enabled:
        return jsonify({
            'mfa_required': True,
            'user_id': user.id
        }), 200

    # No MFA — login success with JWT token
    return jsonify({
        'access_token': access_token,
        'token_type': 'Bearer',
        'mfa_required': False,
        'message': 'Login successful',
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role
        }
    }), 200