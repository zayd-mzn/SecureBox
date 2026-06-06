import React, { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/ACLManagement.css';
import axios from 'axios';

const ACLManagement = () => {
  const [acls, setAcls] = useState([]);
  const [users, setUsers] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAcl, setSelectedAcl] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  // Filter states: 'all', 'granted', 'denied'
  const [readFilter, setReadFilter] = useState('all');
  const [writeFilter, setWriteFilter] = useState('all');
  const [deleteFilter, setDeleteFilter] = useState('all');
  const [shareFilter, setShareFilter] = useState('all');
  
  // Avatar states
  const [userAvatars, setUserAvatars] = useState({});
  const [avatarErrors, setAvatarErrors] = useState({});

  const [formData, setFormData] = useState({
    file_id: '',
    user_id: '',
    can_read: false,
    can_write: false,
    can_delete: false,
    can_share: false
  });

  const API_URL = 'http://localhost:5000/api';

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (users.length > 0) {
      fetchAvatarsForUsers();
    }
  }, [users]);

  const fetchAvatarsForUsers = async () => {
    const userIds = users.map(user => user.id).filter(id => id);
    
    if (userIds.length === 0) return;
    
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.post(
        `${API_URL}/admin/users/avatars/batch`,
        { user_ids: userIds },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.avatars) {
        setUserAvatars(response.data.avatars);
      }
    } catch (err) {
      console.error('Error fetching avatars batch:', err);
    }
  };

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('access_token');
      
      const [aclsRes, usersRes, filesRes] = await Promise.all([
        axios.get(`${API_URL}/acls`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/files`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      setAcls(aclsRes.data);
      setUsers(usersRes.data);
      setFiles(filesRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchACLs = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/acls`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAcls(response.data);
    } catch (err) {
      console.error('Error fetching ACLs:', err);
      setError(err.response?.data?.error || 'Failed to load ACLs');
    }
  };

  // Cycle through filter states: 'all' -> 'granted' -> 'denied' -> 'all'
  const cycleFilter = (currentFilter, setFilter) => {
    if (currentFilter === 'all') {
      setFilter('granted');
    } else if (currentFilter === 'granted') {
      setFilter('denied');
    } else {
      setFilter('all');
    }
  };

  // Reset all filters to 'all'
  const resetAllFilters = () => {
    setReadFilter('all');
    setWriteFilter('all');
    setDeleteFilter('all');
    setShareFilter('all');
    setSearchTerm(''); // Optional: also clear search term
  };

  // Get filter button class and text
  const getFilterButtonProps = (filterType, currentFilter) => {
    if (currentFilter === 'all') {
      return { className: 'filter-btn', text: filterType };
    } else if (currentFilter === 'granted') {
      return { className: 'filter-btn granted', text: `${filterType} ✓` };
    } else {
      return { className: 'filter-btn denied', text: `${filterType} ✗` };
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleAddAcl = async () => {
    if (!formData.file_id || !formData.user_id) {
      setSaveMessage('Please select both a file and a user');
      setTimeout(() => setSaveMessage(''), 3000);
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      await axios.post(`${API_URL}/acls`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSaveMessage('ACL rule added successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
      setShowAddModal(false);
      fetchACLs();
      resetForm();
    } catch (err) {
      console.error('Error adding ACL:', err);
      setSaveMessage(err.response?.data?.error || 'Failed to add ACL rule');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleEditAcl = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      await axios.put(`${API_URL}/acls/${selectedAcl.id}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSaveMessage('ACL rule updated successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
      setShowEditModal(false);
      fetchACLs();
    } catch (err) {
      console.error('Error updating ACL:', err);
      setSaveMessage(err.response?.data?.error || 'Failed to update ACL rule');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAcl = async (id) => {
    if (window.confirm('Are you sure you want to delete this ACL rule?')) {
      try {
        const token = localStorage.getItem('access_token');
        await axios.delete(`${API_URL}/acls/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setSaveMessage('ACL rule deleted successfully!');
        setTimeout(() => setSaveMessage(''), 3000);
        fetchACLs();
      } catch (err) {
        console.error('Error deleting ACL:', err);
        setSaveMessage(err.response?.data?.error || 'Failed to delete ACL rule');
        setTimeout(() => setSaveMessage(''), 3000);
      }
    }
  };

  const openEditModal = (acl) => {
    setSelectedAcl(acl);
    setFormData({
      file_id: acl.file_id,
      user_id: acl.user_id,
      can_read: acl.can_read,
      can_write: acl.can_write,
      can_delete: acl.can_delete,
      can_share: acl.can_share
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      file_id: '',
      user_id: '',
      can_read: false,
      can_write: false,
      can_delete: false,
      can_share: false
    });
  };

  const getFileById = (fileId) => {
    const file = files.find(f => f.id === fileId);
    return file ? file.filename : `File ID: ${fileId}`;
  };

  const getUserById = (userId) => {
    const user = users.find(u => u.id === userId);
    return user ? user.username : `User ID: ${userId}`;
  };

  const getUserAvatar = (userId) => {
    const user = users.find(u => u.id === userId);
    if (!user) return null;
    
    const avatarData = userAvatars[userId];
    if (avatarData && user.has_avatar) {
      return typeof avatarData === 'string' ? avatarData : avatarData.avatar;
    }
    return null;
  };

  const handleAvatarError = (userId) => {
    setAvatarErrors(prev => ({ ...prev, [userId]: true }));
  };

  const renderUserAvatar = (userId) => {
    const avatarUrl = getUserAvatar(userId);
    const hasError = avatarErrors[userId];
    const username = getUserById(userId);
    const firstLetter = username.charAt(0).toUpperCase();
    
    if (avatarUrl && !hasError) {
      return (
        <img 
          src={avatarUrl} 
          alt={username}
          className="user-avatar-image"
          onError={() => handleAvatarError(userId)}
        />
      );
    }
    
    return <span>{firstLetter}</span>;
  };

  const getPermissionBadgeClass = (value) => {
    return value ? 'permission-enabled' : 'permission-disabled';
  };

  const getPermissionIcon = (value) => {
    return value ? 'fa-check-circle' : 'fa-times-circle';
  };

  // Apply all filters
  const filteredAcls = acls.filter(acl => {
    // Search filter
    const matchesSearch = getFileById(acl.file_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
                          getUserById(acl.user_id).toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    // Read filter
    if (readFilter === 'granted' && !acl.can_read) return false;
    if (readFilter === 'denied' && acl.can_read) return false;
    
    // Write filter
    if (writeFilter === 'granted' && !acl.can_write) return false;
    if (writeFilter === 'denied' && acl.can_write) return false;
    
    // Delete filter
    if (deleteFilter === 'granted' && !acl.can_delete) return false;
    if (deleteFilter === 'denied' && acl.can_delete) return false;
    
    // Share filter
    if (shareFilter === 'granted' && !acl.can_share) return false;
    if (shareFilter === 'denied' && acl.can_share) return false;
    
    return true;
  });

  const stats = {
    total: acls.length,
    readEnabled: acls.filter(a => a.can_read).length,
    writeEnabled: acls.filter(a => a.can_write).length,
    deleteEnabled: acls.filter(a => a.can_delete).length,
    shareEnabled: acls.filter(a => a.can_share).length
  };

  const readProps = getFilterButtonProps('Read', readFilter);
  const writeProps = getFilterButtonProps('Write', writeFilter);
  const deleteProps = getFilterButtonProps('Delete', deleteFilter);
  const shareProps = getFilterButtonProps('Share', shareFilter);

  // Loading state
  if (loading) return <LoadingSpinner message="Loading ACL rules..." />;

  // Error state
  if (error) return (
    <div className="error-container">
      <i className="fas fa-exclamation-triangle"></i>
      <p>{error}</p>
      <button onClick={fetchAllData} className="retry-btn">Try Again</button>
    </div>
  );

  return (
    <div className="acl-management-page">
      {/* Header */}
      <div className="acl-header">
        <div>
          <h1>
            <i className="fas fa-shield-alt"></i>
            ACL Management
          </h1>
          <p className="acl-subtitle">Manage Access Control Lists for files and users</p>
        </div>
        {saveMessage && (
          <div className={`save-message ${saveMessage.includes('success') ? 'success' : 'error'}`}>
            <i className={`fas ${saveMessage.includes('success') ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
            {saveMessage}
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="acl-stats-grid">
        <div className="stat-card">
          <div className="stat-icon total">
            <i className="fas fa-shield-alt"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Rules</span>
            <span className="stat-value">{stats.total}</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon read">
            <i className="fas fa-eye"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Read Access</span>
            <span className="stat-value">{stats.readEnabled}</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon write">
            <i className="fas fa-edit"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Write Access</span>
            <span className="stat-value">{stats.writeEnabled}</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon delete">
            <i className="fas fa-trash-alt"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Delete Access</span>
            <span className="stat-value">{stats.deleteEnabled}</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon share">
            <i className="fas fa-share-alt"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Share Access</span>
            <span className="stat-value">{stats.shareEnabled}</span>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-header-left">
            <h2>
              <i className="fas fa-list"></i>
              Access Control Rules
            </h2>
            <p className="card-description">Manage who can access your files and what they can do</p>
          </div>
          <button className="btn-add" onClick={() => setShowAddModal(true)}>
            <i className="fas fa-plus"></i>
            Add Rule
          </button>
        </div>

        {/* Search and Filter Bar */}
        <div className="acl-filters">
          <div className="search-box">
            <i className="fas fa-search"></i>
            <input
              type="text"
              placeholder="Search by file or user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="filter-buttons">
            <button 
              className="filter-btn"
              onClick={resetAllFilters}
            >
              <i className="fas fa-undo"></i> All
            </button>
            <button 
              className={readProps.className}
              onClick={() => cycleFilter(readFilter, setReadFilter)}
            >
              <i className="fas fa-eye"></i> {readProps.text}
            </button>
            <button 
              className={writeProps.className}
              onClick={() => cycleFilter(writeFilter, setWriteFilter)}
            >
              <i className="fas fa-edit"></i> {writeProps.text}
            </button>
            <button 
              className={deleteProps.className}
              onClick={() => cycleFilter(deleteFilter, setDeleteFilter)}
            >
              <i className="fas fa-trash-alt"></i> {deleteProps.text}
            </button>
            <button 
              className={shareProps.className}
              onClick={() => cycleFilter(shareFilter, setShareFilter)}
            >
              <i className="fas fa-share-alt"></i> {shareProps.text}
            </button>
          </div>
        </div>

        {/* ACL Table */}
        <div className="acls-table">
          {filteredAcls.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-shield-alt"></i>
              <p>No ACL rules found</p>
              <button className="btn-add-small" onClick={() => setShowAddModal(true)}>
                Create your first rule
              </button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>File/Folder</th>
                  <th>User/Group</th>
                  <th>Read</th>
                  <th>Write</th>
                  <th>Delete</th>
                  <th>Share</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAcls.map(acl => (
                  <tr key={acl.id}>
                    <td className="file-cell">
                      <i className="fas fa-file-alt"></i>
                      {getFileById(acl.file_id)}
                    </td>
                    <td className="user-cell">
                      <div className="user-avatar-small">
                        {renderUserAvatar(acl.user_id)}
                      </div>
                      {getUserById(acl.user_id)}
                    </td>
                    <td className="permission-cell">
                      <span className={`permission-badge ${getPermissionBadgeClass(acl.can_read)}`}>
                        <i className={`fas ${getPermissionIcon(acl.can_read)}`}></i>
                        {acl.can_read ? 'Granted' : 'Denied'}
                      </span>
                    </td>
                    <td className="permission-cell">
                      <span className={`permission-badge ${getPermissionBadgeClass(acl.can_write)}`}>
                        <i className={`fas ${getPermissionIcon(acl.can_write)}`}></i>
                        {acl.can_write ? 'Granted' : 'Denied'}
                      </span>
                    </td>
                    <td className="permission-cell">
                      <span className={`permission-badge ${getPermissionBadgeClass(acl.can_delete)}`}>
                        <i className={`fas ${getPermissionIcon(acl.can_delete)}`}></i>
                        {acl.can_delete ? 'Granted' : 'Denied'}
                      </span>
                    </td>
                    <td className="permission-cell">
                      <span className={`permission-badge ${getPermissionBadgeClass(acl.can_share)}`}>
                        <i className={`fas ${getPermissionIcon(acl.can_share)}`}></i>
                        {acl.can_share ? 'Granted' : 'Denied'}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <div className="action-buttons">
                        <button 
                          className="actions-btn edit"
                          onClick={() => openEditModal(acl)}
                          title="Edit"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button 
                          className="actions-btn delete"
                          onClick={() => handleDeleteAcl(acl.id)}
                          title="Delete"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add ACL Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <i className="fas fa-plus-circle"></i>
                Add ACL Rule
              </h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>
                  <i className="fas fa-file-alt"></i>
                  File / Folder
                </label>
                <select name="file_id" value={formData.file_id} onChange={handleInputChange}>
                  <option value="">Select a file</option>
                  {files.map(file => (
                    <option key={file.id} value={file.id}>{file.filename}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>
                  <i className="fas fa-user"></i>
                  User / Group
                </label>
                <select name="user_id" value={formData.user_id} onChange={handleInputChange}>
                  <option value="">Select a user</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.username} ({user.email})</option>
                  ))}
                </select>
              </div>

              <div className="permissions-section">
                <label>Permissions</label>
                <div className="permissions-grid">
                  <label className="permission-option">
                    <input
                      type="checkbox"
                      name="can_read"
                      checked={formData.can_read}
                      onChange={handleInputChange}
                    />
                    <i className="fas fa-eye"></i>
                    <span>Read</span>
                  </label>
                  
                  <label className="permission-option">
                    <input
                      type="checkbox"
                      name="can_write"
                      checked={formData.can_write}
                      onChange={handleInputChange}
                    />
                    <i className="fas fa-edit"></i>
                    <span>Write</span>
                  </label>
                  
                  <label className="permission-option">
                    <input
                      type="checkbox"
                      name="can_delete"
                      checked={formData.can_delete}
                      onChange={handleInputChange}
                    />
                    <i className="fas fa-trash-alt"></i>
                    <span>Delete</span>
                  </label>
                  
                  <label className="permission-option">
                    <input
                      type="checkbox"
                      name="can_share"
                      checked={formData.can_share}
                      onChange={handleInputChange}
                    />
                    <i className="fas fa-share-alt"></i>
                    <span>Share</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button className="btn-save" onClick={handleAddAcl}>
                <i className="fas fa-save"></i>
                Add Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit ACL Modal */}
      {showEditModal && selectedAcl && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <i className="fas fa-edit"></i>
                Edit ACL Rule
              </h2>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>
                  <i className="fas fa-file-alt"></i>
                  File / Folder
                </label>
                <select name="file_id" value={formData.file_id} onChange={handleInputChange}>
                  <option value="">Select a file</option>
                  {files.map(file => (
                    <option key={file.id} value={file.id}>{file.filename}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>
                  <i className="fas fa-user"></i>
                  User / Group
                </label>
                <select name="user_id" value={formData.user_id} onChange={handleInputChange}>
                  <option value="">Select a user</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.username} ({user.email})</option>
                  ))}
                </select>
              </div>

              <div className="permissions-section">
                <label>Permissions</label>
                <div className="permissions-grid">
                  <label className="permission-option">
                    <input
                      type="checkbox"
                      name="can_read"
                      checked={formData.can_read}
                      onChange={handleInputChange}
                    />
                    <i className="fas fa-eye"></i>
                    <span>Read</span>
                  </label>
                  
                  <label className="permission-option">
                    <input
                      type="checkbox"
                      name="can_write"
                      checked={formData.can_write}
                      onChange={handleInputChange}
                    />
                    <i className="fas fa-edit"></i>
                    <span>Write</span>
                  </label>
                  
                  <label className="permission-option">
                    <input
                      type="checkbox"
                      name="can_delete"
                      checked={formData.can_delete}
                      onChange={handleInputChange}
                    />
                    <i className="fas fa-trash-alt"></i>
                    <span>Delete</span>
                  </label>
                  
                  <label className="permission-option">
                    <input
                      type="checkbox"
                      name="can_share"
                      checked={formData.can_share}
                      onChange={handleInputChange}
                    />
                    <i className="fas fa-share-alt"></i>
                    <span>Share</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button className="btn-save" onClick={handleEditAcl}>
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

export default ACLManagement;