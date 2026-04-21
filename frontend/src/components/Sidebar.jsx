import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Sidebar = ({ currentPath }) => {
  const navigate = useNavigate();
  const { userRole } = useAuth();

  const menuItems = [
    { id: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: 'fa-chart-line', roles: ['global_admin', 'space_admin', 'user'] },
    { id: 'myfiles', path: '/my-files', label: 'My Files', icon: 'fa-folder', roles: ['global_admin', 'space_admin', 'user'] },
    { id: 'shared', path: '/shared-with-me', label: 'Shared With Me', icon: 'fa-share-nodes', roles: ['global_admin', 'space_admin', 'user'] },
    { id: 'recyclebin', path: '/recycle-bin', label: 'Recycle Bin', icon: 'fa-trash-alt', roles: ['global_admin', 'space_admin', 'user'] },
    { id: 'versions', path: '/versions', label: 'Version History', icon: 'fa-history', roles: ['global_admin', 'space_admin', 'user'] },
    { id: 'logs', path: '/logs', label: 'Activity Logs', icon: 'fa-clipboard-list', roles: ['global_admin'] },
    { id: 'users', path: '/users', label: 'User Management', icon: 'fa-users', roles: ['global_admin'] },
    { id: 'acls', path: '/acls', label: 'ACL Management', icon: 'fa-shield-alt', roles: ['global_admin', 'space_admin'] },
    { id: 'quota', path: '/quota', label: 'Quota Management', icon: 'fa-chart-pie', roles: ['global_admin'] },
    { id: 'settings', path: '/settings', label: 'Settings', icon: 'fa-cog', roles: ['global_admin', 'space_admin', 'user'] }
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(userRole));

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="logo" onClick={() => navigate('/dashboard')}>
          <i className="fas fa-lock"></i>
          <span>SecureBox</span>
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
    </div>
  );
};

export default Sidebar;