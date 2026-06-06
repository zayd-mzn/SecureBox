"""
Admin Routes - System stats and quota management
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User, File
from datetime import datetime

admin_bp = Blueprint('admin', __name__)


@admin_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_admin_stats():
    """Get system statistics (admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'global_admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    total_users = User.query.count()
    total_files = File.query.filter_by(is_deleted=False).count()
    total_storage = sum([f.size for f in File.query.filter_by(is_deleted=False).all()])
    active_users = User.query.filter_by(is_active=True).count()
    
    return jsonify({
        'total_users': total_users,
        'total_files': total_files,
        'total_storage': total_storage,
        'active_users': active_users
    }), 200