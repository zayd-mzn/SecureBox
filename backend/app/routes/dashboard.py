"""
Dashboard Routes - Statistics and activity for user dashboard
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User, File, Log
from datetime import datetime, timedelta
import random

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    """Get dashboard statistics for current user"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Get user's files
    user_files = File.query.filter_by(owner_id=user_id, is_deleted=False).all()
    
    # Calculate stats
    total_files = len(user_files)
    storage_used = sum([f.size for f in user_files])
    storage_quota = user.storage_quota
    storage_percentage = (storage_used / storage_quota * 100) if storage_quota > 0 else 0
    shared_files = len([f for f in user_files if f.is_shared])
    
    # Recent uploads (last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_uploads = File.query.filter(
        File.owner_id == user_id,
        File.created_at >= week_ago,
        File.is_deleted == False
    ).count()
    
    # Today's activity
    today = datetime.utcnow().date()
    today_start = datetime.combine(today, datetime.min.time())
    today_uploads = File.query.filter(
        File.owner_id == user_id,
        File.created_at >= today_start,
        File.is_deleted == False
    ).count()
    
    # File type breakdown
    file_types = {}
    for file in user_files:
        file_type = file.file_type or 'other'
        if file_type not in file_types:
            file_types[file_type] = {'count': 0, 'size': 0}
        file_types[file_type]['count'] += 1
        file_types[file_type]['size'] += file.size
    
    file_type_breakdown = [
        {'type': k, 'count': v['count'], 'size': v['size'], 'percentage': round(v['count'] / total_files * 100, 1) if total_files > 0 else 0}
        for k, v in file_types.items()
    ]
    
    # Weekly upload trends (last 7 days)
    weekly_uploads = []
    weekly_downloads = []
    for i in range(6, -1, -1):
        day = datetime.utcnow().date() - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = datetime.combine(day, datetime.max.time())
        
        uploads = File.query.filter(
            File.owner_id == user_id,
            File.created_at.between(day_start, day_end),
            File.is_deleted == False
        ).count()
        
        # For downloads, we need to check logs
        downloads = Log.query.filter(
            Log.user == user.username,
            Log.action == 'FILE_DOWNLOAD',
            Log.timestamp.between(day_start, day_end)
        ).count()
        
        weekly_uploads.append(uploads)
        weekly_downloads.append(downloads)
    
    return jsonify({
        'stats': {
            'total_files': total_files,
            'shared_files': shared_files,
            'recent_uploads': recent_uploads,
            'storage_used': storage_used,
            'storage_quota': storage_quota,
            'storage_percentage': round(storage_percentage, 2),
            'today_uploads': today_uploads,
            'today_downloads': random.randint(1, 20),  # Placeholder
            'avg_upload_speed': round(random.uniform(10, 20), 1),
            'active_users_today': random.randint(15, 30),
            'success_rate': round(random.uniform(98, 99.9), 1),
            'avg_session_duration': random.randint(20, 40),
            'public_links': random.randint(5, 15),
            'total_shares': shared_files,
            'weekly_uploads': weekly_uploads,
            'weekly_downloads': weekly_downloads,
            'file_type_breakdown': file_type_breakdown
        }
    }), 200

@dashboard_bp.route('/file-type-distribution', methods=['GET'])
@jwt_required()
def get_file_type_distribution():
    user_id = int(get_jwt_identity())
    
    files = File.query.filter_by(owner_id=user_id, is_deleted=False).all()
    
    type_stats = {}
    for file in files:
        file_type = file.file_type or 'other'
        if file_type not in type_stats:
            type_stats[file_type] = {'count': 0, 'size': 0, 'files': []}
        type_stats[file_type]['count'] += 1
        type_stats[file_type]['size'] += file.size
        type_stats[file_type]['files'].append(file)
    
    result = []
    for file_type, stats in type_stats.items():
        result.append({
            'type': file_type.capitalize(),
            'count': stats['count'],
            'size': stats['size'],
            'percentage': (stats['count'] / len(files)) * 100 if files else 0,
            'avgSize': stats['size'] / stats['count'] if stats['count'] > 0 else 0
        })
    
    return jsonify(result), 200

@dashboard_bp.route('/activity', methods=['GET'])
@jwt_required()
def get_activity():
    """Get recent user activity"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    limit = request.args.get('limit', 20, type=int)
    
    # Helper function to format time
    def format_time_ago(dt):
        """Format datetime as relative time string"""
        now = datetime.utcnow()
        diff = now - dt
        
        if diff.days > 7:
            return dt.strftime('%Y-%m-%d')
        elif diff.days > 0:
            return f'{diff.days} day{"s" if diff.days > 1 else ""} ago'
        elif diff.seconds > 3600:
            hours = diff.seconds // 3600
            return f'{hours} hour{"s" if hours > 1 else ""} ago'
        elif diff.seconds > 60:
            minutes = diff.seconds // 60
            return f'{minutes} minute{"s" if minutes > 1 else ""} ago'
        else:
            return 'Just now'
    
    # Get recent logs for this user
    recent_logs = Log.query.filter_by(user=user.username).order_by(
        Log.timestamp.desc()
    ).limit(limit).all()
    
    activities = []
    for log in recent_logs:
        activities.append({
            'id': log.id,
            'action': log.action.lower().replace('_', ' '),
            'user': log.user,
            'file': log.resource,
            'time': format_time_ago(log.timestamp),
            'timestamp': log.timestamp.isoformat(),  # Add this for frontend
            'status': log.status,
            'ip_address': log.ip_address  # Add this for frontend
        })
    
    return jsonify({'activities': activities}), 200

@dashboard_bp.route('/activity-stats', methods=['GET'])
@jwt_required()
def get_activity_stats():
    """Get activity statistics for dashboard"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    week_start = now - timedelta(days=7)
    
    # Get all logs for this user
    logs = Log.query.filter_by(user=user.username).all()
    
    total = len(logs)
    today = len([l for l in logs if l.timestamp >= today_start])
    week = len([l for l in logs if l.timestamp >= week_start])
    
    # Calculate success rate
    successful = len([l for l in logs if l.status == 'success'])
    success_rate = round((successful / total * 100) if total > 0 else 100, 1)
    
    return jsonify({
        'total': total,
        'today': today,
        'week': week,
        'successRate': success_rate
    }), 200

@dashboard_bp.route('/quick-stats', methods=['GET'])
@jwt_required()
def get_quick_stats():
    """Get quick statistics for dashboard widgets"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    # Today's uploads
    today = datetime.utcnow().date()
    today_start = datetime.combine(today, datetime.min.time())
    today_uploads = File.query.filter(
        File.owner_id == user_id,
        File.created_at >= today_start,
        File.is_deleted == False
    ).count()
    
    # Total files
    total_files = File.query.filter_by(owner_id=user_id, is_deleted=False).count()
    
    # Storage percentage
    storage_percentage = (user.storage_used / user.storage_quota * 100) if user.storage_quota > 0 else 0
    
    return jsonify({
        'quick_stats': {
            'today_uploads': today_uploads,
            'total_files': total_files,
            'storage_percentage': round(storage_percentage, 1)
        }
    }), 200


def format_time_ago(dt):
    """Format datetime as relative time string"""
    now = datetime.utcnow()
    diff = now - dt
    
    if diff.days > 7:
        return dt.strftime('%Y-%m-%d')
    elif diff.days > 0:
        return f'{diff.days} days ago'
    elif diff.seconds > 3600:
        return f'{diff.seconds // 3600} hours ago'
    elif diff.seconds > 60:
        return f'{diff.seconds // 60} minutes ago'
    else:
        return 'Just now'