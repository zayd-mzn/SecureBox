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

    # 1. Validation de la requête
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password are required'}), 400

    # 2. Recherche de l'utilisateur
    user = User.query.filter(
        (User.username == data['username']) | (User.email == data['username'])
    ).first()

    # Sécurité anti-énumération : on ne dit jamais si c'est le compte ou le mot de passe qui est faux
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401

    # ==========================================
    # DÉBUT DE LA PROTECTION FORCE BRUTE
    # ==========================================
    
    # 3. Vérifier si le compte est actuellement verrouillé
    if user.locked_until and user.locked_until > datetime.now():
        remaining_time = (user.locked_until - datetime.now()).total_seconds() // 60
        return jsonify({
            'error': f'Account locked due to multiple failed attempts. Try again in {int(remaining_time)} minutes.'
        }), 429  # 429 = Too Many Requests

    # 4. Vérification du mot de passe
    if not bcrypt.check_password_hash(user.password_hash, data['password']):
        
        # SÉCURITÉ : Si la valeur est None (vide), on la force à 0 avant d'ajouter 1
        if user.failed_attempts is None:
            user.failed_attempts = 0
            
        user.failed_attempts += 1
        print(f"⚠️ Test : Mauvais mot de passe. Tentative n°{user.failed_attempts}")
        
        if user.failed_attempts >= 5:
            user.locked_until = datetime.now() + timedelta(minutes=15)
            print("🛑 Test : Limite atteinte (5) ! Verrouillage activé.")
        
        db.session.commit()
        return jsonify({'error': 'Invalid credentials'}), 401

    # SUCCÈS : Réinitialiser les compteurs de force brute
    if user.failed_attempts > 0 or user.locked_until:
        user.failed_attempts = 0
        user.locked_until = None
        db.session.commit()
        
    # ==========================================
    # FIN DE LA PROTECTION FORCE BRUTE
    # ==========================================

    # 5. Vérifier si le compte est désactivé par l'administrateur
    if not user.is_active:
        return jsonify({'error': 'Account is disabled'}), 403

  # 6. Vérifier si le compte est désactivé par l'administrateur
    if not user.is_active:
        return jsonify({'error': 'Account is disabled'}), 403

    # ==========================================
    # MODIFICATION MFA : Ne PAS créer le token ici si MFA est actif
    # ==========================================
    if user.mfa_enabled:
        return jsonify({
            'mfa_required': True,
            'user_id': user.id,
            'message': 'MFA validation required'
        }), 200

    # 7. Génération du JWT (Uniquement si pas de MFA)
    access_token = create_access_token(identity=str(user.id))

    # 8. Connexion réussie (Sans MFA)
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

    # Retrouver l'utilisateur
    user = User.query.get(user_id)
    
    if not user or not user.mfa_enabled:
        return jsonify({'error': 'Invalid request or MFA not enabled'}), 400

    # ==========================================
    # VÉRIFICATION DU CODE MFA (AVEC TOLÉRANCE)
    # ==========================================
    # 1. On définit la machine à calculer le code
    totp = pyotp.TOTP(user.mfa_secret)
    
    # 2. On vérifie le code avec une tolérance de 30 secondes (valid_window=1)
    if not totp.verify(mfa_code, valid_window=1):
        return jsonify({'error': 'Invalid MFA code'}), 401

    # ==========================================
    # SUCCÈS : Le code est bon ! On donne l'accès
    # ==========================================
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