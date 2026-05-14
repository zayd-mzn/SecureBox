import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { formatBytes } from '../utils/formatters';
import '../styles/RecycleBin.css';

const API_URL = 'http://localhost:5000/api';

const RecycleBin = () => {
  const [deletedFiles, setDeletedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchDeletedFiles();
  }, []);

  const fetchDeletedFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/files/recycle-bin`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Recycle bin data:', response.data); // ← AJOUTE CETTE LIGNE
      setDeletedFiles(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load recycle bin');
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };
const handleRestore = async (originalId, filename) => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(`${API_URL}/files/${originalId}/restore`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showSuccess(`"${filename}" restored successfully!`);
      fetchDeletedFiles();
    } catch (err) {
      alert(err.response?.data?.error || 'Restore failed');
    }
  };

  const handlePermanentDelete = async (originalId, filename) => {
    if (!window.confirm(`Permanently delete "${filename}"? This cannot be undone.`)) return;
    try {
      const token = localStorage.getItem('access_token');
      await axios.delete(`${API_URL}/files/${originalId}/permanent`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showSuccess(`"${filename}" permanently deleted.`);
      fetchDeletedFiles();
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed');
    }
  };
  const handleEmptyBin = async () => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.delete(`${API_URL}/files/recycle-bin/empty`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfirmEmpty(false);
      showSuccess('Recycle bin emptied successfully!');
      fetchDeletedFiles();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to empty bin');
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

  const getDaysColor = (days) => {
    if (days <= 5) return '#e53e3e';
    if (days <= 10) return '#ed8936';
    return '#48bb78';
  };

  const filteredFiles = deletedFiles
    .filter(f => f.filename.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.deleted_date) - new Date(a.deleted_date);
      if (sortBy === 'date_asc')  return new Date(a.deleted_date) - new Date(b.deleted_date);
      if (sortBy === 'name_asc')  return a.filename.localeCompare(b.filename);
      if (sortBy === 'name_desc') return b.filename.localeCompare(a.filename);
      if (sortBy === 'days_asc')  return a.permanent_delete_days - b.permanent_delete_days;
      return 0;
    });

  if (loading) return (
    <div className="loading-state">
      <i className="fas fa-spinner fa-spin"></i>
      <p>Loading recycle bin...</p>
    </div>
  );

  if (error) return (
    <div className="error-state">
      <i className="fas fa-exclamation-triangle"></i>
      <p>{error}</p>
      <button onClick={fetchDeletedFiles}>Retry</button>
    </div>
  );

  return (
    <div className="recycle-bin-page">

      {/* Header */}
      <div className="recycle-header">
        <div>
          <h1><i className="fas fa-trash-alt"></i> Recycle Bin</h1>
          <p className="recycle-subtitle">
            {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''} — auto-deleted after 30 days
          </p>
        </div>
        {deletedFiles.length > 0 && (
          <button className="btn-empty-bin" onClick={() => setConfirmEmpty(true)}>
            <i className="fas fa-trash"></i> Empty Bin
          </button>
        )}
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="success-alert">
          <i className="fas fa-check-circle"></i> {successMsg}
        </div>
      )}

      {/* Filters */}
      {deletedFiles.length > 0 && (
        <div className="recycle-filters">
          <div className="search-box">
            <i className="fas fa-search"></i>
            <input
              type="text"
              placeholder="Search deleted files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="date_desc">Newest Deleted</option>
              <option value="date_asc">Oldest Deleted</option>
              <option value="name_asc">Name A-Z</option>
              <option value="name_desc">Name Z-A</option>
              <option value="days_asc">Expiring Soon</option>
            </select>
          </div>
        </div>
      )}

      {/* Files List */}
      {filteredFiles.length === 0 ? (
        <div className="empty-state">
          <i className="fas fa-trash-alt"></i>
          <h3>Recycle bin is empty</h3>
          <p>Deleted files will appear here for 30 days before permanent deletion.</p>
        </div>
      ) : (
        <div className="recycle-list">
          {filteredFiles.map(file => {
            const { icon, color } = getFileIcon(file.file_type);
            const daysColor = getDaysColor(file.permanent_delete_days);
            return (
              <div key={file.id} className="recycle-card">
                <div className="file-icon" style={{ color }}>
                  <i className={`fas ${icon}`}></i>
                </div>

                <div className="file-info">
                  <div className="file-name" title={file.filename}>
                    {file.filename}
                  </div>
                  <div className="file-meta">
                    <span><i className="fas fa-weight"></i> {formatBytes(file.size)}</span>
                    <span>
                      <i className="fas fa-calendar-times"></i> Deleted:{' '}
                      {new Date(file.deleted_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div
                    className="auto-delete-warning"
                    style={{ color: daysColor }}
                  >
                    <i className="fas fa-clock"></i>
                    {file.permanent_delete_days <= 0
                      ? ' Scheduled for deletion'
                      : ` Auto-delete in ${file.permanent_delete_days} day${file.permanent_delete_days !== 1 ? 's' : ''}`
                    }
                  </div>
                </div>

                <div className="file-actions">
                  <button
                    className="action-btn restore"
                    title="Restore file"
                    onClick={() => handleRestore(file.original_id, file.filename)}
                  >
                    <i className="fas fa-undo"></i>
                    <span>Restore</span>
                  </button>
                  <button
                    className="action-btn delete"
                    title="Permanently delete"
                    onClick={() => handlePermanentDelete(file.original_id, file.filename)}
                  >
                    <i className="fas fa-times"></i>
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm Empty Modal */}
      {confirmEmpty && (
        <div className="modal-overlay" onClick={() => setConfirmEmpty(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-exclamation-triangle"></i> Empty Recycle Bin</h2>
              <button className="modal-close" onClick={() => setConfirmEmpty(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to permanently delete all <strong>{deletedFiles.length} files</strong>?</p>
              <p className="warning-text">
                <i className="fas fa-exclamation-circle"></i> This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setConfirmEmpty(false)}>
                Cancel
              </button>
              <button className="btn-confirm-delete" onClick={handleEmptyBin}>
                <i className="fas fa-trash"></i> Yes, Empty Bin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecycleBin;