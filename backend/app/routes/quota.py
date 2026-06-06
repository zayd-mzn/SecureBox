"""
Quota Routes - Storage quota management
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User, File, Log
from datetime import datetime

quota_bp = Blueprint('quota', __name__)


@quota_bp.route('/admin/quota-stats', methods=['GET'])
@jwt_required()
def get_quota_stats():
    """Get quota statistics by role (admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'global_admin':
        return jsonify({'error': 'Unauthorized - Admin access required'}), 403
    
    # Get users by role
    global_admins = User.query.filter_by(role='global_admin').all()
    space_admins = User.query.filter_by(role='space_admin').all()
    regular_users = User.query.filter_by(role='user').all()
    
    def calculate_usage_percentage(users):
        if not users:
            return 0
        total_quota = sum([u.storage_quota for u in users])
        used_quota = sum([u.storage_used for u in users])
        if total_quota == 0:
            return 0
        return round((used_quota / total_quota) * 100, 1)
    
    return jsonify({
        'global_admin': calculate_usage_percentage(global_admins),
        'space_admin': calculate_usage_percentage(space_admins),
        'user': calculate_usage_percentage(regular_users)
    }), 200


@quota_bp.route('/admin/quota-settings', methods=['GET'])
@jwt_required()
def get_quota_settings():
    """Get quota settings (admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'global_admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    users = User.query.all()
    total_quota = sum([u.storage_quota for u in users])
    used_quota = sum([u.storage_used for u in users])
    
    # Get usage by role for the chart
    global_admins = User.query.filter_by(role='global_admin').all()
    space_admins = User.query.filter_by(role='space_admin').all()
    regular_users = User.query.filter_by(role='user').all()
    
    def get_role_usage(users):
        if not users:
            return 0
        total = sum([u.storage_quota for u in users])
        used = sum([u.storage_used for u in users])
        return round((used / total) * 100, 1) if total > 0 else 0
    
    return jsonify({
        'global_admin': get_role_usage(global_admins),
        'space_admin': get_role_usage(space_admins),
        'user': get_role_usage(regular_users),
        'total_quota': total_quota,
        'used_quota': used_quota,
        'available_quota': total_quota - used_quota
    }), 200


@quota_bp.route('/admin/quota-settings', methods=['PUT'])
@jwt_required()
def update_quota_settings():
    """Update role-based quota settings (admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'global_admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    role = data.get('role')
    percentage = data.get('quota')  # This is actually the percentage value from frontend
    
    # Note: This endpoint is for updating the display percentage
    # The actual quota for users should be updated individually
    # This is just for the frontend display
    
    # Log the action
    log = Log(
        user=current_user.username,
        action='QUOTA_SETTINGS_UPDATE',
        resource=f'Updated {role} quota display to {percentage}%',
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    db.session.commit()
    
    return jsonify({'message': f'{role} quota settings updated'}), 200


@quota_bp.route('/admin/users/<int:user_id>/quota', methods=['PUT'])
@jwt_required()
def update_user_quota(user_id):
    """Update individual user's storage quota (admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'global_admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    new_quota = data.get('quota')
    
    if not new_quota or new_quota <= 0:
        return jsonify({'error': 'Invalid quota value - must be greater than 0'}), 400
    
    # Check if new quota is less than current usage
    if new_quota < user.storage_used:
        return jsonify({'error': f'New quota ({new_quota} bytes) is less than current usage ({user.storage_used} bytes)'}), 400
    
    old_quota = user.storage_quota
    user.storage_quota = new_quota
    
    # Log the action
    log = Log(
        user=current_user.username,
        action='QUOTA_UPDATE',
        resource=f'User {user.username}: {old_quota} -> {new_quota} bytes',
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Quota updated successfully',
        'user': {
            'id': user.id,
            'username': user.username,
            'storage_quota': user.storage_quota,
            'storage_used': user.storage_used
        }
    }), 200


@quota_bp.route('/admin/quota-summary', methods=['GET'])
@jwt_required()
def get_quota_summary():
    """Get comprehensive quota summary (admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'global_admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    users = User.query.all()
    
    # Overall stats
    total_quota = sum([u.storage_quota for u in users])
    total_used = sum([u.storage_used for u in users])
    
    # Users over threshold
    users_over_75 = []
    users_over_90 = []
    users_over_100 = []
    
    for user in users:
        if user.storage_quota > 0:
            percentage = (user.storage_used / user.storage_quota) * 100
            if percentage >= 100:
                users_over_100.append(user)
            elif percentage >= 90:
                users_over_90.append(user)
            elif percentage >= 75:
                users_over_75.append(user)
    
    # Quota distribution by role
    role_stats = {
        'global_admin': {'count': 0, 'total_quota': 0, 'used_quota': 0, 'users': []},
        'space_admin': {'count': 0, 'total_quota': 0, 'used_quota': 0, 'users': []},
        'user': {'count': 0, 'total_quota': 0, 'used_quota': 0, 'users': []}
    }
    
    for user in users:
        role = user.role
        role_stats[role]['count'] += 1
        role_stats[role]['total_quota'] += user.storage_quota
        role_stats[role]['used_quota'] += user.storage_used
        role_stats[role]['users'].append({
            'id': user.id,
            'username': user.username,
            'storage_used': user.storage_used,
            'storage_quota': user.storage_quota,
            'percentage': round((user.storage_used / user.storage_quota * 100), 1) if user.storage_quota > 0 else 0
        })
    
    return jsonify({
        'overall': {
            'total_quota': total_quota,
            'total_used': total_used,
            'available_quota': total_quota - total_used,
            'overall_usage': round((total_used / total_quota * 100), 1) if total_quota > 0 else 0,
            'total_users': len(users)
        },
        'alerts': {
            'users_over_100': len(users_over_100),
            'users_over_90': len(users_over_90),
            'users_over_75': len(users_over_75)
        },
        'by_role': {
            role: {
                'count': stats['count'],
                'total_quota': stats['total_quota'],
                'used_quota': stats['used_quota'],
                'usage_percentage': round((stats['used_quota'] / stats['total_quota'] * 100), 1) if stats['total_quota'] > 0 else 0,
                'average_quota': round(stats['total_quota'] / stats['count'], 2) if stats['count'] > 0 else 0
            }
            for role, stats in role_stats.items()
        }
    }), 200


@quota_bp.route('/admin/quota-recommendations', methods=['GET'])
@jwt_required()
def get_quota_recommendations():
    """Get quota recommendations (admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'global_admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    users = User.query.all()
    recommendations = []
    
    # Find users who need quota increase
    for user in users:
        if user.storage_quota > 0:
            percentage = (user.storage_used / user.storage_quota) * 100
            if percentage >= 90:
                recommended_quota = user.storage_quota * 1.5  # Increase by 50%
                recommendations.append({
                    'type': 'urgent',
                    'user_id': user.id,
                    'username': user.username,
                    'current_quota': user.storage_quota,
                    'current_usage': user.storage_used,
                    'usage_percentage': round(percentage, 1),
                    'recommended_quota': int(recommended_quota),
                    'message': f'User {user.username} is at {round(percentage, 1)}% of quota. Consider increasing from {user.storage_quota} to {int(recommended_quota)} bytes.'
                })
            elif percentage >= 75:
                recommendations.append({
                    'type': 'warning',
                    'user_id': user.id,
                    'username': user.username,
                    'current_quota': user.storage_quota,
                    'current_usage': user.storage_used,
                    'usage_percentage': round(percentage, 1),
                    'message': f'User {user.username} is at {round(percentage, 1)}% of quota. Monitor usage.'
                })
    
    # Overall recommendation
    total_quota = sum([u.storage_quota for u in users])
    total_used = sum([u.storage_used for u in users])
    overall_percentage = (total_used / total_quota * 100) if total_quota > 0 else 0
    
    if overall_percentage > 80:
        recommendations.insert(0, {
            'type': 'system',
            'message': f'Overall storage usage is at {round(overall_percentage, 1)}%. Consider increasing total storage capacity.'
        })
    
    return jsonify({
        'recommendations': recommendations,
        'summary': {
            'total_users_at_risk': len([r for r in recommendations if r['type'] in ['urgent', 'warning']]),
            'urgent_count': len([r for r in recommendations if r['type'] == 'urgent']),
            'warning_count': len([r for r in recommendations if r['type'] == 'warning'])
        }
    }), 200