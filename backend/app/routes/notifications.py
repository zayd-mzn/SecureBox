"""
Notifications Routes - Handle user notifications
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User, Notification, Log
from datetime import datetime

notifications_bp = Blueprint('notifications', __name__)


@notifications_bp.route('/notifications', methods=['GET'])
@jwt_required()
def get_notifications():
    """Get all notifications for current user"""
    user_id = int(get_jwt_identity())
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    only_unread = request.args.get('only_unread', 'false').lower() == 'true'
    
    query = Notification.query.filter_by(user_id=user_id)
    
    if only_unread:
        query = query.filter_by(is_read=False)
    
    notifications = query.order_by(Notification.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return jsonify({
        'notifications': [n.to_dict() for n in notifications.items],
        'total': notifications.total,
        'page': notifications.page,
        'pages': notifications.pages,
        'per_page': notifications.per_page
    }), 200


@notifications_bp.route('/notifications/unread-count', methods=['GET'])
@jwt_required()
def get_unread_count():
    """Get unread notifications count for current user"""
    user_id = int(get_jwt_identity())
    
    count = Notification.query.filter_by(user_id=user_id, is_read=False).count()
    
    return jsonify({'count': count}), 200


@notifications_bp.route('/notifications/<int:notification_id>/read', methods=['PUT'])
@jwt_required()
def mark_as_read(notification_id):
    """Mark a specific notification as read"""
    user_id = int(get_jwt_identity())
    
    notification = Notification.query.filter_by(id=notification_id, user_id=user_id).first()
    
    if not notification:
        return jsonify({'error': 'Notification not found'}), 404
    
    notification.is_read = True
    notification.read_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({'message': 'Notification marked as read'}), 200


@notifications_bp.route('/notifications/read-all', methods=['PUT'])
@jwt_required()
def mark_all_as_read():
    """Mark all notifications as read for current user"""
    user_id = int(get_jwt_identity())
    
    Notification.query.filter_by(user_id=user_id, is_read=False).update({
        'is_read': True,
        'read_at': datetime.utcnow()
    })
    
    db.session.commit()
    
    return jsonify({'message': 'All notifications marked as read'}), 200


@notifications_bp.route('/notifications/<int:notification_id>', methods=['DELETE'])
@jwt_required()
def delete_notification(notification_id):
    """Delete a specific notification"""
    user_id = int(get_jwt_identity())
    
    notification = Notification.query.filter_by(id=notification_id, user_id=user_id).first()
    
    if not notification:
        return jsonify({'error': 'Notification not found'}), 404
    
    db.session.delete(notification)
    db.session.commit()
    
    return jsonify({'message': 'Notification deleted'}), 200


def create_notification(user_id, title, message, notification_type='info', 
                        resource_type=None, resource_id=None):
    """Helper function to create a notification"""
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notification_type,
        resource_type=resource_type,
        resource_id=resource_id,
        created_at=datetime.utcnow()
    )
    db.session.add(notification)
    db.session.commit()
    return notification

@notifications_bp.route('/notifications/delete-all', methods=['DELETE'])
@jwt_required()
def delete_all_notifications():
    """Delete all notifications for current user"""
    user_id = int(get_jwt_identity())
    
    # Delete all notifications for this user
    deleted_count = Notification.query.filter_by(user_id=user_id).delete()
    
    db.session.commit()
    
    return jsonify({
        'message': f'Successfully deleted {deleted_count} notifications',
        'deleted_count': deleted_count
    }), 200