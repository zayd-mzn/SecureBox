import React, { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatBytes } from '../utils/formatters';
import axios from 'axios';

const SharedWithMe = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_URL = 'http://localhost:5000/api';

  useEffect(() => {
    fetchSharedFiles();
  }, []);

  const fetchSharedFiles = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/files/shared-with-me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFiles(response.data);
    } catch (err) {
      console.error('Error fetching shared files:', err);
      setError(err.response?.data?.error || 'Failed to load shared files');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="error-container">{error}</div>;

  return (
    <div className="shared-page">
      <div className="page-header">
        <h1><i className="fas fa-share-alt"></i> Shared With Me</h1>
      </div>
      <div className="files-grid">
        {files.length === 0 ? (
          <div className="empty-state"><i className="fas fa-share-alt"></i><p>No files shared with you yet</p></div>
        ) : (
          files.map(file => (
            <div key={file.id} className="file-card">
              <div className="file-icon"><i className="fas fa-file-alt"></i></div>
              <div className="file-info">
                <div className="file-name">{file.filename}</div>
                <div className="file-meta">Shared by {file.owner} • {formatBytes(file.size)}</div>
              </div>
              <div className="file-actions">
                <button className="action-btn"><i className="fas fa-download"></i></button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SharedWithMe;