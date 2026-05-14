import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import './MainLayout.css';

const MainLayout = () => {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  const { logout } = useAuth();
  const location = useLocation();

  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
    document.body.classList.toggle('dark-mode', newMode);
  };

  return (
    <div className={`dashboard-layout ${darkMode ? 'dark-mode' : ''}`}>
      <Sidebar currentPath={location.pathname} />
      <div className="main-content">
        <TopBar onThemeToggle={toggleTheme} darkMode={darkMode} onLogout={logout} />
        <div className="content-wrapper">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default MainLayout;