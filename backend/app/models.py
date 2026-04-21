from .extensions import db
from datetime import datetime

class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), default='user')
    mfa_enabled = db.Column(db.Boolean, default=False)
    mfa_secret = db.Column(db.String(32), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    storage_quota = db.Column(db.BigInteger, default=5368709120)  # 5GB default
    storage_used = db.Column(db.BigInteger, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<User {self.username}>'


class File(db.Model):
    __tablename__ = "files"
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    file_type = db.Column(db.String(100))
    size = db.Column(db.BigInteger, nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    is_shared = db.Column(db.Boolean, default=False)
    is_deleted = db.Column(db.Boolean, default=False)
    is_locked = db.Column(db.Boolean, default=False)
    locked_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    locked_at = db.Column(db.DateTime, nullable=True)
    version = db.Column(db.Integer, default=1)
    checksum = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    owner = db.relationship('User', foreign_keys=[owner_id], backref='files')
    locker = db.relationship('User', foreign_keys=[locked_by])

    def __repr__(self):
        return f'<File {self.original_filename}>'


class FileVersion(db.Model):
    __tablename__ = "file_versions"
    id = db.Column(db.Integer, primary_key=True)
    file_id = db.Column(db.Integer, db.ForeignKey('files.id'), nullable=False)
    version = db.Column(db.Integer, nullable=False)
    author = db.Column(db.String(80), nullable=False)
    size = db.Column(db.BigInteger, nullable=False)
    comment = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    file = db.relationship('File', backref='versions')


class ACL(db.Model):
    __tablename__ = "acls"
    id = db.Column(db.Integer, primary_key=True)
    file_id = db.Column(db.Integer, db.ForeignKey('files.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    can_read = db.Column(db.Boolean, default=False)
    can_write = db.Column(db.Boolean, default=False)
    can_delete = db.Column(db.Boolean, default=False)
    can_share = db.Column(db.Boolean, default=False)
    granted_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    granted_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    file = db.relationship('File', backref='acls')
    user = db.relationship('User', foreign_keys=[user_id])
    granter = db.relationship('User', foreign_keys=[granted_by])


class Log(db.Model):
    __tablename__ = "logs"
    id = db.Column(db.Integer, primary_key=True)
    user = db.Column(db.String(80))
    action = db.Column(db.String(100), nullable=False)
    resource = db.Column(db.String(255))
    ip_address = db.Column(db.String(45))
    status = db.Column(db.String(20), default='success')
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)


class DeletedFile(db.Model):
    __tablename__ = "deleted_files"
    id = db.Column(db.Integer, primary_key=True)
    original_id = db.Column(db.Integer)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    size = db.Column(db.BigInteger, nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    file_type = db.Column(db.String(100))
    deleted_date = db.Column(db.DateTime, default=datetime.utcnow)
    permanent_delete_days = db.Column(db.Integer, default=30)