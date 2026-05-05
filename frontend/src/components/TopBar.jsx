import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import NotificationPanel from './NotificationPanel';
import './TopBar.css';

const TopBar = ({ onThemeToggle, darkMode, onLogout }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationCount, setNotificationCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('language') || 'en';
  });
  const navigate = useNavigate();
  const { logout } = useAuth();

  const API_URL = 'http://localhost:5000/api';

  useEffect(() => {
    fetchNotificationCount();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotificationCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Create a global function to refresh notification count
    window.refreshNotificationCount = fetchNotificationCount;
    
    return () => {
      delete window.refreshNotificationCount;
    };
  }, []);

  const fetchNotificationCount = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      
      const response = await axios.get(`${API_URL}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotificationCount(response.data.count || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
    window.location.reload();
  };

  const handleLogout = async () => {
    try {
      // Optional: Call logout API endpoint if you have one
      const token = localStorage.getItem('access_token');
      if (token) {
        await axios.post(`${API_URL}/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {});
      }
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      // Clear all auth data
      logout();
      
      // Clear any axios defaults
      delete axios.defaults.headers.common['Authorization'];
      
      // Navigate to login page
      navigate('/login', { replace: true });
      
      // Force a hard reload to clear any remaining state
      setTimeout(() => {
        window.location.href = '/login';
      }, 50);
    }
  };

  const languages = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'ar', label: 'العربية', flag: '🇲🇦' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' }
  ];

  const currentLanguage = languages.find(l => l.code === language) || languages[0];

  const handleNotificationsClose = () => {
    setShowNotifications(false);
    fetchNotificationCount();
  };

  return (
    <div className="top-bar">
      <div className="search-bar">
        <i className="fas fa-search"></i>
        <input 
          type="text" 
          placeholder="Search files, users, activities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleSearch}
        />
      </div>
      
      <div className="top-bar-actions">
        {/* Notification Button */}
        <div className="notification-wrapper">
          <button 
            className="top-bar-btn notification-btn"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <i className="fas fa-bell"></i>
            {notificationCount > 0 && <span className="notification-badge">{notificationCount > 99 ? '99+' : notificationCount}</span>}
          </button>
          {showNotifications && (
            <NotificationPanel 
              onClose={handleNotificationsClose}
              onNotificationChange={fetchNotificationCount}
            />
          )}
        </div>

        {/* Language Selector */}
        <div className="language-selector">
          <button className="top-bar-btn language-btn">
            <span className="language-flag">{currentLanguage.flag}</span>
            <span className="language-label">{currentLanguage.label}</span>
            <i className="fas fa-chevron-down"></i>
          </button>
          <div className="language-dropdown">
            {languages.map(lang => (
              <button
                key={lang.code}
                className={`language-option ${language === lang.code ? 'active' : ''}`}
                onClick={() => handleLanguageChange(lang.code)}
              >
                <span className="language-flag">{lang.flag}</span>
                <span className="language-label">{lang.label}</span>
                {language === lang.code && <i className="fas fa-check"></i>}
              </button>
            ))}
          </div>
        </div>

        {/* Theme Toggle Button */}
        <button className="top-bar-btn theme-toggle-top" onClick={onThemeToggle}>
          <i className={`fas ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
          <span className="btn-label">{darkMode ? 'Light' : 'Dark'}</span>
        </button>
        
        {/* Logout Button */}
        <button onClick={handleLogout} className="top-bar-btn logout-btn-top">
          <i className="fas fa-sign-out-alt"></i>
          <span className="btn-label">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default TopBar;