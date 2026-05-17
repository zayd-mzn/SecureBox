"""
Logs Routes - Handle activity logs retrieval with role-based access
- Global Admin: Can see ALL logs from ALL users
- Space Admin: Can see logs from users in their space (users with role 'user' and 'space_admin')
- Standard User: Can only see their OWN logs
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User, Log
from datetime import datetime, timedelta

logs_bp = Blueprint('logs', __name__)


def get_space_user_ids(space_admin_id):
    """Get all user IDs that belong to the same space as a Space Admin"""
    space_admin = User.query.get(space_admin_id)
    if not space_admin:
        return []
    
    # Space Admin can see logs for:
    # 1. Themselves
    # 2. All regular users (role='user')
    # 3. Other Space Admins (role='space_admin')
    users_in_space = User.query.filter(
        User.role.in_(['user', 'space_admin']),
        User.is_active == True
    ).all()
    
    user_ids = [u.id for u in users_in_space]
    if space_admin_id not in user_ids:
        user_ids.append(space_admin_id)
    
    # Also get usernames for filtering
    usernames = [u.username for u in User.query.filter(User.id.in_(user_ids)).all()]
    
    return usernames


def get_accessible_logs(user):
    """Get logs that the current user can access based on their role"""
    if user.role == 'global_admin':
        # Global admin can see all logs
        return Log.query.all()
    
    elif user.role == 'space_admin':
        # Space admin can see logs from users in their space
        space_usernames = get_space_user_ids(user.id)
        if space_usernames:
            return Log.query.filter(Log.user.in_(space_usernames)).all()
        return []
    
    else:
        # Regular user can only see their own logs
        return Log.query.filter_by(user=user.username).all()


@logs_bp.route('/logs', methods=['GET'])
@jwt_required()
def get_logs():
    """Get activity logs based on user role"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if not current_user:
        return jsonify({'error': 'User not found'}), 404
    
    # Get query parameters for filtering
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    action_filter = request.args.get('action', None)
    status_filter = request.args.get('status', None)
    user_filter = request.args.get('user', None)
    date_from = request.args.get('date_from', None)
    date_to = request.args.get('date_to', None)
    
    # Get accessible logs based on role
    accessible_logs = get_accessible_logs(current_user)
    
    # Convert to list for filtering
    logs_list = accessible_logs
    
    # Apply filters
    if action_filter:
        logs_list = [l for l in logs_list if l.action == action_filter]
    
    if status_filter:
        logs_list = [l for l in logs_list if l.status == status_filter]
    
    if user_filter:
        logs_list = [l for l in logs_list if user_filter.lower() in (l.user or '').lower()]
    
    if date_from:
        from_date = datetime.fromisoformat(date_from)
        logs_list = [l for l in logs_list if l.timestamp >= from_date]
    
    if date_to:
        to_date = datetime.fromisoformat(date_to)
        logs_list = [l for l in logs_list if l.timestamp <= to_date]
    
    # Sort by timestamp descending
    logs_list.sort(key=lambda x: x.timestamp, reverse=True)
    
    # Paginate
    total = len(logs_list)
    start = (page - 1) * per_page
    end = start + per_page
    paginated_logs = logs_list[start:end]
    
    return jsonify([{
        'id': log.id,
        'user': log.user,
        'action': log.action,
        'resource': log.resource,
        'ip_address': log.ip_address,
        'status': log.status,
        'timestamp': log.timestamp.isoformat()
    } for log in paginated_logs]), 200


@logs_bp.route('/logs/search', methods=['GET'])
@jwt_required()
def search_logs():
    """Search logs with advanced filters based on user role"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if not current_user:
        return jsonify({'error': 'User not found'}), 404
    
    query = request.args.get('q', '').lower()
    action_filter = request.args.get('action', 'all')
    status_filter = request.args.get('status', 'all')
    sort_by = request.args.get('sort_by', 'date_desc')
    
    # Get accessible logs based on role
    logs = get_accessible_logs(current_user)
    
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
    """Get statistics about logs based on user role"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if not current_user:
        return jsonify({'error': 'User not found'}), 404
    
    # Get last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    
    # Get accessible logs based on role
    all_accessible_logs = get_accessible_logs(current_user)
    
    # Filter logs within last 30 days
    recent_logs = [l for l in all_accessible_logs if l.timestamp >= thirty_days_ago]
    
    # Count by action
    action_counts = {}
    for log in recent_logs:
        action = log.action
        action_counts[action] = action_counts.get(action, 0) + 1
    
    # Get most active users (within accessible scope)
    user_counts = {}
    for log in recent_logs:
        user = log.user
        if user:
            user_counts[user] = user_counts.get(user, 0) + 1
    
    most_active_users = sorted(user_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    
    # Calculate success rate
    success_count = len([l for l in recent_logs if l.status == 'success'])
    success_rate = round((success_count / len(recent_logs) * 100), 1) if recent_logs else 100
    
    return jsonify({
        'total_logs': len(all_accessible_logs),
        'logs_last_30_days': len(recent_logs),
        'action_counts': action_counts,
        'most_active_users': [{'user': u, 'count': c} for u, c in most_active_users],
        'success_rate': success_rate,
        'user_role': current_user.role
    }), 200


@logs_bp.route('/logs/user/<string:username>', methods=['GET'])
@jwt_required()
def get_user_logs(username):
    """Get logs for a specific user (admin and space admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    if not current_user:
        return jsonify({'error': 'User not found'}), 404
    
    # Check permissions
    if current_user.role == 'global_admin':
        # Global admin can see any user's logs
        pass
    elif current_user.role == 'space_admin':
        # Space admin can only see logs of users in their space
        space_usernames = get_space_user_ids(current_user.id)
        if username not in space_usernames:
            return jsonify({'error': 'Unauthorized to view this user\'s logs'}), 403
    else:
        # Regular user can only see their own logs
        if username != current_user.username:
            return jsonify({'error': 'Unauthorized to view other users\' logs'}), 403
    
    target_user = User.query.filter_by(username=username).first()
    if not target_user:
        return jsonify({'error': 'User not found'}), 404
    
    # Get logs for the target user
    logs = Log.query.filter_by(user=username).order_by(Log.timestamp.desc()).limit(100).all()
    
    return jsonify([{
        'id': log.id,
        'user': log.user,
        'action': log.action,
        'resource': log.resource,
        'ip_address': log.ip_address,
        'status': log.status,
        'timestamp': log.timestamp.isoformat()
    } for log in logs]), 200


@logs_bp.route('/logs/export', methods=['GET'])
@jwt_required()
def export_logs():
    """Export logs to CSV (admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)
    
    # Only global admin can export logs
    if current_user.role != 'global_admin':
        return jsonify({'error': 'Unauthorized - Admin access required'}), 403
    
    # Get all logs (or filtered)
    date_from = request.args.get('date_from', None)
    date_to = request.args.get('date_to', None)
    
    query = Log.query.order_by(Log.timestamp.desc())
    
    if date_from:
        query = query.filter(Log.timestamp >= datetime.fromisoformat(date_from))
    if date_to:
        query = query.filter(Log.timestamp <= datetime.fromisoformat(date_to))
    
    logs = query.all()
    
    # Create CSV content
    import csv
    import io
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID', 'User', 'Action', 'Resource', 'IP Address', 'Status', 'Timestamp'])
    
    for log in logs:
        writer.writerow([
            log.id,
            log.user or '',
            log.action,
            log.resource or '',
            log.ip_address or '',
            log.status,
            log.timestamp.isoformat()
        ])
    
    return jsonify({
        'csv_content': output.getvalue(),
        'count': len(logs)
    }), 200