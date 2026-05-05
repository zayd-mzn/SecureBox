import os
from flask import Flask
from flask_jwt_extended import JWTManager
from .extensions import bcrypt, db, cors
from dotenv import load_dotenv
from datetime import timedelta

load_dotenv() # load the environment variables

def create_app(test_config=None):
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-key")
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///app.db")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "jwt-secret-key")
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=24)

    # Initialize extensions
    db.init_app(app)
    bcrypt.init_app(app)
    cors.init_app(app,
        resources={r"/api/*": {"origins": "http://localhost:3000"}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    )

    # Initialize JWT
    jwt = JWTManager(app)

    # Register blueprints
    from .routes.auth import auth_bp
    from .routes.register import register_bp
    from .routes.files import files_bp
    from .routes.admin import admin_bp
    from .routes.dashboard import dashboard_bp
    from .routes.avatar import avatar_bp
    from .routes.notifications import notifications_bp
    from .routes.logs import logs_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(register_bp, url_prefix='/api/auth')
    app.register_blueprint(files_bp, url_prefix='/api')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    app.register_blueprint(avatar_bp, url_prefix='/api')
    app.register_blueprint(notifications_bp, url_prefix='/api')
    app.register_blueprint(logs_bp, url_prefix='/api')

    # Create tables
    with app.app_context():
        db.create_all()

    return app