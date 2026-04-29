from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token
from ..extensions import bcrypt
from ..models import User

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()

    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password are required'}), 400

    user = User.query.filter(
        (User.username == data['username']) | (User.email == data['username'])
    ).first()

    if not user or not bcrypt.check_password_hash(user.password_hash, data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401

    if not user.is_active:
        return jsonify({'error': 'Account is disabled'}), 403

    if user.mfa_enabled:
        return jsonify({'mfa_required': True, 'user_id': user.id}), 200

    token = create_access_token(identity=str(user.id), additional_claims={
        'username': user.username,
        'role': user.role
    })

    return jsonify({
        'mfa_required': False,
        'message': 'Login successful',
        'token': token,
        'user': {
            'id': user.id,
            'username': user.username,
            'role': user.role
        }
    }), 200
