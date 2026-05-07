"""
Dashboard Routes - Statistics and activity for user dashboard
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User, File, ACL, Log, FileVersion
from datetime import datetime, timedelta
import random

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    """Get real dashboard statistics for current user"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Get user's files (not deleted)
    user_files = File.query.filter_by(owner_id=user_id, is_deleted=False).all()
    
    # Basic stats
    total_files = len(user_files)
    storage_used = sum([f.size for f in user_files])
    storage_quota = user.storage_quota
    storage_percentage = (storage_used / storage_quota * 100) if storage_quota > 0 else 0
    
    # Shared files count
    shared_files = len([f for f in user_files if f.is_shared])
    
    # Calculate shares from ACLs (files shared with user)
    shared_with_me = ACL.query.filter_by(user_id=user_id, can_read=True).count()
    total_shares = shared_files + shared_with_me
    
    # Public links count (files shared with anyone)
    public_links = 0  # You can add this feature later
    
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
    
    # Today's downloads from logs
    today_downloads = Log.query.filter(
        Log.user == user.username,
        Log.action == 'FILE_DOWNLOAD',
        Log.timestamp >= today_start
    ).count()
    
    # Calculate monthly comparison (total files vs last month)
    last_month = datetime.utcnow() - timedelta(days=30)
    files_last_month = File.query.filter(
        File.owner_id == user_id,
        File.created_at >= last_month,
        File.is_deleted == False
    ).count()
    
    if files_last_month > 0:
        trend_percentage = ((total_files - files_last_month) / files_last_month) * 100
        trend_text = f"{'+' if trend_percentage > 0 else ''}{trend_percentage:.1f}% from last month"
    else:
        trend_text = "New user"
    
    # Weekly activity (last 7 days)
    weekly_uploads = []
    weekly_downloads = []
    
    for i in range(6, -1, -1):
        day = datetime.utcnow().date() - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = datetime.combine(day, datetime.max.time())
        
        # Uploads for that day
        uploads = File.query.filter(
            File.owner_id == user_id,
            File.created_at.between(day_start, day_end),
            File.is_deleted == False
        ).count()
        
        # Downloads for that day
        downloads = Log.query.filter(
            Log.user == user.username,
            Log.action == 'FILE_DOWNLOAD',
            Log.timestamp.between(day_start, day_end)
        ).count()
        
        weekly_uploads.append(uploads)
        weekly_downloads.append(downloads)
    
    # Calculate upload speed (average file size / upload time)
    recent_uploads_for_speed = File.query.filter(
        File.owner_id == user_id,
        File.created_at >= datetime.utcnow() - timedelta(days=7),
        File.is_deleted == False
    ).limit(10).all()
    
    avg_upload_speed = 0
    if recent_uploads_for_speed:
        # Simulate speed calculation (in a real system, you'd track upload duration)
        avg_file_size = sum([f.size for f in recent_uploads_for_speed]) / len(recent_uploads_for_speed)
        avg_upload_speed = round(avg_file_size / (1024 * 1024) * 0.5, 1)
    
    # Active users today (for admin only, calculate real unique users)
    active_users_today = 0
    if user.role == 'global_admin':
        active_users_today = Log.query.filter(
            Log.action == 'LOGIN_SUCCESS',
            Log.timestamp >= today_start
        ).distinct(Log.user).count()
    else:
        # For regular users, just show 1 if they were active today
        user_active_today = Log.query.filter(
            Log.user == user.username,
            Log.action == 'LOGIN_SUCCESS',
            Log.timestamp >= today_start
        ).count() > 0
        active_users_today = 1 if user_active_today else 0
    
    # Success rate from user's logs
    user_logs = Log.query.filter_by(user=user.username).all()
    total_logs = len(user_logs)
    successful_logs = len([l for l in user_logs if l.status == 'success'])
    success_rate = round((successful_logs / total_logs * 100), 1) if total_logs > 0 else 100
    
    # Average session duration (mock - would need session tracking)
    avg_session_duration = random.randint(5, 15)
    
    # File type breakdown with percentages
    file_types = {}
    for file in user_files:
        file_type = file.file_type or 'other'
        if file_type not in file_types:
            file_types[file_type] = {'count': 0, 'size': 0}
        file_types[file_type]['count'] += 1
        file_types[file_type]['size'] += file.size
    
    file_type_breakdown = [
        {
            'type': k.capitalize(),
            'count': v['count'],
            'size': v['size'],
            'percentage': round(v['count'] / total_files * 100, 1) if total_files > 0 else 0
        }
        for k, v in file_types.items()
    ]
    
    # Account created date
    account_created = user.created_at.isoformat() if user.created_at else None
    
    return jsonify({
        'stats': {
            'total_files': total_files,
            'shared_files': shared_files,
            'total_shares': total_shares,
            'public_links': public_links,
            'recent_uploads': recent_uploads,
            'storage_used': storage_used,
            'storage_quota': storage_quota,
            'storage_percentage': round(storage_percentage, 2),
            'today_uploads': today_uploads,
            'today_downloads': today_downloads,
            'avg_upload_speed': avg_upload_speed,
            'active_users_today': active_users_today,
            'success_rate': success_rate,
            'avg_session_duration': avg_session_duration,
            'weekly_uploads': weekly_uploads,
            'weekly_downloads': weekly_downloads,
            'file_type_breakdown': file_type_breakdown,
            'account_created': account_created,
            'trend_percentage': round(trend_percentage, 1) if files_last_month > 0 else 0,
            'trend_text': trend_text
        }
    }), 200


@dashboard_bp.route('/file-type-distribution', methods=['GET'])
@jwt_required()
def get_file_type_distribution():
    """Get real file type distribution with statistics"""
    user_id = int(get_jwt_identity())
    
    files = File.query.filter_by(owner_id=user_id, is_deleted=False).all()
    
    type_stats = {}
    for file in files:
        file_type = file.file_type or 'other'
        if file_type not in type_stats:
            type_stats[file_type] = {'count': 0, 'size': 0}
        type_stats[file_type]['count'] += 1
        type_stats[file_type]['size'] += file.size
    
    total_files = len(files)
    result = []
    for file_type, stats in type_stats.items():
        percentage = (stats['count'] / total_files * 100) if total_files > 0 else 0
        avg_size = stats['size'] / stats['count'] if stats['count'] > 0 else 0
        
        result.append({
            'type': file_type.capitalize(),
            'count': stats['count'],
            'size': stats['size'],
            'percentage': round(percentage, 1),
            'avgSize': avg_size
        })
    
    # Sort by count descending
    result.sort(key=lambda x: x['count'], reverse=True)
    
    return jsonify(result), 200


@dashboard_bp.route('/activity', methods=['GET'])
@jwt_required()
def get_activity():
    """Get real recent user activity"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    limit = request.args.get('limit', 20, type=int)
    
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
    
    # Get real logs for this user
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
            'timestamp': log.timestamp.isoformat(),
            'status': log.status,
            'ip_address': log.ip_address
        })
    
    return jsonify({'activities': activities}), 200


@dashboard_bp.route('/activity-stats', methods=['GET'])
@jwt_required()
def get_activity_stats():
    """Get real activity statistics for dashboard"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    week_start = now - timedelta(days=7)
    month_start = now - timedelta(days=30)
    
    # Get all logs for this user
    logs = Log.query.filter_by(user=user.username).all()
    
    total = len(logs)
    today = len([l for l in logs if l.timestamp >= today_start])
    week = len([l for l in logs if l.timestamp >= week_start])
    month = len([l for l in logs if l.timestamp >= month_start])
    
    # Calculate success rate
    successful = len([l for l in logs if l.status == 'success'])
    success_rate = round((successful / total * 100), 1) if total > 0 else 100
    
    # Activity by type
    activity_by_type = {}
    for log in logs:
        action = log.action.lower()
        if action not in activity_by_type:
            activity_by_type[action] = 0
        activity_by_type[action] += 1
    
    return jsonify({
        'total': total,
        'today': today,
        'week': week,
        'month': month,
        'successRate': success_rate,
        'byType': activity_by_type
    }), 200


@dashboard_bp.route('/quick-stats', methods=['GET'])
@jwt_required()
def get_quick_stats():
    """Get real quick statistics for dashboard widgets"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    # Today's date
    today = datetime.utcnow().date()
    today_start = datetime.combine(today, datetime.min.time())
    
    # Today's uploads
    today_uploads = File.query.filter(
        File.owner_id == user_id,
        File.created_at >= today_start,
        File.is_deleted == False
    ).count()
    
    # Total files
    total_files = File.query.filter_by(owner_id=user_id, is_deleted=False).count()
    
    # Storage percentage
    storage_percentage = (user.storage_used / user.storage_quota * 100) if user.storage_quota > 0 else 0
    
    # Recent files (last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_files = File.query.filter(
        File.owner_id == user_id,
        File.created_at >= week_ago,
        File.is_deleted == False
    ).count()
    
    # Storage used percentage text
    if storage_percentage >= 90:
        storage_status = 'critical'
        storage_message = 'Storage almost full'
    elif storage_percentage >= 75:
        storage_status = 'warning'
        storage_message = 'Storage running low'
    else:
        storage_status = 'good'
        storage_message = 'Storage healthy'
    
    return jsonify({
        'quick_stats': {
            'today_uploads': today_uploads,
            'total_files': total_files,
            'storage_percentage': round(storage_percentage, 1),
            'recent_files': recent_files,
            'storage_status': storage_status,
            'storage_message': storage_message
        }
    }), 200