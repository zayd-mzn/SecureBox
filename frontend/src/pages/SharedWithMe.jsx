import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { formatBytes } from '../utils/formatters';
import '../styles/SharedWithMe.css';

const API_URL = 'http://localhost:5000/api';

const SharedWithMe = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');
  const [viewMode, setViewMode] = useState('grid');
  const [filterPermission, setFilterPermission] = useState('all');

  useEffect(() => {
    fetchSharedFiles();
  }, []);

  const fetchSharedFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/files/shared-with-me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFiles(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load shared files');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (fileId, filename) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/files/download/${fileId}`, {
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
    } catch (err) {
      alert('Download failed');
    }
  };

  const getFileIcon = (type) => {
    const icons = {
      document: { icon: 'fa-file-alt', color: '#4299e1' },
      image:    { icon: 'fa-image',    color: '#48bb78' },
      video:    { icon: 'fa-video',    color: '#ed8936' },
      audio:    { icon: 'fa-music',    color: '#9f7aea' },
      archive:  { icon: 'fa-file-archive', color: '#e53e3e' },
      other:    { icon: 'fa-file',     color: '#718096' }
    };
    return icons[type] || icons.other;
  };

  const getPermissionBadges = (permissions) => {
    const badges = [];
    if (permissions.read)   badges.push({ label: 'Read',   icon: 'fa-eye',       color: '#4299e1' });
    if (permissions.write)  badges.push({ label: 'Write',  icon: 'fa-pen',       color: '#48bb78' });
    if (permissions.delete) badges.push({ label: 'Delete', icon: 'fa-trash',     color: '#e53e3e' });
    if (permissions.share)  badges.push({ label: 'Share',  icon: 'fa-share-alt', color: '#9f7aea' });
    return badges;
  };

  const filteredFiles = files
    .filter(f => filterType === 'all' || f.file_type === filterType)
    .filter(f => {
      if (filterPermission === 'all') return true;
      return f.permissions[filterPermission];
    })
    .filter(f => f.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
                 f.owner.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.shared_at) - new Date(a.shared_at);
      if (sortBy === 'date_asc')  return new Date(a.shared_at) - new Date(b.shared_at);
      if (sortBy === 'name_asc')  return a.filename.localeCompare(b.filename);
      if (sortBy === 'name_desc') return b.filename.localeCompare(a.filename);
      if (sortBy === 'size_desc') return b.size - a.size;
      if (sortBy === 'size_asc')  return a.size - b.size;
      return 0;
    });

  if (loading) return (
    <div className="loading-state">
      <i className="fas fa-spinner fa-spin"></i>
      <p>Loading shared files...</p>
    </div>
  );

  if (error) return (
    <div className="error-state">
      <i className="fas fa-exclamation-triangle"></i>
      <p>{error}</p>
      <button onClick={fetchSharedFiles}>Retry</button>
    </div>
  );

  return (
    <div className="shared-page">

      {/* Header */}
      <div className="shared-header">
        <div>
          <h1><i className="fas fa-share-alt"></i> Shared With Me</h1>
          <p className="shared-subtitle">
            {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''} shared with you
          </p>
        </div>
        <button className="btn-refresh" onClick={fetchSharedFiles}>
          <i className="fas fa-sync-alt"></i> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="shared-filters">
        <div className="search-box">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Search by filename or owner..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All Types</option>
            <option value="document">Documents</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="audio">Audio</option>
            <option value="archive">Archives</option>
            <option value="other">Other</option>
          </select>

          <select value={filterPermission} onChange={(e) => setFilterPermission(e.target.value)}>
            <option value="all">All Permissions</option>
            <option value="read">Read</option>
            <option value="write">Write</option>
            <option value="delete">Delete</option>
            <option value="share">Share</option>
          </select>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="name_asc">Name A-Z</option>
            <option value="name_desc">Name Z-A</option>
            <option value="size_desc">Largest First</option>
            <option value="size_asc">Smallest First</option>
          </select>
        </div>

        <div className="view-toggle">
          <button
            className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
          >
            <i className="fas fa-th"></i>
          </button>
          <button
            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            <i className="fas fa-list"></i>
          </button>
        </div>
      </div>

      {/* Files */}
      {filteredFiles.length === 0 ? (
        <div className="empty-state">
          <i className="fas fa-share-alt"></i>
          <h3>No shared files found</h3>
          <p>No files have been shared with you yet, or none match your filters.</p>
        </div>
      ) : (
        <div className={`shared-container ${viewMode}`}>
          {filteredFiles.map(file => {
            const { icon, color } = getFileIcon(file.file_type);
            const permBadges = getPermissionBadges(file.permissions);
            return (
              <div key={file.id} className="shared-card">
                <div className="file-icon" style={{ color }}>
                  <i className={`fas ${icon}`}></i>
                </div>

                <div className="file-info">
                  <div className="file-name" title={file.filename}>
                    {file.filename}
                  </div>
                  <div className="file-meta">
                    <span>
                      <i className="fas fa-user"></i> {file.owner}
                    </span>
                    <span>
                      <i className="fas fa-weight"></i> {formatBytes(file.size)}
                    </span>
                    <span>
                      <i className="fas fa-calendar"></i>{' '}
                      {new Date(file.shared_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Permission badges */}
                  <div className="permission-badges">
                    {permBadges.map(badge => (
                      <span
                        key={badge.label}
                        className="perm-badge"
                        style={{ color: badge.color, borderColor: badge.color }}
                      >
                        <i className={`fas ${badge.icon}`}></i> {badge.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="file-actions">
                  <button
                    className="action-btn download"
                    title="Download"
                    onClick={() => handleDownload(file.id, file.filename)}
                  >
                    <i className="fas fa-download"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SharedWithMe;
