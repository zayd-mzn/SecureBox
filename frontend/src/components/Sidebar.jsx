import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';
import axios from 'axios';

const Sidebar = ({ currentPath }) => {
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const [storageInfo, setStorageInfo] = useState({
    used: 0,
    quota: 5368709120,
    percentage: 0
  });
  const [loading, setLoading] = useState(true);
  const [avatarError, setAvatarError] = useState(false);
  const [avatarBase64, setAvatarBase64] = useState(null);
  const [isUserLoaded, setIsUserLoaded] = useState(false);

  const API_URL = 'http://localhost:5000/api';

  // Wait for user to be loaded from localStorage
  useEffect(() => {
    // Check if user exists in localStorage directly
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('access_token');
    
    if (token && storedUser && !user) {
      // If we have token and storedUser but context user is null, wait a bit
      const timer = setTimeout(() => {
        setIsUserLoaded(true);
      }, 100);
      return () => clearTimeout(timer);
    }
    
    setIsUserLoaded(!!user || !!storedUser);
  }, [user]);

  useEffect(() => {
    if (user?.id) {
      fetchStorageInfo();
      fetchUserAvatar();
    } else {
      // Try to get user from localStorage directly
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser?.id) {
          fetchStorageInfo();
          fetchUserAvatar();
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }
  }, [user]);

  // Fetch user avatar from backend
  const fetchUserAvatar = async () => {
    let userId = user?.id;
    
    // If user is null, try to get from localStorage
    if (!userId) {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        userId = parsedUser.id;
      }
    }
    
    if (!userId) return;
    
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/avatar/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.has_avatar && response.data.avatar) {
        setAvatarBase64(response.data.avatar);
        setAvatarError(false);
      }
    } catch (error) {
      console.error('Error fetching avatar:', error);
      setAvatarError(true);
    }
  };

  const fetchStorageInfo = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const stats = response.data.stats;
      setStorageInfo({
        used: stats.storage_used || 0,
        quota: stats.storage_quota || 5368709120,
        percentage: stats.storage_percentage || 0
      });
    } catch (error) {
      console.error('Error fetching storage info:', error);
      setStorageInfo({
        used: 0,
        quota: 5368709120,
        percentage: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getRoleBadge = () => {
    const badges = {
      global_admin: { label: 'Global Admin', color: '#e53e3e', icon: 'fa-crown' },
      space_admin: { label: 'Space Admin', color: '#ed8936', icon: 'fa-star' },
      user: { label: 'User', color: '#4299e1', icon: 'fa-user' }
    };
    return badges[userRole] || badges.user;
  };

  // Get user data from context or localStorage
  const getUserData = () => {
    if (user) return user;
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      return JSON.parse(storedUser);
    }
    return null;
  };

  const currentUser = getUserData();
  const roleBadge = getRoleBadge();
  const displayName = currentUser?.username || 'Guest';
  const displayEmail = currentUser?.email || 'guest@securebox.com';

  const menuItems = [
    { id: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: 'fa-chart-line', roles: ['global_admin', 'space_admin', 'user'] },
    { id: 'myfiles', path: '/my-files', label: 'My Files', icon: 'fa-folder', roles: ['global_admin', 'space_admin', 'user'] },
    { id: 'shared', path: '/shared-with-me', label: 'Shared With Me', icon: 'fa-share-nodes', roles: ['global_admin', 'space_admin', 'user'] },
    { id: 'workspace', path: '/workspace', label: 'Workspaces', icon: 'fa-layer-group', roles: ['global_admin', 'space_admin', 'user'] },
    { id: 'recyclebin', path: '/recycle-bin', label: 'Recycle Bin', icon: 'fa-trash-alt', roles: ['global_admin', 'space_admin', 'user'] },
    { id: 'versions', path: '/versions', label: 'Version History', icon: 'fa-history', roles: ['global_admin', 'space_admin', 'user'] },
    { id: 'logs', path: '/logs', label: 'Activity Logs', icon: 'fa-clipboard-list', roles: ['global_admin', 'space_admin', 'user'] },
    { id: 'users', path: '/users', label: 'User Management', icon: 'fa-users', roles: ['global_admin'] },
    { id: 'acls', path: '/acls', label: 'ACL Management', icon: 'fa-shield-alt', roles: ['global_admin', 'space_admin'] },
    { id: 'quota', path: '/quota', label: 'Quota Management', icon: 'fa-chart-pie', roles: ['global_admin'] },
    { id: 'settings', path: '/settings', label: 'Settings', icon: 'fa-cog', roles: ['global_admin', 'space_admin', 'user'] }
  ];

  // Get role from context or localStorage
  const getCurrentRole = () => {
    if (userRole) return userRole;
    const storedRole = localStorage.getItem('user_role');
    return storedRole || 'user';
  };

  const currentRole = getCurrentRole();
  const filteredMenu = menuItems.filter(item => item.roles.includes(currentRole));

  const getStorageColor = () => {
    if (storageInfo.percentage >= 90) return 'critical';
    if (storageInfo.percentage >= 75) return 'warning';
    return 'normal';
  };

  // Show loading only if we're waiting for user data and it's not in localStorage
  const hasToken = localStorage.getItem('access_token');
  const hasStoredUser = localStorage.getItem('user');
  
  if ((!currentUser && hasToken && !hasStoredUser) || (loading && !hasStoredUser)) {
    return (
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo-container" onClick={() => navigate('/dashboard')}>
            <div className="logo-box">
              <img
                src="/Logo_platforme.png"
                alt="SecureBox Logo"
                className="logo-image"
              />
            </div>
            <span className="logo-text">SecureBox</span>
          </div>
        </div>
        <div className="sidebar-nav">
          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <i className="fas fa-spinner fa-spin"></i> Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="logo-container" onClick={() => navigate('/dashboard')}>
          <div className="logo-box">
            <img
              src="/Logo_platforme.png"
              alt="SecureBox Logo"
              className="logo-image"
            />
          </div>
          <span className="logo-text">SecureBox</span>
        </div>
        
        {/* User Info Section with Profile Picture */}
        <div className="user-info-sidebar">
          <div className="user-avatar-sidebar">
            {avatarBase64 && !avatarError ? (
              <img 
                src={avatarBase64} 
                alt={displayName}
                className="user-avatar-image"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <span className="user-avatar-initial">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="user-details-sidebar">
            <div className="user-name-sidebar">{displayName}</div>
            <div className="user-email-sidebar">{displayEmail}</div>
            <div className="user-role-sidebar" style={{ backgroundColor: roleBadge.color }}>
              <i className={`fas ${roleBadge.icon}`}></i>
              <span>{roleBadge.label}</span>
            </div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {filteredMenu.map(item => (
          <div 
            key={item.id} 
            className={`nav-item ${currentPath === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <i className={`fas ${item.icon} nav-icon`}></i>
            <span className="nav-label">{item.label}</span>
          </div>
        ))}
      </nav>

      {/* Storage Usage Footer */}
      <div className="sidebar-footer">
        <div className="storage-info-sidebar">
          <div className="storage-header-sidebar">
            <i className="fas fa-hdd"></i>
            <span>Storage Usage</span>
          </div>
          <div className="storage-stats-sidebar">
            <div className="storage-text-sidebar">
              {formatBytes(storageInfo.used)} / {formatBytes(storageInfo.quota)}
            </div>
            <div className="storage-bar-sidebar">
              <div 
                className={`storage-bar-fill-sidebar ${getStorageColor()}`}
                style={{ width: `${storageInfo.percentage}%` }}
              ></div>
            </div>
            <div className="storage-percentage-sidebar">
              {storageInfo.percentage.toFixed(1)}% used
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;