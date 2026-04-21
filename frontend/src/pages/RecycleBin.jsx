import React, { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatBytes } from '../utils/formatters';
import axios from 'axios';

const RecycleBin = () => {
  const [deletedFiles, setDeletedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_URL = 'http://localhost:5000/api';

  useEffect(() => {
    fetchDeletedFiles();
  }, []);

  const fetchDeletedFiles = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/files/recycle-bin`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDeletedFiles(response.data);
    } catch (err) {
      console.error('Error fetching deleted files:', err);
      setError(err.response?.data?.error || 'Failed to load recycle bin');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id) => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(`${API_URL}/files/${id}/restore`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchDeletedFiles();
    } catch (err) {
      console.error('Restore error:', err);
    }
  };

  const handlePermanentDelete = async (id) => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.delete(`${API_URL}/files/${id}/permanent`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchDeletedFiles();
    } catch (err) {
      console.error('Permanent delete error:', err);
    }
  };

  const handleEmptyBin = async () => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.delete(`${API_URL}/files/recycle-bin/empty`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchDeletedFiles();
    } catch (err) {
      console.error('Empty bin error:', err);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="error-container">{error}</div>;

  return (
    <div className="recycle-bin-page">
      <div className="page-header">
        <h1><i className="fas fa-trash-alt"></i> Recycle Bin</h1>
        {deletedFiles.length > 0 && (
          <button className="empty-btn" onClick={handleEmptyBin}>Empty Bin</button>
        )}
      </div>
      <div className="files-grid">
        {deletedFiles.length === 0 ? (
          <div className="empty-state"><i className="fas fa-trash-alt"></i><p>Recycle bin is empty</p></div>
        ) : (
          deletedFiles.map(file => (
            <div key={file.id} className="file-card deleted">
              <div className="file-icon"><i className="fas fa-file-alt"></i></div>
              <div className="file-info">
                <div className="file-name">{file.filename}</div>
                <div className="file-meta">{formatBytes(file.size)} • Deleted: {new Date(file.deleted_date).toLocaleDateString()}</div>
                <div className="warning">Auto-delete in {file.permanent_delete_days} days</div>
              </div>
              <div className="file-actions">
                <button className="action-btn restore" onClick={() => handleRestore(file.id)}>↩️ Restore</button>
                <button className="action-btn delete" onClick={() => handlePermanentDelete(file.id)}>❌ Permanent Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RecycleBin;