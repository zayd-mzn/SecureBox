from flask import Blueprint, jsonify, request
from ..extensions import bcrypt, db
from ..models import User
import re

register_bp = Blueprint('register', __name__, url_prefix='/api/auth')

# Roles autorisés à l'inscription (Global Admin créé manuellement)
ALLOWED_ROLES = ['user', 'space_admin']

def is_valid_email(email):
    return re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email) is not None

def is_strong_password(password):
    """
    Règles : min 8 caractères, au moins 1 majuscule, 1 chiffre, 1 caractère spécial
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r'[0-9]', password):
        return False, "Password must contain at least one number"
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Password must contain at least one special character"
    return True, ""


@register_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()

    # --- Validation des champs requis ---
    required_fields = ['username', 'email', 'password', 'confirm_password']
    for field in required_fields:
        if not data or not data.get(field):
            return jsonify({'error': f'{field.replace("_", " ").capitalize()} is required'}), 400

    username = data['username'].strip()
    email = data['email'].strip().lower()
    password = data['password']
    confirm_password = data['confirm_password']
    role = data.get('role', 'user').strip().lower()

    # --- Validation du rôle ---
    if role not in ALLOWED_ROLES:
        return jsonify({'error': 'Invalid role selected'}), 400

    # --- Validation du username (min 3, max 30, alphanumérique + underscore) ---
    if len(username) < 3 or len(username) > 30:
        return jsonify({'error': 'Username must be between 3 and 30 characters'}), 400
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        return jsonify({'error': 'Username can only contain letters, numbers, and underscores'}), 400

    # --- Validation de l'email ---
    if not is_valid_email(email):
        return jsonify({'error': 'Invalid email address'}), 400

    # --- Validation du mot de passe ---
    valid, msg = is_strong_password(password)
    if not valid:
        return jsonify({'error': msg}), 400

    # --- Vérification de la confirmation du mot de passe ---
    if password != confirm_password:
        return jsonify({'error': 'Passwords do not match'}), 400

    # --- Vérification de l'unicité (username + email) ---
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already taken'}), 409

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409

    # --- Hashage du mot de passe et création de l'utilisateur ---
    password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    new_user = User(
        username=username,
        email=email,
        password_hash=password_hash,
        role=role,
        mfa_enabled=False,
        is_active=True
    )

    try:
        db.session.add(new_user)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Registration failed. Please try again.'}), 500

    return jsonify({
        'message': 'Account created successfully',
        'user': {
            'id': new_user.id,
            'username': new_user.username,
            'email': new_user.email,
            'role': new_user.role
        }
    }), 201
