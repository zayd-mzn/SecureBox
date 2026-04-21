import React, { useState, useEffect, useMemo } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatBytes, formatDate } from '../utils/formatters';
import '../styles/VersionHistory.css';
import axios from 'axios';
import { useSearchParams, useNavigate } from 'react-router-dom';

const VersionHistory = () => {
  const [versions, setVersions] = useState([]);
  const [fileInfo, setFileInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams] = useSearchParams();
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVersion, setFilterVersion] = useState('all');
  
  const fileId = searchParams.get('fileId');
  const navigate = useNavigate();

  const API_URL = 'http://localhost:5000/api';

  useEffect(() => {
    if (fileId) {
      fetchVersions();
      fetchFileInfo();
    } else {
      setLoading(false);
    }
  }, [fileId]);

  const fetchVersions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/versions/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVersions(response.data);
    } catch (err) {
      console.error('Error fetching versions:', err);
      setError(err.response?.data?.error || 'Failed to load versions');
    } finally {
      setLoading(false);
    }
  };

  const fetchFileInfo = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/files/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFileInfo(response.data);
    } catch (err) {
      console.error('Error fetching file info:', err);
    }
  };

  const handleRestore = async (versionId) => {
    if (window.confirm(`Are you sure you want to restore version ${versionId}? This will replace the current file.`)) {
      try {
        setLoading(true);
        const token = localStorage.getItem('access_token');
        await axios.post(`${API_URL}/versions/${fileId}/${versionId}/restore`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSaveMessage(`Version ${versionId} restored successfully!`);
        setTimeout(() => setSaveMessage(''), 3000);
        fetchVersions();
      } catch (err) {
        console.error('Restore error:', err);
        setSaveMessage('Failed to restore version');
        setTimeout(() => setSaveMessage(''), 3000);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDownload = async (version) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/versions/${fileId}/${version.version}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${fileInfo?.filename || 'file'}_v${version.version}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      setSaveMessage('Failed to download version');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const handleViewDetails = (version) => {
    setSelectedVersion(version);
    setShowDetailsModal(true);
  };

  const handleCompareToggle = (version) => {
    if (selectedVersions.includes(version.version)) {
      setSelectedVersions(selectedVersions.filter(v => v !== version.version));
    } else {
      if (selectedVersions.length < 2) {
        setSelectedVersions([...selectedVersions, version.version]);
      } else {
        setSaveMessage('You can only compare up to 2 versions');
        setTimeout(() => setSaveMessage(''), 3000);
      }
    }
  };

  const handleCompare = () => {
    if (selectedVersions.length === 2) {
      navigate(`/version-compare?fileId=${fileId}&v1=${selectedVersions[0]}&v2=${selectedVersions[1]}`);
    }
  };

  const getVersionBadgeClass = (versionNumber, totalVersions) => {
    if (versionNumber === totalVersions) return 'latest';
    if (versionNumber === 1) return 'original';
    return 'normal';
  };

  const getVersionLabel = (versionNumber, totalVersions) => {
    if (versionNumber === totalVersions) return 'Current Version';
    if (versionNumber === 1) return 'Original';
    return `Version ${versionNumber}`;
  };

  const filteredVersions = useMemo(() => {
    let filtered = [...versions];
    
    if (searchTerm) {
      filtered = filtered.filter(v =>
        v.author?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.comment?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (filterVersion !== 'all') {
      if (filterVersion === 'latest') {
        filtered = filtered.slice(0, 1);
      } else if (filterVersion === 'original') {
        filtered = filtered.slice(-1);
      }
    }
    
    return filtered;
  }, [versions, searchTerm, filterVersion]);

  const stats = {
    totalVersions: versions.length,
    latestVersion: versions[0]?.version || 0,
    originalVersion: versions[versions.length - 1]?.version || 0,
    totalSize: versions.reduce((sum, v) => sum + v.size, 0),
    authors: [...new Set(versions.map(v => v.author))]
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="error-container">{error}</div>;

  return (
    <div className="version-history-page">
      {/* Header */}
      <div className="version-header">
        <div>
          <h1>
            <i className="fas fa-history"></i>
            Version History
          </h1>
          <p className="version-subtitle">Track and manage file version history</p>
        </div>
        {saveMessage && (
          <div className={`save-message ${saveMessage.includes('success') ? 'success' : 'error'}`}>
            <i className={`fas ${saveMessage.includes('success') ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
            {saveMessage}
          </div>
        )}
      </div>

      {/* File Info Card */}
      {fileInfo && (
        <div className="file-info-card">
          <div className="file-icon">
            <i className="fas fa-file-alt"></i>
          </div>
          <div className="file-details">
            <h3>{fileInfo.filename}</h3>
            <p>
              <span><i className="fas fa-user"></i> Owner: {fileInfo.owner || 'Unknown'}</span>
              <span><i className="fas fa-calendar"></i> Created: {formatDate(fileInfo.created_at)}</span>
              <span><i className="fas fa-database"></i> Size: {formatBytes(fileInfo.size)}</span>
            </p>
          </div>
          <button className="btn-back" onClick={() => navigate(-1)}>
            <i className="fas fa-arrow-left"></i>
            Back
          </button>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="version-stats-grid">
        <div className="stat-card">
          <div className="stat-icon total">
            <i className="fas fa-code-branch"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Versions</span>
            <span className="stat-value">{stats.totalVersions}</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon latest">
            <i className="fas fa-star"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Latest Version</span>
            <span className="stat-value">v{stats.latestVersion}</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon original">
            <i className="fas fa-flag-checkered"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Original Version</span>
            <span className="stat-value">v{stats.originalVersion}</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon authors">
            <i className="fas fa-users"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Contributors</span>
            <span className="stat-value">{stats.authors.length}</span>
          </div>
        </div>
      </div>

      {/* Compare Mode Toggle */}
      <div className="compare-mode-bar">
        <label className="compare-toggle">
          <input
            type="checkbox"
            checked={compareMode}
            onChange={(e) => {
              setCompareMode(e.target.checked);
              setSelectedVersions([]);
            }}
          />
          <span className="compare-slider"></span>
          <span className="compare-label">
            <i className="fas fa-code-branch"></i>
            Compare Versions
          </span>
        </label>
        {compareMode && selectedVersions.length === 2 && (
          <button className="btn-compare" onClick={handleCompare}>
            <i className="fas fa-exchange-alt"></i>
            Compare Selected
          </button>
        )}
      </div>

      {/* Main Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-header-left">
            <h2>
              <i className="fas fa-list"></i>
              Version Timeline
            </h2>
            <p className="card-description">View and manage all versions of this file</p>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="version-filters">
          <div className="search-box">
            <i className="fas fa-search"></i>
            <input
              type="text"
              placeholder="Search by author or comment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="filter-group">
            <select
              className="filter-select"
              value={filterVersion}
              onChange={(e) => setFilterVersion(e.target.value)}
            >
              <option value="all">All Versions</option>
              <option value="latest">Latest Only</option>
              <option value="original">Original Only</option>
            </select>
          </div>
        </div>

        {/* Versions List */}
        {filteredVersions.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-history"></i>
            <p>No version history available</p>
          </div>
        ) : (
          <div className="versions-timeline">
            {filteredVersions.map((version, idx) => {
              const isLatest = idx === 0;
              const isOriginal = idx === filteredVersions.length - 1;
              const badgeClass = getVersionBadgeClass(version.version, stats.totalVersions);
              const isSelected = selectedVersions.includes(version.version);
              
              return (
                <div key={idx} className={`timeline-item ${badgeClass} ${compareMode && isSelected ? 'selected' : ''}`}>
                  <div className="timeline-marker">
                    <div className="marker-dot"></div>
                    {!isOriginal && <div className="marker-line"></div>}
                  </div>
                  
                  <div className="version-card">
                    <div className="version-header">
                      <div className="version-badge">
                        <span className={`badge ${badgeClass}`}>
                          {getVersionLabel(version.version, stats.totalVersions)}
                        </span>
                      </div>
                      {compareMode && (
                        <label className="compare-checkbox">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleCompareToggle(version)}
                            disabled={selectedVersions.length === 2 && !isSelected}
                          />
                          <span className="checkmark"></span>
                        </label>
                      )}
                    </div>
                    
                    <div className="version-details">
                      <div className="detail-row">
                        <i className="fas fa-user-circle"></i>
                        <span className="detail-label">Author:</span>
                        <span className="detail-value">{version.author}</span>
                      </div>
                      <div className="detail-row">
                        <i className="fas fa-calendar-alt"></i>
                        <span className="detail-label">Date:</span>
                        <span className="detail-value">{new Date(version.date).toLocaleString()}</span>
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
                        onClick={() => handleViewDetails(version)}
                        title="View Details"
                      >
                        <i className="fas fa-eye"></i>
                        Details
                      </button>
                      <button 
                        className="action-btn download"
                        onClick={() => handleDownload(version)}
                        title="Download"
                      >
                        <i className="fas fa-download"></i>
                        Download
                      </button>
                      {!isLatest && (
                        <button 
                          className="action-btn restore"
                          onClick={() => handleRestore(version.version)}
                          title="Restore this version"
                        >
                          <i className="fas fa-undo-alt"></i>
                          Restore
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Version Details Modal */}
      {showDetailsModal && selectedVersion && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <i className="fas fa-info-circle"></i>
                Version Details
              </h2>
              <button className="modal-close" onClick={() => setShowDetailsModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="detail-group">
                <label>Version Number</label>
                <div className="detail-value">
                  <span className="version-number-badge">v{selectedVersion.version}</span>
                </div>
              </div>
              
              <div className="detail-group">
                <label>Author</label>
                <div className="detail-value">
                  <i className="fas fa-user-circle"></i>
                  {selectedVersion.author}
                </div>
              </div>
              
              <div className="detail-group">
                <label>Date Created</label>
                <div className="detail-value">
                  <i className="fas fa-calendar-alt"></i>
                  {new Date(selectedVersion.date).toLocaleString()}
                </div>
              </div>
              
              <div className="detail-group">
                <label>File Size</label>
                <div className="detail-value">
                  <i className="fas fa-database"></i>
                  {formatBytes(selectedVersion.size)}
                </div>
              </div>
              
              {selectedVersion.comment && (
                <div className="detail-group">
                  <label>Comment</label>
                  <div className="detail-value description">
                    {selectedVersion.comment}
                  </div>
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button className="btn-close" onClick={() => setShowDetailsModal(false)}>
                Close
              </button>
              {selectedVersion.version !== stats.latestVersion && (
                <button 
                  className="btn-restore"
                  onClick={() => {
                    handleRestore(selectedVersion.version);
                    setShowDetailsModal(false);
                  }}
                >
                  <i className="fas fa-undo-alt"></i>
                  Restore This Version
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