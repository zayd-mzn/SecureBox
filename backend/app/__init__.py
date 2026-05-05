import os
from flask import Flask
from .extensions import bcrypt, db, cors, jwt
from dotenv import load_dotenv

load_dotenv() # load the environment variables

def create_app(test_config=None):
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL")
    app.config["JWT_SECRET_KEY"] = os.getenv("SECRET_KEY")

    # Initialization
    db.init_app(app)
    bcrypt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": "http://localhost:.*"}})
    jwt.init_app(app)

    # Register blueprints
    from .routes.auth import auth_bp
    app.register_blueprint(auth_bp)
    
    # Concerne la page register (mohammed)
    from .routes.register import register_bp
    app.register_blueprint(register_bp)

    from .routes.password_reset import password_reset_bp
    app.register_blueprint(password_reset_bp)

    # Create tables if they don't exist
    with app.app_context():
        db.create_all()

    return app
