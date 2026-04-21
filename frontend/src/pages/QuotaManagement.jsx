import React, { useState, useEffect } from 'react';
import '../styles/QuotaManagement.css';
import { formatBytes } from '../utils/formatters';
import axios from 'axios';

const QuotaManagement = () => {
  const [quotas, setQuotas] = useState({
    global_admin: 28,
    space_admin: 45,
    user: 62
  });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editQuota, setEditQuota] = useState({ userId: null, quota: 0 });
  const [saveMessage, setSaveMessage] = useState('');
  const [stats, setStats] = useState({
    totalQuota: 0,
    usedQuota: 0,
    availableQuota: 0,
    averageUsage: 0
  });

  const API_URL = 'http://localhost:5000/api';

  useEffect(() => {
    fetchUsers();
    fetchQuotaStats();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
      calculateStats(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuotaStats = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/admin/quota-stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data) {
        setQuotas(response.data);
      }
    } catch (error) {
      console.error('Error fetching quota stats:', error);
    }
  };

  const calculateStats = (usersList) => {
    const totalQuota = usersList.reduce((sum, user) => sum + (user.storage_quota || 0), 0);
    const usedQuota = usersList.reduce((sum, user) => sum + (user.storage_used || 0), 0);
    const averageUsage = usersList.length > 0 ? (usedQuota / totalQuota) * 100 : 0;
    
    setStats({
      totalQuota,
      usedQuota,
      availableQuota: totalQuota - usedQuota,
      averageUsage: averageUsage.toFixed(1)
    });
  };

  const handleEditQuota = (user) => {
    setSelectedUser(user);
    setEditQuota({ userId: user.id, quota: user.storage_quota });
    setShowEditModal(true);
  };

  const handleSaveQuota = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      await axios.put(`${API_URL}/admin/users/${editQuota.userId}/quota`, 
        { quota: editQuota.quota },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      setSaveMessage('Quota updated successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
      setShowEditModal(false);
      fetchUsers();
    } catch (error) {
      console.error('Error updating quota:', error);
      setSaveMessage('Failed to update quota');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGlobalQuota = async (role, value) => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.put(`${API_URL}/admin/quota-settings`, 
        { role, quota: value },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setQuotas({ ...quotas, [role]: value });
      setSaveMessage(`${role.replace('_', ' ')} quota updated!`);
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error updating global quota:', error);
    }
  };

  const getQuotaColor = (percentage) => {
    if (percentage >= 90) return 'critical';
    if (percentage >= 75) return 'warning';
    return 'normal';
  };

  const getQuotaIcon = (role) => {
    const icons = {
      global_admin: 'fas fa-crown',
      space_admin: 'fas fa-star',
      user: 'fas fa-user'
    };
    return icons[role] || 'fas fa-chart-pie';
  };

  const getQuotaTitle = (role) => {
    const titles = {
      global_admin: 'Global Administrator',
      space_admin: 'Space Administrator',
      user: 'Standard User'
    };
    return titles[role] || role;
  };

  return (
    <div className="quota-management-page">
      {/* Header */}
      <div className="quota-header">
        <div>
          <h1>
            <i className="fas fa-chart-pie"></i>
            Quota Management
          </h1>
          <p className="quota-subtitle">Manage storage quotas for users and roles</p>
        </div>
        {saveMessage && (
          <div className="save-message success">
            <i className="fas fa-check-circle"></i>
            {saveMessage}
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="quota-stats-grid">
        <div className="stat-card">
          <div className="stat-icon total">
            <i className="fas fa-database"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Quota</span>
            <span className="stat-value">{formatBytes(stats.totalQuota)}</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon used">
            <i className="fas fa-hdd"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Used Space</span>
            <span className="stat-value">{formatBytes(stats.usedQuota)}</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon available">
            <i className="fas fa-cloud-upload-alt"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Available</span>
            <span className="stat-value">{formatBytes(stats.availableQuota)}</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon average">
            <i className="fas fa-chart-line"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Average Usage</span>
            <span className="stat-value">{stats.averageUsage}%</span>
          </div>
        </div>
      </div>

      {/* Role-based Quota Section */}
      <div className="card">
        <div className="card-header">
          <h2>
            <i className="fas fa-users"></i>
            Role-based Quota Limits
          </h2>
          <p className="card-description">Default quota limits for each user role</p>
        </div>
        
        <div className="quota-roles">
          {Object.entries(quotas).map(([role, percentage]) => (
            <div key={role} className="quota-role-card">
              <div className="role-header">
                <div className="role-icon">
                  <i className={getQuotaIcon(role)}></i>
                </div>
                <div className="role-info">
                  <h3>{getQuotaTitle(role)}</h3>
                  <span className="role-badge">{role.replace('_', ' ')}</span>
                </div>
                <div className="role-percentage">{percentage}%</div>
              </div>
              
              <div className="quota-progress">
                <div className="progress-bar-bg">
                  <div 
                    className={`progress-bar-fill ${getQuotaColor(percentage)}`}
                    style={{ width: `${percentage}%` }}
                  >
                    <span className="progress-label">{percentage}%</span>
                  </div>
                </div>
              </div>
              
              <div className="role-stats">
                <div className="stat">
                  <span className="stat-name">Used</span>
                  <span className="stat-number">{formatBytes(stats.usedQuota * (percentage / 100))}</span>
                </div>
                <div className="stat">
                  <span className="stat-name">Total</span>
                  <span className="stat-number">{formatBytes(stats.totalQuota * (percentage / 100))}</span>
                </div>
                <div className="stat">
                  <span className="stat-name">Remaining</span>
                  <span className="stat-number">{formatBytes(stats.totalQuota * (percentage / 100) - stats.usedQuota * (percentage / 100))}</span>
                </div>
              </div>
              
              <div className="quota-actions">
                <button 
                  className="btn-edit-quota"
                  onClick={() => handleUpdateGlobalQuota(role, Math.min(percentage + 10, 100))}
                >
                  <i className="fas fa-plus"></i> Increase
                </button>
                <button 
                  className="btn-edit-quota"
                  onClick={() => handleUpdateGlobalQuota(role, Math.max(percentage - 10, 0))}
                >
                  <i className="fas fa-minus"></i> Decrease
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User Quota Table */}
      <div className="card">
        <div className="card-header">
          <h2>
            <i className="fas fa-users"></i>
            Individual User Quotas
          </h2>
          <button className="btn-refresh" onClick={fetchUsers}>
            <i className="fas fa-sync-alt"></i>
            Refresh
          </button>
        </div>
        
        <div className="users-quota-table">
          {loading ? (
            <div className="loading-state">
              <i className="fas fa-spinner fa-spin"></i>
              <p>Loading users...</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Used Space</th>
                  <th>Quota Limit</th>
                  <th>Usage</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => {
                  const usagePercent = (user.storage_used / user.storage_quota) * 100;
                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="user-cell">
                          <div className="user-avatar">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <span>{user.username}</span>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`role-badge-small ${user.role}`}>
                          {user.role === 'global_admin' ? 'Global Admin' : 
                           user.role === 'space_admin' ? 'Space Admin' : 'User'}
                        </span>
                      </td>
                      <td>{formatBytes(user.storage_used)}</td>
                      <td>{formatBytes(user.storage_quota)}</td>
                      <td>
                        <div className="usage-cell">
                          <div className="mini-progress">
                            <div 
                              className={`mini-progress-fill ${getQuotaColor(usagePercent)}`}
                              style={{ width: `${usagePercent}%` }}
                            ></div>
                          </div>
                          <span className="usage-percent">{usagePercent.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td>
                        <button 
                          className="action-btn edit"
                          onClick={() => handleEditQuota(user)}
                          title="Edit Quota"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recommendation Section */}
      <div className="card recommendations">
        <div className="card-header">
          <h2>
            <i className="fas fa-chart-line"></i>
            Quota Recommendations
          </h2>
        </div>
        <div className="recommendations-list">
          {stats.averageUsage > 80 && (
            <div className="recommendation warning">
              <i className="fas fa-exclamation-triangle"></i>
              <div>
                <strong>High Storage Usage</strong>
                <p>Overall storage is at {stats.averageUsage}%. Consider increasing quotas or cleaning up old files.</p>
              </div>
            </div>
          )}
          
          {users.filter(u => (u.storage_used / u.storage_quota) * 100 > 90).length > 0 && (
            <div className="recommendation warning">
              <i className="fas fa-user-clock"></i>
              <div>
                <strong>Users Near Limit</strong>
                <p>{users.filter(u => (u.storage_used / u.storage_quota) * 100 > 90).length} users are using over 90% of their quota.</p>
              </div>
            </div>
          )}
          
          <div className="recommendation info">
            <i className="fas fa-lightbulb"></i>
            <div>
              <strong>Best Practices</strong>
              <p>Regularly review quota usage and adjust limits based on user needs. Consider implementing auto-scaling for enterprise users.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Quota Modal */}
      {showEditModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <i className="fas fa-edit"></i>
                Edit User Quota
              </h2>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="user-info-section">
                <div className="user-avatar-large">
                  {selectedUser.username.charAt(0).toUpperCase()}
                </div>
                <div className="user-info-text">
                  <h3>{selectedUser.username}</h3>
                  <p>{selectedUser.email}</p>
                  <span className={`role-badge ${selectedUser.role}`}>
                    {selectedUser.role === 'global_admin' ? 'Global Admin' : 
                     selectedUser.role === 'space_admin' ? 'Space Admin' : 'User'}
                  </span>
                </div>
              </div>
              
              <div className="current-usage">
                <div className="usage-info">
                  <span>Current Usage</span>
                  <strong>{formatBytes(selectedUser.storage_used)}</strong>
                </div>
                <div className="usage-info">
                  <span>Current Quota</span>
                  <strong>{formatBytes(selectedUser.storage_quota)}</strong>
                </div>
                <div className="usage-info">
                  <span>Usage Percentage</span>
                  <strong>{((selectedUser.storage_used / selectedUser.storage_quota) * 100).toFixed(1)}%</strong>
                </div>
              </div>
              
              <div className="quota-input-section">
                <label>New Quota Limit</label>
                <div className="quota-input-group">
                  <input
                    type="number"
                    value={editQuota.quota}
                    onChange={(e) => setEditQuota({ ...editQuota, quota: parseInt(e.target.value) })}
                    className="quota-input"
                  />
                  <select className="quota-unit" defaultValue="bytes">
                    <option value="bytes">Bytes</option>
                    <option value="kb">KB</option>
                    <option value="mb">MB</option>
                    <option value="gb">GB</option>
                  </select>
                </div>
                <p className="input-hint">Enter quota in bytes (1 GB = 1073741824 bytes)</p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button className="btn-save" onClick={handleSaveQuota}>
                <i className="fas fa-save"></i>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotaManagement;