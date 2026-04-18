from .extensions import db
from datetime import datetime, timezone
import enum

# ==========================================
# ÉNUMÉRATIONS (Traduites de l'UML)
# ==========================================
class PermissionType(enum.Enum):
    READ = "READ"
    WRITE = "WRITE"
    DELETE = "DELETE"
    SHARE = "SHARE"

class LockType(enum.Enum):
    PESSIMISTIC = "PESSIMISTIC"
    OPTIMISTIC = "OPTIMISTIC"

# ==========================================
# TABLES DE LA BASE DE DONNÉES
# ==========================================
class User(db.Model):
    __tablename__ = "users"
    # --- La base de Jawad ---
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), default='user')
    mfa_enabled = db.Column(db.Boolean, default=False)
    mfa_secret = db.Column(db.String(32), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # --- Les champs ajoutés pour la sécurité et l'UML ---
    failed_attempts = db.Column(db.Integer, default=0)
    locked_until = db.Column(db.DateTime, nullable=True)
    storage_used = db.Column(db.BigInteger, default=0)
    storage_max = db.Column(db.BigInteger, default=536870912) # Quota de 500 MB

    def __repr__(self):
        return f'<User {self.username}>'

# --- Les nouvelles tables pour le reste du projet ---

class File(db.Model):
    __tablename__ = 'files'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    storage_path = db.Column(db.String(512), nullable=False)
    mime_type = db.Column(db.String(128))
    size = db.Column(db.BigInteger, nullable=False)
    is_encrypted = db.Column(db.Boolean, default=True)
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    folder_id = db.Column(db.Integer, nullable=True)
    locked_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    lock_type = db.Column(db.Enum(LockType), nullable=True)
    lock_expires_at = db.Column(db.DateTime, nullable=True)

class FileVersion(db.Model):
    __tablename__ = 'file_versions'
    id = db.Column(db.Integer, primary_key=True)
    file_id = db.Column(db.Integer, db.ForeignKey('files.id'), nullable=False)
    version_number = db.Column(db.Integer, nullable=False)
    storage_path = db.Column(db.String(512), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    checksum = db.Column(db.String(64), nullable=False) # Empreinte SHA-256
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

class ACL(db.Model):
    __tablename__ = 'acls'
    id = db.Column(db.Integer, primary_key=True)
    target_id = db.Column(db.Integer, nullable=False)
    target_type = db.Column(db.String(50), nullable=False) # 'FILE' ou 'FOLDER'
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    permission = db.Column(db.Enum(PermissionType), nullable=False)
    granted_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

class ActivityLog(db.Model):
    __tablename__ = 'activity_logs'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    action = db.Column(db.String(50), nullable=False)
    target_id = db.Column(db.Integer, nullable=True)
    ip_address = db.Column(db.String(45))
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    success = db.Column(db.Boolean, default=True)