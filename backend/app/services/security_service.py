from flask import request, jsonify
from flask_cors import CORS
import time

# Dictionnaire basique en mémoire pour le rate-limiting (anti force-brute)
# Dans un projet en production, on utiliserait Redis, mais pour ce projet étudiant, 
# un stockage en mémoire suffit.
rate_limit_store = {}
MAX_ATTEMPTS = 5
BLOCK_TIME_SECONDS = 300 # Bloqué pendant 5 minutes

def setup_security(app):
    """
    Initialise les mécanismes de sécurité sur l'application Flask.
    """
    # 1. Configuration CORS (Cross-Origin Resource Sharing)
    # On autorise uniquement le frontend local (React tourne généralement sur le port 3000)
    CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

    # 2. Injection des en-têtes de sécurité sur chaque réponse HTTP
    @app.after_request
    def add_security_headers(response):
        # Empêche le navigateur de deviner le type MIME (protection contre le MIME-sniffing)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        # Empêche l'affichage de l'application dans un iframe (protection contre le Clickjacking)
        response.headers['X-Frame-Options'] = 'DENY'
        # Active le filtre XSS du navigateur
        response.headers['X-XSS-Protection'] = '1; mode=block'
        # Politique de sécurité du contenu stricte
        response.headers['Content-Security-Policy'] = "default-src 'self'"
        return response

def rate_limit_decorator(f):
    """
    Décorateur à placer au-dessus des routes sensibles (ex: login) pour éviter le bruteforce.
    """
    def wrapper(*args, **kwargs):
        ip = request.remote_addr
        current_time = time.time()
        
        # Initialisation ou nettoyage des anciens logs pour cette IP
        if ip not in rate_limit_store:
            rate_limit_store[ip] = {'attempts': 0, 'blocked_until': 0}
            
        record = rate_limit_store[ip]
        
        # Vérifier si l'utilisateur est actuellement bloqué
        if current_time < record['blocked_until']:
            remaining = int(record['blocked_until'] - current_time)
            return jsonify({
                "error": "Trop de tentatives échouées.",
                "message": f"Veuillez réessayer dans {remaining} secondes."
            }), 429
            
        # Exécuter la fonction d'origine
        response = f(*args, **kwargs)
        
        # Si la requête échoue (code 401 pour erreur d'authentification)
        if response[1] == 401:
            record['attempts'] += 1
            if record['attempts'] >= MAX_ATTEMPTS:
                record['blocked_until'] = current_time + BLOCK_TIME_SECONDS
                record['attempts'] = 0 # Réinitialiser après blocage
        else:
            # En cas de succès, on réinitialise les compteurs
            record['attempts'] = 0
            
        return response
    wrapper.__name__ = f.__name__
    return wrapper