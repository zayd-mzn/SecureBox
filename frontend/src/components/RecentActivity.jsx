import React, { useState, useEffect, useMemo } from 'react';
import './RecentActivity.css';
import axios from 'axios';

const RecentActivity = ({ 
  activities: propActivities, 
  autoFetch = false, 
  limit = 10,
  userId = null,
  fileId = null,
  showViewAll = true,
  filterType = 'all'
}) => {
  const [activities, setActivities] = useState(propActivities || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState(filterType);
  const [stats, setStats] = useState(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const API_URL = 'http://localhost:5000/api';

  // Auto-fetch data if autoFetch is true and no prop data provided
  useEffect(() => {
    if (autoFetch && !propActivities) {
      fetchRecentActivity();
    }
  }, [autoFetch, userId, fileId, selectedFilter, showAll, dateRange]);

  // Update activities when prop changes
  useEffect(() => {
    if (propActivities) {
      setActivities(propActivities);
    }
  }, [propActivities]);

  const fetchRecentActivity = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('access_token');
      
      let endpoint = `${API_URL}/dashboard/activity`;
      const params = new URLSearchParams();
      
      if (userId) {
        endpoint = `${API_URL}/admin/users/${userId}/activity`;
      } else if (fileId) {
        endpoint = `${API_URL}/files/${fileId}/activity`;
      }
      
      params.append('limit', showAll ? 50 : limit);
      if (selectedFilter !== 'all') {
        params.append('action', selectedFilter);
      }
      if (dateRange.start) {
        params.append('date_from', dateRange.start);
      }
      if (dateRange.end) {
        params.append('date_to', dateRange.end);
      }
      
      const response = await axios.get(`${endpoint}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setActivities(response.data.activities || response.data);
      
      // Get activity stats
      const statsResponse = await axios.get(`${API_URL}/dashboard/activity-stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(statsResponse.data);
      
    } catch (err) {
      console.error('Error fetching recent activity:', err);
      setError(err.response?.data?.error || 'Failed to load recent activity');
    } finally {
      setLoading(false);
    }
  };

  // FIXED: Comprehensive activity icon mapping with colors
  const getActivityIcon = (action) => {
    const actionLower = action?.toLowerCase() || '';
    
    const iconMap = {
      upload: 'fa-cloud-upload-alt',
      file_upload: 'fa-cloud-upload-alt',
      download: 'fa-cloud-download-alt',
      file_download: 'fa-cloud-download-alt',
      delete: 'fa-trash-alt',
      file_delete: 'fa-trash-alt',
      restore: 'fa-undo-alt',
      file_restore: 'fa-undo-alt',
      share: 'fa-share-alt',
      file_share: 'fa-share-alt',
      edit: 'fa-edit',
      file_edit: 'fa-edit',
      lock: 'fa-lock',
      file_lock: 'fa-lock',
      unlock: 'fa-unlock-alt',
      file_unlock: 'fa-unlock-alt',
      login: 'fa-sign-in-alt',
      login_success: 'fa-sign-in-alt',
      logout: 'fa-sign-out-alt',
      login_failed: 'fa-exclamation-triangle',
      permission_change: 'fa-user-shield',
      acl_change: 'fa-shield-alt',
      view: 'fa-eye',
      create: 'fa-plus-circle',
      update: 'fa-sync-alt'
    };
    
    if (iconMap[actionLower]) return iconMap[actionLower];
    if (actionLower.includes('upload')) return 'fa-cloud-upload-alt';
    if (actionLower.includes('download')) return 'fa-cloud-download-alt';
    if (actionLower.includes('delete')) return 'fa-trash-alt';
    if (actionLower.includes('restore')) return 'fa-undo-alt';
    if (actionLower.includes('share')) return 'fa-share-alt';
    if (actionLower.includes('edit')) return 'fa-edit';
    if (actionLower.includes('lock')) return 'fa-lock';
    if (actionLower.includes('unlock')) return 'fa-unlock-alt';
    if (actionLower.includes('login')) return 'fa-sign-in-alt';
    if (actionLower.includes('logout')) return 'fa-sign-out-alt';
    if (actionLower.includes('permission')) return 'fa-user-shield';
    
    return 'fa-file-alt';
  };

  // Get icon color based on action type
  const getIconColor = (action) => {
    const actionLower = action?.toLowerCase() || '';
    
    if (actionLower.includes('upload')) return '#48bb78';      // Green
    if (actionLower.includes('download')) return '#4299e1';    // Blue
    if (actionLower.includes('delete')) return '#e53e3e';      // Red
    if (actionLower.includes('restore')) return '#38b2ac';     // Teal
    if (actionLower.includes('share')) return '#9f7aea';       // Purple
    if (actionLower.includes('edit')) return '#ed8936';        // Orange
    if (actionLower.includes('lock')) return '#ecc94b';        // Yellow
    if (actionLower.includes('unlock')) return '#68d391';      // Light Green
    if (actionLower.includes('login')) return '#4299e1';       // Blue
    if (actionLower.includes('logout')) return '#a0aec0';      // Gray
    if (actionLower.includes('permission')) return '#805ad5';  // Dark Purple
    
    return '#718096'; // Default gray
  };

  const getStatusIcon = (status) => {
    switch(status?.toLowerCase()) {
      case 'success': return 'fa-check-circle';
      case 'failed': return 'fa-times-circle';
      case 'warning': return 'fa-exclamation-triangle';
      default: return 'fa-info-circle';
    }
  };

  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
      case 'success': return '#48bb78';
      case 'failed': return '#e53e3e';
      case 'warning': return '#ed8936';
      default: return '#a0aec0';
    }
  };

  const getTimelineIconClass = (action) => {
    const actionLower = action?.toLowerCase() || '';
    if (actionLower.includes('upload')) return 'timeline-icon-upload';
    if (actionLower.includes('download')) return 'timeline-icon-download';
    if (actionLower.includes('delete')) return 'timeline-icon-delete';
    if (actionLower.includes('share')) return 'timeline-icon-share';
    if (actionLower.includes('login')) return 'timeline-icon-login';
    if (actionLower.includes('lock')) return 'timeline-icon-lock';
    if (actionLower.includes('unlock')) return 'timeline-icon-unlock';
    return 'timeline-icon-default';
  };

  // Format time with validation
  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
      
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid date';
    }
  };

  const getActionLabel = (action) => {
    const labels = {
      upload: 'uploaded',
      download: 'downloaded',
      share: 'shared',
      delete: 'deleted',
      restore: 'restored',
      login: 'logged in',
      logout: 'logged out',
      edit: 'edited',
      lock: 'locked',
      unlock: 'unlocked',
      permission_change: 'changed permissions',
      file_upload: 'uploaded',
      file_download: 'downloaded',
      file_delete: 'deleted',
      file_share: 'shared',
      login_success: 'logged in',
      login_failed: 'failed login attempt'
    };
    return labels[action] || action?.replace(/_/g, ' ') || action;
  };

  // Filter options with icons and colors
  const filterOptions = [
    { value: 'all', label: 'All Activities', icon: 'fa-list', color: '#4299e1' },
    { value: 'upload', label: 'Uploads', icon: 'fa-cloud-upload-alt', color: '#48bb78' },
    { value: 'download', label: 'Downloads', icon: 'fa-cloud-download-alt', color: '#4299e1' },
    { value: 'share', label: 'Shares', icon: 'fa-share-alt', color: '#9f7aea' },
    { value: 'delete', label: 'Deletions', icon: 'fa-trash-alt', color: '#e53e3e' },
    { value: 'login', label: 'Logins', icon: 'fa-sign-in-alt', color: '#ed8936' },
    { value: 'edit', label: 'Edits', icon: 'fa-edit', color: '#38b2ac' },
    { value: 'lock', label: 'Locks', icon: 'fa-lock', color: '#805ad5' }
  ];

  // Get counts by action type
  const actionCounts = useMemo(() => {
    const counts = {};
    activities.forEach(activity => {
      const action = activity.action;
      counts[action] = (counts[action] || 0) + 1;
    });
    return counts;
  }, [activities]);

  // Filtered activities based on selected filter
  const filteredActivities = useMemo(() => {
    if (selectedFilter === 'all') return activities;
    return activities.filter(activity => {
      const action = activity.action?.toLowerCase();
      return action === selectedFilter || 
             action?.includes(selectedFilter) ||
             (selectedFilter === 'login' && (action === 'login_success' || action === 'login_failed'));
    });
  }, [activities, selectedFilter]);

  const displayActivities = showAll ? filteredActivities : filteredActivities.slice(0, limit);
  const hasMore = filteredActivities.length > limit;

  // Clear all filters
  const clearFilters = () => {
    setSelectedFilter('all');
    setDateRange({ start: '', end: '' });
    if (autoFetch) {
      fetchRecentActivity();
    }
  };

  if (loading && !activities.length) {
    return (
      <div className="card activity-feed">
        <div className="card-header">
          <h2><i className="fas fa-stream"></i> Recent Activity</h2>
        </div>
        <div className="activity-loading">
          <div className="loading-spinner-small">
            <i className="fas fa-spinner fa-spin"></i>
          </div>
          <p>Loading activities...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card activity-feed">
        <div className="card-header">
          <h2><i className="fas fa-stream"></i> Recent Activity</h2>
        </div>
        <div className="activity-error">
          <i className="fas fa-exclamation-triangle"></i>
          <p>{error}</p>
          <button onClick={fetchRecentActivity} className="retry-btn">
            <i className="fas fa-sync-alt"></i> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card activity-feed">
      <div className="card-header">
        <h2>
          <i className="fas fa-stream"></i>
          Recent Activity
        </h2>
        <div className="activity-header-actions">
          {(selectedFilter !== 'all' || dateRange.start || dateRange.end) && (
            <button className="clear-filters-btn" onClick={clearFilters}>
              <i className="fas fa-times"></i> Clear Filters
            </button>
          )}
          {showViewAll && hasMore && !showAll && (
            <button 
              className="view-all-btn"
              onClick={() => setShowAll(true)}
            >
              View All ({filteredActivities.length}) <i className="fas fa-arrow-right"></i>
            </button>
          )}
          {showAll && (
            <button 
              className="show-less-btn"
              onClick={() => setShowAll(false)}
            >
              Show Less <i className="fas fa-arrow-up"></i>
            </button>
          )}
          {autoFetch && (
            <button 
              className="refresh-btn-small" 
              onClick={fetchRecentActivity} 
              title="Refresh"
            >
              <i className="fas fa-sync-alt"></i>
            </button>
          )}
        </div>
      </div>

      {/* Activity Stats Summary */}
      {stats && (
        <div className="activity-stats">
          <div className="stat-item">
            <span className="stat-label">Total Events</span>
            <span className="stat-value">{stats.total || activities.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Today</span>
            <span className="stat-value">{stats.today || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">This Week</span>
            <span className="stat-value">{stats.week || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Success Rate</span>
            <span className="stat-value success">{stats.successRate || 98}%</span>
          </div>
        </div>
      )}

      {/* Filter Buttons */}
      <div className="activity-filters">
        {filterOptions.map(option => (
          <button
            key={option.value}
            className={`filter-chip ${selectedFilter === option.value ? 'active' : ''}`}
            onClick={() => setSelectedFilter(option.value)}
            style={{
              borderColor: selectedFilter === option.value ? option.color : undefined,
              background: selectedFilter === option.value ? option.color : undefined
            }}
          >
            <i className={`fas ${option.icon}`}></i>
            <span>{option.label}</span>
            {actionCounts[option.value] > 0 && selectedFilter !== option.value && (
              <span className="filter-count">{actionCounts[option.value]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Date Range Filter */}
      {autoFetch && (
        <div className="date-range-filter">
          <div className="date-input-group">
            <label>From:</label>
            <input 
              type="date" 
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="date-input"
            />
          </div>
          <div className="date-input-group">
            <label>To:</label>
            <input 
              type="date" 
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="date-input"
            />
          </div>
          {(dateRange.start || dateRange.end) && (
            <button className="apply-date-btn" onClick={fetchRecentActivity}>
              Apply
            </button>
          )}
        </div>
      )}

      {/* Activity Timeline with Colored Icons */}
      {filteredActivities.length === 0 ? (
        <div className="activity-empty">
          <i className="fas fa-inbox"></i>
          <p>{selectedFilter === 'all' 
              ? `No activity found` 
              : `No ${selectedFilter} activities found`}</p>
          {selectedFilter !== 'all' && (
            <button className="clear-filter-btn" onClick={() => setSelectedFilter('all')}>
              Clear Filter
            </button>
          )}
        </div>
      ) : (
        <div className="activity-timeline">
          {displayActivities.map((activity, idx) => (
            <div key={activity.id || idx} className="timeline-item">
              <div 
                className={`timeline-icon ${getTimelineIconClass(activity.action)}`}
                style={{ 
                  backgroundColor: `${getIconColor(activity.action)}20`,
                  color: getIconColor(activity.action)
                }}
              >
                <i className={`fas ${getActivityIcon(activity.action)}`}></i>
              </div>
              
              <div className="timeline-content">
                <div className="timeline-header">
                  <strong>{activity.user || activity.username || 'Unknown'}</strong>
                  <span className="timeline-action">{getActionLabel(activity.action)}</span>
                  {(activity.file || activity.resource) && (
                    <span className="timeline-file">
                      <i className="fas fa-file-alt"></i>
                      {activity.file || activity.resource}
                    </span>
                  )}
                </div>
                
                <div className="timeline-meta">
                  <span className="timeline-time">
                    <i className="fas fa-clock"></i>
                    {formatTime(activity.timestamp)}
                  </span>
                  {activity.ip_address && (
                    <span className="timeline-ip">
                      <i className="fas fa-network-wired"></i>
                      {activity.ip_address}
                    </span>
                  )}
                  {activity.details && (
                    <span className="timeline-details">
                      <i className="fas fa-info-circle"></i>
                      {activity.details}
                    </span>
                  )}
                </div>
              </div>
              
              <div 
                className={`timeline-status ${activity.status}`}
                style={{ backgroundColor: `${getStatusColor(activity.status)}20`, color: getStatusColor(activity.status) }}
              >
                <i className={`fas ${getStatusIcon(activity.status)}`}></i>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load More Button */}
      {autoFetch && !showAll && filteredActivities.length === limit && filteredActivities.length >= limit && (
        <div className="load-more-container">
          <button className="load-more-btn" onClick={() => setShowAll(true)}>
            <i className="fas fa-chevron-down"></i>
            Load More Activities ({filteredActivities.length - limit} remaining)
          </button>
        </div>
      )}

      {/* Results Summary */}
      {filteredActivities.length > 0 && (
        <div className="activity-summary">
          <span>Showing {displayActivities.length} of {filteredActivities.length} activities</span>
          {selectedFilter !== 'all' && (
            <span className="active-filter-badge">
              Filtered by: {filterOptions.find(f => f.value === selectedFilter)?.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default RecentActivity;