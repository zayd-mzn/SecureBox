import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatBytes, formatDate } from '../utils/formatters';
import '../styles/Search.css';
import axios from 'axios';

const Search = () => {
  const [searchParams] = useSearchParams();
  const [files, setFiles] = useState([]);
  const [users, setUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('files');
  
  // File filters
  const [activeFileType, setActiveFileType] = useState('all');
  const [fileSortBy, setFileSortBy] = useState('relevance');
  const [fileViewMode, setFileViewMode] = useState('grid');
  
  // User filters
  const [activeUserRole, setActiveUserRole] = useState('all');
  const [userSortBy, setUserSortBy] = useState('name_asc');
  const [userStatus, setUserStatus] = useState('all');
  
  // Activity filters
  const [activeAction, setActiveAction] = useState('all');
  const [activitySortBy, setActivitySortBy] = useState('date_desc');
  const [activityStatus, setActivityStatus] = useState('all');
  
  const [saveMessage, setSaveMessage] = useState('');
  const navigate = useNavigate();

  const query = searchParams.get('q') || '';

  useEffect(() => {
    if (query) {
      performSearch();
    } else {
      setLoading(false);
    }
  }, [query, activeCategory, activeFileType, fileSortBy, activeUserRole, userSortBy, userStatus, activeAction, activitySortBy, activityStatus]);

  const performSearch = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const API_URL = 'http://localhost:5000/api';

      let filesData = [];
      let usersData = [];
      let activitiesData = [];

      // Search Files
      if (activeCategory === 'files' || activeCategory === 'all') {
        const filesResponse = await axios.get(`${API_URL}/files/search`, {
          params: { 
            q: query, 
            file_type: activeFileType !== 'all' ? activeFileType : undefined, 
            sort_by: fileSortBy 
          },
          headers: { Authorization: `Bearer ${token}` }
        });
        filesData = filesResponse.data;
      }

      // Search Users
      if (activeCategory === 'users' || activeCategory === 'all') {
        const usersResponse = await axios.get(`${API_URL}/admin/users/search`, {
          params: { 
            q: query,
            role: activeUserRole !== 'all' ? activeUserRole : undefined,
            status: userStatus !== 'all' ? userStatus : undefined,
            sort_by: userSortBy
          },
          headers: { Authorization: `Bearer ${token}` }
        });
        usersData = usersResponse.data;
      }

      // Search Activities
      if (activeCategory === 'activities' || activeCategory === 'all') {
        const activitiesResponse = await axios.get(`${API_URL}/logs/search`, {
          params: { 
            q: query,
            action: activeAction !== 'all' ? activeAction : undefined,
            status: activityStatus !== 'all' ? activityStatus : undefined,
            sort_by: activitySortBy
          },
          headers: { Authorization: `Bearer ${token}` }
        });
        activitiesData = activitiesResponse.data;
      }

      setFiles(filesData);
      setUsers(usersData);
      setActivities(activitiesData);
      setError(null);
    } catch (err) {
      console.error('Search error:', err);
      setError(err.response?.data?.error || 'Failed to perform search');
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (type) => {
    const icons = {
      document: 'fa-file-alt',
      image: 'fa-image',
      video: 'fa-video',
      audio: 'fa-music',
      archive: 'fa-file-archive'
    };
    return icons[type] || 'fa-file';
  };

  const getFileTypeLabel = (type) => {
    const labels = {
      document: 'Document',
      image: 'Image',
      video: 'Video',
      audio: 'Audio',
      archive: 'Archive'
    };
    return labels[type] || 'File';
  };

  const getActionIcon = (action) => {
    const icons = {
      upload: 'fa-cloud-upload-alt',
      download: 'fa-cloud-download-alt',
      login: 'fa-sign-in-alt',
      logout: 'fa-sign-out-alt',
      delete: 'fa-trash-alt',
      share: 'fa-share-alt',
      edit: 'fa-edit',
      permission_change: 'fa-shield-alt'
    };
    return icons[action] || 'fa-file';
  };

  const getActionLabel = (action) => {
    const labels = {
      upload: 'Upload',
      download: 'Download',
      login: 'Login',
      logout: 'Logout',
      delete: 'Delete',
      share: 'Share',
      edit: 'Edit',
      permission_change: 'Permission Change'
    };
    return labels[action] || action;
  };

  const handleDownload = async (fileId, filename) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`http://localhost:5000/api/files/download/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const handleViewVersions = (fileId) => {
    navigate(`/versions?fileId=${fileId}`);
  };

  const handleViewUser = (userId) => {
    navigate(`/users/edit/${userId}`);
  };

  const categories = [
    { id: 'all', label: 'All', icon: 'fa-search', count: files.length + users.length + activities.length },
    { id: 'files', label: 'Files', icon: 'fa-file-alt', count: files.length },
    { id: 'users', label: 'Users', icon: 'fa-users', count: users.length },
    { id: 'activities', label: 'Activities', icon: 'fa-history', count: activities.length }
  ];

  // File type tabs
  const fileTypeTabs = [
    { id: 'all', label: 'All Files', icon: 'fa-folder-open', count: files.length },
    { id: 'document', label: 'Documents', icon: 'fa-file-alt', count: files.filter(f => f.file_type === 'document').length },
    { id: 'image', label: 'Images', icon: 'fa-image', count: files.filter(f => f.file_type === 'image').length },
    { id: 'video', label: 'Videos', icon: 'fa-video', count: files.filter(f => f.file_type === 'video').length },
    { id: 'audio', label: 'Audio', icon: 'fa-music', count: files.filter(f => f.file_type === 'audio').length },
    { id: 'archive', label: 'Archives', icon: 'fa-file-archive', count: files.filter(f => f.file_type === 'archive').length }
  ];

  // User role tabs
  const userRoleTabs = [
    { id: 'all', label: 'All Users', icon: 'fa-users', count: users.length },
    { id: 'global_admin', label: 'Global Admins', icon: 'fa-crown', count: users.filter(u => u.role === 'global_admin').length },
    { id: 'space_admin', label: 'Space Admins', icon: 'fa-star', count: users.filter(u => u.role === 'space_admin').length },
    { id: 'user', label: 'Standard Users', icon: 'fa-user', count: users.filter(u => u.role === 'user').length }
  ];

  // Activity action tabs
  const actionTabs = [
    { id: 'all', label: 'All Actions', icon: 'fa-list', count: activities.length },
    { id: 'upload', label: 'Uploads', icon: 'fa-cloud-upload-alt', count: activities.filter(a => a.action === 'upload').length },
    { id: 'download', label: 'Downloads', icon: 'fa-cloud-download-alt', count: activities.filter(a => a.action === 'download').length },
    { id: 'login', label: 'Logins', icon: 'fa-sign-in-alt', count: activities.filter(a => a.action === 'login').length },
    { id: 'share', label: 'Shares', icon: 'fa-share-alt', count: activities.filter(a => a.action === 'share').length },
    { id: 'delete', label: 'Deletions', icon: 'fa-trash-alt', count: activities.filter(a => a.action === 'delete').length }
  ];

  // Sort options for files
  const fileSortOptions = [
    { value: 'relevance', label: 'Relevance' },
    { value: 'date_desc', label: 'Newest First' },
    { value: 'date_asc', label: 'Oldest First' },
    { value: 'name_asc', label: 'Name (A-Z)' },
    { value: 'name_desc', label: 'Name (Z-A)' },
    { value: 'size_desc', label: 'Largest First' },
    { value: 'size_asc', label: 'Smallest First' }
  ];

  // Sort options for users
  const userSortOptions = [
    { value: 'name_asc', label: 'Name (A-Z)' },
    { value: 'name_desc', label: 'Name (Z-A)' },
    { value: 'email_asc', label: 'Email (A-Z)' },
    { value: 'email_desc', label: 'Email (Z-A)' },
    { value: 'date_asc', label: 'Oldest First' },
    { value: 'date_desc', label: 'Newest First' }
  ];

  // Sort options for activities
  const activitySortOptions = [
    { value: 'date_desc', label: 'Newest First' },
    { value: 'date_asc', label: 'Oldest First' },
    { value: 'user_asc', label: 'User (A-Z)' },
    { value: 'user_desc', label: 'User (Z-A)' }
  ];

  const totalResults = files.length + users.length + activities.length;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="search-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>
            <i className="fas fa-search"></i>
            Search Results
          </h1>
          {query && (
            <p className="page-subtitle">
              Found <strong>{totalResults}</strong> results for <strong>“{query}”</strong>
            </p>
          )}
        </div>
        {saveMessage && (
          <div className="save-success-message">
            <i className="fas fa-check-circle"></i>
            {saveMessage}
          </div>
        )}
      </div>

      <div className="search-container">
        {/* Category Tabs */}
        <div className="category-tabs">
          {categories.map(category => (
            <button
              key={category.id}
              className={`category-tab ${activeCategory === category.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(category.id)}
            >
              <i className={`fas ${category.icon}`}></i>
              <span>{category.label}</span>
              {category.count > 0 && <span className="category-count">{category.count}</span>}
            </button>
          ))}
        </div>

        {/* ========== FILES SECTION ========== */}
        {(activeCategory === 'files' || activeCategory === 'all') && files.length > 0 && (
          <div className="search-section">
            <div className="section-header">
              <h2>
                <i className="fas fa-file-alt"></i>
                Files ({files.length})
              </h2>
            </div>

            {/* File Type Tabs */}
            <div className="filter-tabs">
              {fileTypeTabs.map(tab => (
                <button
                  key={tab.id}
                  className={`filter-tab ${activeFileType === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveFileType(tab.id)}
                >
                  <i className={`fas ${tab.icon}`}></i>
                  <span>{tab.label}</span>
                  {tab.count > 0 && <span className="filter-count">{tab.count}</span>}
                </button>
              ))}
            </div>

            {/* File Controls */}
            <div className="results-header">
              <div className="results-info">
                <i className="fas fa-file-alt"></i>
                <span>{files.length} files found</span>
              </div>
              <div className="results-controls">
                <div className="sort-group">
                  <i className="fas fa-sort"></i>
                  <select value={fileSortBy} onChange={(e) => setFileSortBy(e.target.value)}>
                    {fileSortOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="view-toggle">
                  <button className={`view-btn ${fileViewMode === 'grid' ? 'active' : ''}`} onClick={() => setFileViewMode('grid')}>
                    <i className="fas fa-th-large"></i>
                  </button>
                  <button className={`view-btn ${fileViewMode === 'list' ? 'active' : ''}`} onClick={() => setFileViewMode('list')}>
                    <i className="fas fa-list"></i>
                  </button>
                </div>
              </div>
            </div>

            {/* Files Results */}
            <div className={`results-content ${fileViewMode}`}>
              {files.map(file => (
                <div key={file.id} className="result-card">
                  <div className="result-icon"><i className={`fas ${getFileIcon(file.file_type)}`}></i></div>
                  <div className="result-info">
                    <div className="result-name">{file.filename}</div>
                    <div className="result-meta">
                      <span><i className="fas fa-tag"></i>{getFileTypeLabel(file.file_type)}</span>
                      <span><i className="fas fa-database"></i>{formatBytes(file.file_size)}</span>
                      <span><i className="fas fa-calendar-alt"></i>{new Date(file.upload_date).toLocaleDateString()}</span>
                    </div>
                    {file.is_shared && <div className="result-badge shared"><i className="fas fa-share-alt"></i>Shared</div>}
                  </div>
                  <div className="result-actions">
                    <button className="action-btn download" onClick={() => handleDownload(file.id, file.filename)}><i className="fas fa-download"></i></button>
                    <button className="action-btn versions" onClick={() => handleViewVersions(file.id)}><i className="fas fa-history"></i></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========== USERS SECTION ========== */}
        {(activeCategory === 'users' || activeCategory === 'all') && users.length > 0 && (
          <div className="search-section">
            <div className="section-header">
              <h2>
                <i className="fas fa-users"></i>
                Users ({users.length})
              </h2>
            </div>

            {/* User Role Tabs */}
            <div className="filter-tabs">
              {userRoleTabs.map(tab => (
                <button
                  key={tab.id}
                  className={`filter-tab ${activeUserRole === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveUserRole(tab.id)}
                >
                  <i className={`fas ${tab.icon}`}></i>
                  <span>{tab.label}</span>
                  {tab.count > 0 && <span className="filter-count">{tab.count}</span>}
                </button>
              ))}
            </div>

            {/* User Status Filter */}
            <div className="status-filters">
              <button className={`status-badge ${userStatus === 'all' ? 'active' : ''}`} onClick={() => setUserStatus('all')}>All</button>
              <button className={`status-badge active-status ${userStatus === 'active' ? 'active' : ''}`} onClick={() => setUserStatus('active')}>Active</button>
              <button className={`status-badge inactive-status ${userStatus === 'inactive' ? 'active' : ''}`} onClick={() => setUserStatus('inactive')}>Inactive</button>
            </div>

            {/* User Controls */}
            <div className="results-header">
              <div className="results-info">
                <i className="fas fa-users"></i>
                <span>{users.length} users found</span>
              </div>
              <div className="results-controls">
                <div className="sort-group">
                  <i className="fas fa-sort"></i>
                  <select value={userSortBy} onChange={(e) => setUserSortBy(e.target.value)}>
                    {userSortOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Users Results */}
            <div className="users-grid">
              {users.map(user => (
                <div key={user.id} className="user-card" onClick={() => handleViewUser(user.id)}>
                  <div className="user-avatar">{user.username.charAt(0).toUpperCase()}</div>
                  <div className="user-info">
                    <div className="user-name">{user.username}</div>
                    <div className="user-email">{user.email}</div>
                    <div className="user-role">
                      <span className={`role-badge ${user.role}`}>
                        {user.role === 'global_admin' ? 'Global Admin' : user.role === 'space_admin' ? 'Space Admin' : 'User'}
                      </span>
                      <span className={`user-status ${user.is_active ? 'active' : 'inactive'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========== ACTIVITIES SECTION ========== */}
        {(activeCategory === 'activities' || activeCategory === 'all') && activities.length > 0 && (
          <div className="search-section">
            <div className="section-header">
              <h2>
                <i className="fas fa-history"></i>
                Activities ({activities.length})
              </h2>
            </div>

            {/* Action Tabs */}
            <div className="filter-tabs">
              {actionTabs.map(tab => (
                <button
                  key={tab.id}
                  className={`filter-tab ${activeAction === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveAction(tab.id)}
                >
                  <i className={`fas ${tab.icon}`}></i>
                  <span>{tab.label}</span>
                  {tab.count > 0 && <span className="filter-count">{tab.count}</span>}
                </button>
              ))}
            </div>

            {/* Activity Status Filter */}
            <div className="status-filters">
              <button className={`status-badge ${activityStatus === 'all' ? 'active' : ''}`} onClick={() => setActivityStatus('all')}>All</button>
              <button className={`status-badge success-status ${activityStatus === 'success' ? 'active' : ''}`} onClick={() => setActivityStatus('success')}>Success</button>
              <button className={`status-badge failed-status ${activityStatus === 'failed' ? 'active' : ''}`} onClick={() => setActivityStatus('failed')}>Failed</button>
            </div>

            {/* Activity Controls */}
            <div className="results-header">
              <div className="results-info">
                <i className="fas fa-history"></i>
                <span>{activities.length} activities found</span>
              </div>
              <div className="results-controls">
                <div className="sort-group">
                  <i className="fas fa-sort"></i>
                  <select value={activitySortBy} onChange={(e) => setActivitySortBy(e.target.value)}>
                    {activitySortOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Activities Results */}
            <div className="activities-list">
              {activities.map(activity => (
                <div key={activity.id} className="activity-card">
                  <div className="activity-icon"><i className={`fas ${getActionIcon(activity.action)}`}></i></div>
                  <div className="activity-info">
                    <div className="activity-user"><strong>{activity.user}</strong> <span className="activity-action">{getActionLabel(activity.action)}</span></div>
                    <div className="activity-details">
                      {activity.resource && <span><i className="fas fa-file-alt"></i>{activity.resource}</span>}
                      <span><i className="fas fa-clock"></i>{formatDate(activity.timestamp)}</span>
                      <span><i className="fas fa-network-wired"></i>{activity.ip_address}</span>
                    </div>
                  </div>
                  <div className={`activity-status ${activity.status}`}>
                    {activity.status === 'success' ? '✓' : '✗'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!query ? (
          <div className="empty-state">
            <i className="fas fa-search"></i>
            <h3>Enter a search term</h3>
            <p>Search for files, users, activities, and more...</p>
          </div>
        ) : error ? (
          <div className="error-container">
            <i className="fas fa-exclamation-triangle"></i>
            <p>{error}</p>
            <button className="btn-retry" onClick={performSearch}>Try Again</button>
          </div>
        ) : totalResults === 0 ? (
          <div className="empty-state">
            <i className="fas fa-folder-open"></i>
            <h3>No results found</h3>
            <p>We couldn't find any matches for "{query}"</p>
            <button className="btn-clear" onClick={() => navigate(-1)}>Go Back</button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Search;