import React, { useState, useEffect, useMemo } from 'react';
import { formatBytes } from '../utils/formatters';
import '../styles/VersionHistory.css';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:5000/api';

const VersionHistory = () => {
  const [allVersions, setAllVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ text: '', type: '' });
  const [expandedFile, setExpandedFile] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAllVersions();
  }, []);

  const fetchAllVersions = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/files/versions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllVersions(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  const showMsg = (text, type = 'success') => {
    setSaveMessage({ text, type });
    setTimeout(() => setSaveMessage({ text: '', type: '' }), 3000);
  };

  const handleRestore = async (fileId, versionId, versionNumber) => {
    if (!window.confirm(`Restore version ${versionNumber}? This will become the current version.`)) return;
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(`${API_URL}/files/${fileId}/versions/${versionId}/restore`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showMsg(`Version ${versionNumber} restored successfully!`, 'success');
      fetchAllVersions();
    } catch (err) {
      showMsg(err.response?.data?.error || 'Failed to restore version', 'error');
    }
  };

  const handleDownload = async (fileId, versionId, filename, versionNumber) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(
        `${API_URL}/files/${fileId}/versions/${versionId}/download`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${filename}_v${versionNumber}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showMsg('Download failed', 'error');
    }
  };

  // Group versions by file
  const groupedByFile = useMemo(() => {
    const groups = {};
    allVersions.forEach(v => {
      if (!groups[v.file_id]) {
        groups[v.file_id] = {
          file_id: v.file_id,
          filename: v.filename,
          file_type: v.file_type,
          versions: []
        };
      }
      groups[v.file_id].versions.push(v);
    });
    return Object.values(groups);
  }, [allVersions]);

  const filteredVersions = useMemo(() => {
    let filtered = [...allVersions];

    if (searchTerm) {
      filtered = filtered.filter(v =>
        v.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.comment && v.comment.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(v => v.file_type === filterType);
    }

    filtered.sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.created_at) - new Date(a.created_at);
      if (sortBy === 'date_asc')  return new Date(a.created_at) - new Date(b.created_at);
      if (sortBy === 'name_asc')  return a.filename.localeCompare(b.filename);
      if (sortBy === 'name_desc') return b.filename.localeCompare(a.filename);
      return 0;
    });

    return filtered;
  }, [allVersions, searchTerm, filterType, sortBy]);

  const getFileIcon = (type) => {
    const icons = {
      document: { icon: 'fa-file-alt',     color: '#4299e1' },
      image:    { icon: 'fa-image',         color: '#48bb78' },
      video:    { icon: 'fa-video',         color: '#ed8936' },
      audio:    { icon: 'fa-music',         color: '#9f7aea' },
      archive:  { icon: 'fa-file-archive',  color: '#e53e3e' },
      other:    { icon: 'fa-file',          color: '#718096' }
    };
    return icons[type] || icons.other;
  };

  const stats = {
    totalVersions: allVersions.length,
    totalFiles: groupedByFile.length,
    latestDate: allVersions[0]?.created_at,
    authors: [...new Set(allVersions.map(v => v.author))].length
  };

  if (loading) return (
    <div className="loading-state">
      <i className="fas fa-spinner fa-spin"></i>
      <p>Loading version history...</p>
    </div>
  );

  if (error) return (
    <div className="error-state">
      <i className="fas fa-exclamation-triangle"></i>
      <p>{error}</p>
      <button onClick={fetchAllVersions}>Retry</button>
    </div>
  );

  return (
    <div className="version-history-page">

      {/* Header */}
      <div className="version-header">
        <div>
          <h1><i className="fas fa-history"></i> Version History</h1>
          <p className="version-subtitle">Track and manage all versions of your files</p>
        </div>
        {saveMessage.text && (
          <div className={`save-message ${saveMessage.type}`}>
            <i className={`fas ${saveMessage.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
            {saveMessage.text}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="version-stats-grid">
        <div className="stat-card">
          <div className="stat-icon total"><i className="fas fa-code-branch"></i></div>
          <div className="stat-info">
            <span className="stat-label">Total Versions</span>
            <span className="stat-value">{stats.totalVersions}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon latest"><i className="fas fa-folder-open"></i></div>
          <div className="stat-info">
            <span className="stat-label">Files Tracked</span>
            <span className="stat-value">{stats.totalFiles}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon original"><i className="fas fa-calendar-alt"></i></div>
          <div className="stat-info">
            <span className="stat-label">Last Modified</span>
            <span className="stat-value" style={{ fontSize: '1rem' }}>
              {stats.latestDate ? new Date(stats.latestDate).toLocaleDateString() : '—'}
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon authors"><i className="fas fa-users"></i></div>
          <div className="stat-info">
            <span className="stat-label">Contributors</span>
            <span className="stat-value">{stats.authors}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="version-filters">
        <div className="search-box">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Search by file, author or comment..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <select className="filter-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All Types</option>
            <option value="document">Documents</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="audio">Audio</option>
            <option value="archive">Archives</option>
            <option value="other">Other</option>
          </select>
          <select className="filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="name_asc">File Name A-Z</option>
            <option value="name_desc">File Name Z-A</option>
          </select>
        </div>
      </div>

      {/* Versions Timeline */}
      {filteredVersions.length === 0 ? (
        <div className="empty-state">
          <i className="fas fa-history"></i>
          <p>No version history found</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <div className="card-header-left">
              <h2><i className="fas fa-list"></i> Version Timeline</h2>
              <p className="card-description">{filteredVersions.length} version{filteredVersions.length !== 1 ? 's' : ''} found</p>
            </div>
          </div>

          <div className="versions-timeline">
            {filteredVersions.map((version, idx) => {
              const { icon, color } = getFileIcon(version.file_type);
              const isLatest = version.is_latest;
              const isOriginal = version.version_number === 1;
              const badgeClass = isLatest ? 'latest' : isOriginal ? 'original' : 'normal';

              return (
                <div
                  key={version.id}
                  className={`timeline-item ${badgeClass}`}
                >
                  <div className="timeline-marker">
                    <div className="marker-dot"></div>
                    {idx < filteredVersions.length - 1 && <div className="marker-line"></div>}
                  </div>

                  <div className="version-card">
                    <div className="version-header">
                      <div className="version-badge">
                        <span className={`badge ${badgeClass}`}>
                          {isLatest ? 'Current' : isOriginal ? 'Original' : `v${version.version_number}`}
                        </span>
                      </div>
                      <div className="version-file-info">
                        <i className={`fas ${icon}`} style={{ color, marginRight: '0.5rem' }}></i>
                        <span className="version-filename">{version.filename}</span>
                      </div>
                    </div>

                    <div className="version-details">
                      <div className="detail-row">
                        <i className="fas fa-hashtag"></i>
                        <span className="detail-label">Version:</span>
                        <span className="detail-value">v{version.version_number}</span>
                      </div>
                      <div className="detail-row">
                        <i className="fas fa-user-circle"></i>
                        <span className="detail-label">Author:</span>
                        <span className="detail-value">{version.author}</span>
                      </div>
                      <div className="detail-row">
                        <i className="fas fa-calendar-alt"></i>
                        <span className="detail-label">Date:</span>
                        <span className="detail-value">
                          {new Date(version.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="detail-row">
                        <i className="fas fa-database"></i>
                        <span className="detail-label">Size:</span>
                        <span className="detail-value">{formatBytes(version.size)}</span>
                      </div>
                      {version.comment && (
                        <div className="detail-row comment">
                          <i className="fas fa-comment"></i>
                          <span className="detail-label">Comment:</span>
                          <span className="detail-value">{version.comment}</span>
                        </div>
                      )}
                    </div>

                    <div className="version-actions">
                      <button
                        className="action-btn view"
                        onClick={() => { setSelectedVersion(version); setShowDetailsModal(true); }}
                        title="View Details"
                      >
                        <i className="fas fa-eye"></i> Details
                      </button>
                      <button
                        className="action-btn download"
                        onClick={() => handleDownload(version.file_id, version.id, version.filename, version.version_number)}
                        title="Download this version"
                      >
                        <i className="fas fa-download"></i> Download
                      </button>
                      {!isLatest && (
                        <button
                          className="action-btn restore"
                          onClick={() => handleRestore(version.file_id, version.id, version.version_number)}
                          title="Restore this version"
                        >
                          <i className="fas fa-undo-alt"></i> Restore
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedVersion && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-info-circle"></i> Version Details</h2>
              <button className="modal-close" onClick={() => setShowDetailsModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-group">
                <label>File</label>
                <div className="detail-value">
                  <i className="fas fa-file-alt"></i> {selectedVersion.filename}
                </div>
              </div>
              <div className="detail-group">
                <label>Version Number</label>
                <div className="detail-value">
                  <span className="version-number-badge">v{selectedVersion.version_number}</span>
                </div>
              </div>
              <div className="detail-group">
                <label>Author</label>
                <div className="detail-value">
                  <i className="fas fa-user-circle"></i> {selectedVersion.author}
                </div>
              </div>
              <div className="detail-group">
                <label>Date</label>
                <div className="detail-value">
                  <i className="fas fa-calendar-alt"></i>{' '}
                  {new Date(selectedVersion.created_at).toLocaleString()}
                </div>
              </div>
              <div className="detail-group">
                <label>Size</label>
                <div className="detail-value">
                  <i className="fas fa-database"></i> {formatBytes(selectedVersion.size)}
                </div>
              </div>
              {selectedVersion.checksum && (
                <div className="detail-group">
                  <label>Checksum (SHA-256)</label>
                  <div className="detail-value" style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>
                    {selectedVersion.checksum}
                  </div>
                </div>
              )}
              {selectedVersion.comment && (
                <div className="detail-group">
                  <label>Comment</label>
                  <div className="detail-value description">{selectedVersion.comment}</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-close" onClick={() => setShowDetailsModal(false)}>
                Close
              </button>
              {!selectedVersion.is_latest && (
                <button
                  className="btn-restore"
                  onClick={() => {
                    handleRestore(selectedVersion.file_id, selectedVersion.id, selectedVersion.version_number);
                    setShowDetailsModal(false);
                  }}
                >
                  <i className="fas fa-undo-alt"></i> Restore This Version
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VersionHistory;
