import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './NotificationPanel.css';

const NotificationPanel = ({ onClose }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const panelRef = useRef(null);

  const API_URL = 'http://localhost:5000/api';

  useEffect(() => {
    fetchNotifications();
    
    // Close panel when clicking outside
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(response.data.notifications);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err.response?.data?.error || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.put(`${API_URL}/notifications/${notificationId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update local state
      setNotifications(notifications.map(notif => 
        notif.id === notificationId ? { ...notif, is_read: true } : notif
      ));
      
      // Update notification count in parent (optional - you can trigger a refresh)
      if (window.updateNotificationCount) {
        window.updateNotificationCount();
      }
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.put(`${API_URL}/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update local state
      setNotifications(notifications.map(notif => ({ ...notif, is_read: true })));
      
      // Update notification count
      if (window.updateNotificationCount) {
        window.updateNotificationCount();
      }
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.delete(`${API_URL}/notifications/${notificationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update local state
      setNotifications(notifications.filter(notif => notif.id !== notificationId));
      
      // Update notification count
      if (window.updateNotificationCount) {
        window.updateNotificationCount();
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const deleteAllNotifications = async () => {
    if (notifications.length === 0) return;
    
    // Show confirmation dialog
    const confirmed = window.confirm(`Are you sure you want to delete all ${notifications.length} notifications? This action cannot be undone.`);
    
    if (!confirmed) return;
    
    try {
        setDeleting(true);
        const token = localStorage.getItem('access_token');
        
        // Use batch delete endpoint (more efficient)
        await axios.delete(`${API_URL}/notifications/delete-all`, {
        headers: { Authorization: `Bearer ${token}` }
        });
        
        // Clear local state
        setNotifications([]);
        
        // Update notification count
        if (window.updateNotificationCount) {
        window.updateNotificationCount();
        }
    } catch (err) {
        console.error('Error deleting all notifications:', err);
        setError('Failed to delete notifications. Please try again.');
    } finally {
        setDeleting(false);
    }
    };

  const getNotificationIcon = (type) => {
    switch(type) {
      case 'success': return 'fa-check-circle';
      case 'warning': return 'fa-exclamation-triangle';
      case 'error': return 'fa-times-circle';
      default: return 'fa-info-circle';
    }
  };

  const getNotificationColor = (type) => {
    switch(type) {
      case 'success': return '#48bb78';
      case 'warning': return '#ed8936';
      case 'error': return '#e53e3e';
      default: return '#4299e1';
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="notification-panel" ref={panelRef}>
      <div className="notification-header">
        <h3>
          <i className="fas fa-bell"></i>
          Notifications
          {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
        </h3>
        <div className="notification-actions">
          {notifications.length > 0 && (
            <button 
              className="delete-all-btn" 
              onClick={deleteAllNotifications}
              disabled={deleting}
              title="Delete all notifications"
            >
              <i className="fas fa-trash-alt"></i>
              <span>Delete All</span>
            </button>
          )}
          {unreadCount > 0 && (
            <button className="mark-all-read" onClick={markAllAsRead}>
              <i className="fas fa-check-double"></i>
              <span>Mark all read</span>
            </button>
          )}
          <button className="close-panel" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
      </div>
      
      <div className="notification-list">
        {loading ? (
          <div className="notification-loading">
            <i className="fas fa-spinner fa-spin"></i>
            <p>Loading notifications...</p>
          </div>
        ) : error ? (
          <div className="notification-error">
            <i className="fas fa-exclamation-triangle"></i>
            <p>{error}</p>
            <button onClick={fetchNotifications}>Retry</button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="notification-empty">
            <i className="fas fa-bell-slash"></i>
            <p>No notifications yet</p>
            <p className="empty-subtitle">You're all caught up!</p>
          </div>
        ) : (
          <>
            {notifications.map(notification => (
              <div 
                key={notification.id} 
                className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                onClick={() => markAsRead(notification.id)}
              >
                <div className="notification-icon" style={{ color: getNotificationColor(notification.type) }}>
                  <i className={`fas ${getNotificationIcon(notification.type)}`}></i>
                </div>
                <div className="notification-content">
                  <div className="notification-title">{notification.title}</div>
                  <div className="notification-message">{notification.message}</div>
                  <div className="notification-time">
                    <i className="fas fa-clock"></i>
                    {formatTime(notification.created_at)}
                  </div>
                </div>
                <button 
                  className="notification-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(notification.id);
                  }}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationPanel;