import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const TopBar = ({ onThemeToggle, darkMode, onLogout }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationCount, setNotificationCount] = useState(0);
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('language') || 'en';
  });
  const { user, userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotificationCount();
  }, []);

  const fetchNotificationCount = async () => {
    try {
      const response = await api.get('/notifications/unread-count');
      setNotificationCount(response.data.count || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const getRoleBadge = () => {
    const badges = {
      global_admin: { label: 'Global Administrator', color: '#e53e3e' },
      space_admin: { label: 'Space Administrator', color: '#ed8936' },
      user: { label: 'Standard User', color: '#4299e1' }
    };
    return badges[userRole] || badges.user;
  };

  const roleBadge = getRoleBadge();

  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
    // You can add logic here to change the app's language
    // For example: i18n.changeLanguage(lang)
    window.location.reload(); // Optional: reload to apply language changes
  };

  const languages = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'ar', label: 'العربية', flag: '🇲🇦' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' }
  ];

  const currentLanguage = languages.find(l => l.code === language) || languages[0];

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
        <div className="user-info-top">
          <div className="user-avatar-small">
            <i className="fas fa-user-circle"></i>
          </div>
          <div className="user-details-top">
            <span className="user-name-top">{user?.username || 'User'}</span>
            <span className="user-role-top" style={{ color: roleBadge.color }}>
              {roleBadge.label}
            </span>
          </div>
        </div>

        {/* Language Selector */}
        <div className="language-selector">
          <button className="language-btn">
            <span>{currentLanguage.flag}</span>
            <span>{currentLanguage.label}</span>
            <i className="fas fa-chevron-down"></i>
          </button>
          <div className="language-dropdown">
            {languages.map(lang => (
              <button
                key={lang.code}
                className={`language-option ${language === lang.code ? 'active' : ''}`}
                onClick={() => handleLanguageChange(lang.code)}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
                {language === lang.code && <i className="fas fa-check"></i>}
              </button>
            ))}
          </div>
        </div>

        <button className="theme-toggle-top" onClick={onThemeToggle}>
          <i className={`fas ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
        </button>
        
        <button onClick={onLogout} className="logout-btn-top">
          <i className="fas fa-sign-out-alt"></i>
          <span>Logout</span>
        </button>

        <button className="notification-btn">
          <i className="fas fa-bell"></i>
          {notificationCount > 0 && <span className="notification-badge">{notificationCount}</span>}
        </button>
      </div>
    </div>
  );
};

export default TopBar;