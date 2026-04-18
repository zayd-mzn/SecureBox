from flask import Blueprint, jsonify, request
from ..extensions import bcrypt, db
from ..models import User

# --- AJOUTS DE TES SERVICES ---
from ..services.security_service import rate_limit_decorator
from ..services.log_service import LogService
# ------------------------------

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/login', methods=['POST'])
@rate_limit_decorator  # <-- Application de ton filtre anti force-brute
def login():
    data = request.get_json()

    # Validate input
    if not data or not data.get('username') or not data.get('password'):
        # Trace la tentative de connexion malformée
        LogService.record(user_id=None, action="LOGIN_FAILED", success=False)
        return jsonify({'error': 'Username and password are required'}), 400

    # Find user by username or email
    user = User.query.filter(
        (User.username == data['username']) | (User.email == data['username'])
    ).first()

    # Check user exists and password is correct
    if not user or not bcrypt.check_password_hash(user.password_hash, data['password']):
        # Trace l'échec d'authentification (mauvais mot de passe ou utilisateur inexistant)
        user_id = user.id if user else None
        LogService.record(user_id=user_id, action="LOGIN_FAILED", success=False)
        return jsonify({'error': 'Invalid credentials'}), 401

    # Check account is active
    if not user.is_active:
        LogService.record(user_id=user.id, action="LOGIN_FAILED", success=False)
        return jsonify({'error': 'Account is disabled'}), 403

    # MFA check (not yet implemented)
    if user.mfa_enabled:
        # Trace le passage à l'étape MFA
        LogService.record(user_id=user.id, action="LOGIN_SUCCESS_MFA_PENDING", success=True)
        return jsonify({
            'mfa_required': True,
            'user_id': user.id       # temporarily used to identify user during MFA
        }), 200

    # No MFA — login success (!! JWT sessions later)
    # Trace la connexion réussie
    LogService.record(user_id=user.id, action="LOGIN_SUCCESS", success=True)
    return jsonify({
        'mfa_required': False,
        'message': 'Login successful',
        'user': {
            'id': user.id,
            'username': user.username,
            'role': user.role
        }
    }), 200