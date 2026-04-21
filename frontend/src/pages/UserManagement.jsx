import React, { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatBytes } from '../utils/formatters';
import '../styles/UserManagement.css';
import axios from 'axios';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user',
    storage_quota: 5368709120 // 5GB default
  });

  const API_URL = 'http://localhost:5000/api';

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.put(`${API_URL}/admin/users/${userId}/role`, { role: newRole }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSaveMessage('User role updated successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
      fetchUsers();
    } catch (err) {
      console.error('Role update error:', err);
      setSaveMessage('Failed to update user role');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const handleStatusChange = async (userId, isActive) => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.put(`${API_URL}/admin/users/${userId}/status`, { is_active: !isActive }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSaveMessage(`User ${!isActive ? 'activated' : 'deactivated'} successfully!`);
      setTimeout(() => setSaveMessage(''), 3000);
      fetchUsers();
    } catch (err) {
      console.error('Status update error:', err);
      setSaveMessage('Failed to update user status');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        const token = localStorage.getItem('access_token');
        await axios.delete(`${API_URL}/admin/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSaveMessage('User deleted successfully!');
        setTimeout(() => setSaveMessage(''), 3000);
        fetchUsers();
      } catch (err) {
        console.error('Delete user error:', err);
        setSaveMessage('Failed to delete user');
        setTimeout(() => setSaveMessage(''), 3000);
      }
    }
  };

  const handleAddUser = async () => {
    if (!formData.username || !formData.email || !formData.password) {
      setSaveMessage('Please fill in all required fields');
      setTimeout(() => setSaveMessage(''), 3000);
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      await axios.post(`${API_URL}/admin/users`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSaveMessage('User added successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
      setShowAddModal(false);
      resetForm();
      fetchUsers();
    } catch (err) {
      console.error('Add user error:', err);
      setSaveMessage(err.response?.data?.error || 'Failed to add user');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      await axios.put(`${API_URL}/admin/users/${selectedUser.id}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSaveMessage('User updated successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
      setShowEditModal(false);
      fetchUsers();
    } catch (err) {
      console.error('Edit user error:', err);
      setSaveMessage('Failed to update user');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleQuotaChange = async (userId, newQuota) => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.put(`${API_URL}/admin/users/${userId}/quota`, { quota: newQuota }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSaveMessage('Quota updated successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
      fetchUsers();
    } catch (err) {
      console.error('Quota update error:', err);
      setSaveMessage('Failed to update quota');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
      storage_quota: user.storage_quota
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      role: 'user',
      storage_quota: 5368709120
    });
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'global_admin': return 'role-global-admin';
      case 'space_admin': return 'role-space-admin';
      default: return 'role-user';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'global_admin': return 'Global Admin';
      case 'space_admin': return 'Space Admin';
      default: return 'User';
    }
  };

  const getQuotaColor = (percentage) => {
    if (percentage >= 90) return 'critical';
    if (percentage >= 75) return 'warning';
    return 'normal';
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && user.is_active) ||
      (filterStatus === 'inactive' && !user.is_active);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const stats = {
    total: users.length,
    active: users.filter(u => u.is_active).length,
    inactive: users.filter(u => !u.is_active).length,
    globalAdmins: users.filter(u => u.role === 'global_admin').length,
    spaceAdmins: users.filter(u => u.role === 'space_admin').length,
    regularUsers: users.filter(u => u.role === 'user').length,
    totalStorage: users.reduce((sum, u) => sum + u.storage_used, 0),
    totalQuota: users.reduce((sum, u) => sum + u.storage_quota, 0)
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="error-container">{error}</div>;

  return (
    <div className="user-management-page">
      {/* Header */}
      <div className="user-header">
        <div>
          <h1>
            <i className="fas fa-users"></i>
            User Management
          </h1>
          <p className="user-subtitle">Manage users, roles, quotas and permissions</p>
        </div>
        {saveMessage && (
          <div className={`save-message ${saveMessage.includes('success') ? 'success' : 'error'}`}>
            <i className={`fas ${saveMessage.includes('success') ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
            {saveMessage}
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="user-stats-grid">
        <div className="stat-card">
          <div className="stat-icon total">
            <i className="fas fa-users"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Users</span>
            <span className="stat-value">{stats.total}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon active">
            <i className="fas fa-user-check"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Active</span>
            <span className="stat-value">{stats.active}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon inactive">
            <i className="fas fa-user-slash"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Inactive</span>
            <span className="stat-value">{stats.inactive}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon storage">
            <i className="fas fa-hdd"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Storage Used</span>
            <span className="stat-value">{formatBytes(stats.totalStorage)}</span>
          </div>
        </div>
      </div>

      {/* Role Distribution */}
      <div className="role-distribution">
        <div className="role-item">
          <span className="role-label">Global Admins</span>
          <div className="role-bar">
            <div className="role-fill global" style={{ width: `${(stats.globalAdmins / stats.total) * 100}%` }}></div>
          </div>
          <span className="role-count">{stats.globalAdmins}</span>
        </div>
        <div className="role-item">
          <span className="role-label">Space Admins</span>
          <div className="role-bar">
            <div className="role-fill space" style={{ width: `${(stats.spaceAdmins / stats.total) * 100}%` }}></div>
          </div>
          <span className="role-count">{stats.spaceAdmins}</span>
        </div>
        <div className="role-item">
          <span className="role-label">Regular Users</span>
          <div className="role-bar">
            <div className="role-fill user" style={{ width: `${(stats.regularUsers / stats.total) * 100}%` }}></div>
          </div>
          <span className="role-count">{stats.regularUsers}</span>
        </div>
      </div>

      {/* Main Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-header-left">
            <h2>
              <i className="fas fa-list"></i>
              User List
            </h2>
            <p className="card-description">Manage user accounts, roles, and permissions</p>
          </div>
          <button className="btn-add" onClick={() => setShowAddModal(true)}>
            <i className="fas fa-plus"></i>
            Add User
          </button>
        </div>

        {/* Search and Filter Bar */}
        <div className="user-filters">
          <div className="search-box">
            <i className="fas fa-search"></i>
            <input
              type="text"
              placeholder="Search by username or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <select
              className="filter-select"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="global_admin">Global Admin</option>
              <option value="space_admin">Space Admin</option>
              <option value="user">User</option>
            </select>

            <select
              className="filter-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="users-table">
          {filteredUsers.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-users"></i>
              <p>No users found</p>
              <button className="btn-add-small" onClick={() => setShowAddModal(true)}>
                Add your first user
              </button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Storage Used</th>
                  <th>Quota</th>
                  <th>Usage</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => {
                  const usagePercent = (user.storage_used / user.storage_quota) * 100;
                  return (
                    <tr key={user.id} className={!user.is_active ? 'inactive-row' : ''}>
                      <td>
                        <div className="user-cell">
                          <div className="user-avatar">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="user-name">{user.username}</div>
                            <div className="user-id">ID: {user.id}</div>
                          </div>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <select
                          className={`role-select ${getRoleBadgeClass(user.role)}`}
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        >
                          <option value="user">User</option>
                          <option value="space_admin">Space Admin</option>
                          <option value="global_admin">Global Admin</option>
                        </select>
                      </td>
                      <td>{formatBytes(user.storage_used)}</td>
                      <td>{formatBytes(user.storage_quota)}</td>
                      <td>
                        <div className="usage-cell">
                          <div className="mini-progress">
                            <div
                              className={`mini-progress-fill ${getQuotaColor(usagePercent)}`}
                              style={{ width: `${Math.min(usagePercent, 100)}%` }}
                            ></div>
                          </div>
                          <span className="usage-percent">{usagePercent.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td>
                        <button
                          className={`status-toggle ${user.is_active ? 'active' : 'inactive'}`}
                          onClick={() => handleStatusChange(user.id, user.is_active)}
                          title={user.is_active ? 'Deactivate User' : 'Activate User'}
                        >
                          <i className={`fas ${user.is_active ? 'fa-user-check' : 'fa-user-slash'}`}></i>
                          <span>{user.is_active ? 'Active' : 'Inactive'}</span>
                        </button>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="action-btn edit"
                            onClick={() => openEditModal(user)}
                            title="Edit User"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button
                            className="action-btn delete"
                            onClick={() => handleDeleteUser(user.id)}
                            title="Delete User"
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <i className="fas fa-user-plus"></i>
                Add New User
              </h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>
                  <i className="fas fa-user"></i>
                  Username *
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Enter username"
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  <i className="fas fa-envelope"></i>
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter email address"
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  <i className="fas fa-lock"></i>
                  Password *
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter password"
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  <i className="fas fa-tag"></i>
                  Role
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="user">User</option>
                  <option value="space_admin">Space Admin</option>
                  <option value="global_admin">Global Admin</option>
                </select>
              </div>

              <div className="form-group">
                <label>
                  <i className="fas fa-hdd"></i>
                  Storage Quota
                </label>
                <div className="quota-input-group">
                  <input
                    type="number"
                    value={formData.storage_quota}
                    onChange={(e) => setFormData({ ...formData, storage_quota: parseInt(e.target.value) })}
                  />
                  <select className="quota-unit">
                    <option value="bytes">Bytes</option>
                    <option value="gb">GB</option>
                    <option value="tb">TB</option>
                  </select>
                </div>
                <p className="input-hint">1 GB = 1073741824 bytes</p>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button className="btn-save" onClick={handleAddUser}>
                <i className="fas fa-save"></i>
                Add User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <i className="fas fa-edit"></i>
                Edit User
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
                  <span className={`role-badge ${getRoleBadgeClass(selectedUser.role)}`}>
                    {getRoleLabel(selectedUser.role)}
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label>
                  <i className="fas fa-user"></i>
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>
                  <i className="fas fa-envelope"></i>
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>
                  <i className="fas fa-lock"></i>
                  New Password (leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter new password"
                />
              </div>

              <div className="form-group">
                <label>
                  <i className="fas fa-tag"></i>
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="user">User</option>
                  <option value="space_admin">Space Admin</option>
                  <option value="global_admin">Global Admin</option>
                </select>
              </div>

              <div className="form-group">
                <label>
                  <i className="fas fa-hdd"></i>
                  Storage Quota
                </label>
                <input
                  type="number"
                  value={formData.storage_quota}
                  onChange={(e) => setFormData({ ...formData, storage_quota: parseInt(e.target.value) })}
                />
                <p className="input-hint">Current quota: {formatBytes(selectedUser.storage_quota)}</p>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button className="btn-save" onClick={handleEditUser}>
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

export default UserManagement;