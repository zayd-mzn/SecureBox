from datetime import datetime, timezone
from flask import request

# Note: On importera 'db' et 'ActivityLog' depuis les fichiers de Jawad 
# une fois qu'il aura terminé 'models.py' et 'extensions.py'.
from app.extensions import db
from app.models import ActivityLog

class LogService:
    @staticmethod
    def record(user_id, action, target_id=None, success=True):
        """
        Enregistre une action dans la base de données.
        Actions possibles (selon l'UML) : LOGIN_SUCCESS, LOGIN_FAILED, FILE_UPLOADED, 
        FILE_EDITED, FILE_DELETED, PERMISSION_CHANGED, QUOTA_WARNING, LOGOUT.
        """
        try:
            # Récupère l'adresse IP de l'utilisateur qui fait la requête
            ip_address = request.remote_addr if request else "127.0.0.1"
            
            # --- Code prêt pour SQLAlchemy (à décommenter quand models.py sera prêt) ---
            new_log = ActivityLog(
                user_id=user_id,
                action=action,
                target_id=target_id,
                ip_address=ip_address,
                timestamp=datetime.utcnow(),
                success=success
             )
            db.session.add(new_log)
            db.session.commit()
            
            # En attendant la DB, on affiche le log dans la console du serveur pour tester
            print(f"📝 [LOG] {datetime.now(timezone.utc)} | User:{user_id} | Action:{action} | Target:{target_id} | Success:{success} | IP:{ip_address}")
            return True
            
        except Exception as e:
            print(f"❌ Erreur lors de la journalisation : {e}")
            return False

    @staticmethod
    def search(filters=None):
        """
        Récupère l'historique des activités.
        Utile pour ton interface frontend Logs.jsx.
        """
        try:
            # --- Code prêt pour SQLAlchemy ---
            # query = ActivityLog.query
            # if filters and 'user_id' in filters:
            #     query = query.filter_by(user_id=filters['user_id'])
            # # Ajouter d'autres filtres si besoin (par date, par type d'action...)
            # 
            # logs = query.order_by(ActivityLog.timestamp.desc()).all()
            # return [log.to_dict() for log in logs]
            
            return [] # Retourne une liste vide en attendant la vraie BD
            
        except Exception as e:
            print(f"❌ Erreur lors de la recherche des logs : {e}")
            return []