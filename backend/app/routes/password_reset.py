import os
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText

from flask import Blueprint, jsonify, request
from ..extensions import bcrypt, db
from ..models import User

password_reset_bp = Blueprint('password_reset', __name__, url_prefix='/api/auth')

OTP_EXPIRY_MINUTES = 5


def _send_otp_email(to_email: str, otp: str):
    smtp_host = os.getenv("SMTP_HOST", "localhost")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    smtp_from = os.getenv("SMTP_FROM", smtp_user)

    msg = MIMEText(
        f"Your SecureBox password reset code is: {otp}\n\n"
        f"It expires in {OTP_EXPIRY_MINUTES} minutes. If you did not request this, ignore this email."
    )
    msg["Subject"] = "SecureBox — Password Reset Code"
    msg["From"] = smtp_from
    msg["To"] = to_email

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.ehlo()
        if smtp_port != 25:
            server.starttls()
        if smtp_user and smtp_pass:
            server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_from, [to_email], msg.as_string())


@password_reset_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = (data or {}).get('email', '').strip().lower()

    if not email:
        return jsonify({'error': 'Email is required'}), 400

    user = User.query.filter_by(email=email).first()

    # Always return 200 to avoid user enumeration
    if not user or not user.is_active:
        return jsonify({'message': 'If that email exists, a reset code has been sent'}), 200

    otp = f"{secrets.randbelow(1_000_000):06d}"
    user.reset_otp_hash = bcrypt.generate_password_hash(otp).decode('utf-8')
    user.reset_otp_expires = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)

    try:
        db.session.commit()
        _send_otp_email(user.email, otp)
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Could not send reset email. Please try again.'}), 500

    return jsonify({'message': 'If that email exists, a reset code has been sent'}), 200


@password_reset_bp.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    otp = data.get('otp', '').strip()
    new_password = data.get('new_password', '')
    confirm_password = data.get('confirm_password', '')

    if not all([email, otp, new_password, confirm_password]):
        return jsonify({'error': 'All fields are required'}), 400

    user = User.query.filter_by(email=email).first()

    invalid = (
        not user
        or not user.reset_otp_hash
        or not user.reset_otp_expires
        or datetime.now(timezone.utc) > user.reset_otp_expires.replace(tzinfo=timezone.utc)
        or not bcrypt.check_password_hash(user.reset_otp_hash, otp)
    )
    if invalid:
        return jsonify({'error': 'Invalid or expired reset code'}), 400

    if new_password != confirm_password:
        return jsonify({'error': 'Passwords do not match'}), 400

    # Reuse existing password strength check
    from .register import is_strong_password
    valid, msg = is_strong_password(new_password)
    if not valid:
        return jsonify({'error': msg}), 400

    user.password_hash = bcrypt.generate_password_hash(new_password).decode('utf-8')
    user.reset_otp_hash = None
    user.reset_otp_expires = None
    db.session.commit()

    return jsonify({'message': 'Password updated successfully'}), 200
