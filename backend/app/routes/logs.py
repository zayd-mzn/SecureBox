"""
Logs Routes - Handle activity logs retrieval
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User, Log
from datetime import datetime, timedelta

logs_bp = Blueprint('logs', __name__)


@logs_bp.route('/logs', methods=['GET'])
@jwt_required()
def get_logs():
    """Get all activity logs (admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    # Only global_admin can view logs
    if current_user.role != 'global_admin':
        return jsonify({'error': 'Unauthorized - Admin access required'}), 403
    
    # Get query parameters for filtering
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    action_filter = request.args.get('action', None)
    status_filter = request.args.get('status', None)
    user_filter = request.args.get('user', None)
    date_from = request.args.get('date_from', None)
    date_to = request.args.get('date_to', None)
    
    # Start query
    query = Log.query
    
    # Apply filters
    if action_filter:
        query = query.filter(Log.action == action_filter)
    if status_filter:
        query = query.filter(Log.status == status_filter)
    if user_filter:
        query = query.filter(Log.user.ilike(f'%{user_filter}%'))
    if date_from:
        query = query.filter(Log.timestamp >= datetime.fromisoformat(date_from))
    if date_to:
        query = query.filter(Log.timestamp <= datetime.fromisoformat(date_to))
    
    # Order by timestamp descending (newest first)
    query = query.order_by(Log.timestamp.desc())
    
    # Paginate
    paginated_logs = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify([{
        'id': log.id,
        'user': log.user,
        'action': log.action,
        'resource': log.resource,
        'ip_address': log.ip_address,
        'status': log.status,
        'timestamp': log.timestamp.isoformat()
    } for log in paginated_logs.items]), 200


@logs_bp.route('/logs/search', methods=['GET'])
@jwt_required()
def search_logs():
    """Search logs with advanced filters"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'global_admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    query = request.args.get('q', '').lower()
    action_filter = request.args.get('action', 'all')
    status_filter = request.args.get('status', 'all')
    sort_by = request.args.get('sort_by', 'date_desc')
    
    logs = Log.query.all()
    
    # Filter by search query
    if query:
        logs = [l for l in logs if 
                query in (l.user or '').lower() or 
                query in (l.action or '').lower() or 
                query in (l.resource or '').lower() or 
                query in (l.ip_address or '')]
    
    # Filter by action
    if action_filter != 'all':
        logs = [l for l in logs if l.action.lower() == action_filter.lower()]
    
    # Filter by status
    if status_filter != 'all':
        logs = [l for l in logs if l.status == status_filter]
    
    # Sort results
    if sort_by == 'date_desc':
        logs.sort(key=lambda x: x.timestamp, reverse=True)
    elif sort_by == 'date_asc':
        logs.sort(key=lambda x: x.timestamp)
    elif sort_by == 'user_asc':
        logs.sort(key=lambda x: x.user or '')
    elif sort_by == 'user_desc':
        logs.sort(key=lambda x: x.user or '', reverse=True)
    
    return jsonify([{
        'id': l.id,
        'user': l.user,
        'action': l.action,
        'resource': l.resource,
        'ip_address': l.ip_address,
        'status': l.status,
        'timestamp': l.timestamp.isoformat()
    } for l in logs]), 200


@logs_bp.route('/logs/stats', methods=['GET'])
@jwt_required()
def get_logs_stats():
    """Get statistics about logs"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'global_admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Get last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    recent_logs = Log.query.filter(Log.timestamp >= thirty_days_ago).all()
    
    # Count by action
    action_counts = {}
    for log in recent_logs:
        action = log.action
        action_counts[action] = action_counts.get(action, 0) + 1
    
    # Get most active users
    user_counts = {}
    for log in recent_logs:
        user = log.user
        if user:
            user_counts[user] = user_counts.get(user, 0) + 1
    
    most_active_users = sorted(user_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    
    return jsonify({
        'total_logs': Log.query.count(),
        'logs_last_30_days': len(recent_logs),
        'action_counts': action_counts,
        'most_active_users': [{'user': u, 'count': c} for u, c in most_active_users],
        'success_rate': round((len([l for l in recent_logs if l.status == 'success']) / len(recent_logs) * 100) if recent_logs else 0, 1)
    }), 200