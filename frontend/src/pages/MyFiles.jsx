import React, { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatBytes } from '../utils/formatters';
import axios from 'axios';

const MyFiles = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_URL = 'http://localhost:5000/api';

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/files`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFiles(response.data);
    } catch (err) {
      console.error('Error fetching files:', err);
      setError(err.response?.data?.error || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (type) => {
    const icons = { document: 'fa-file-alt', image: 'fa-image', video: 'fa-video', audio: 'fa-music', archive: 'fa-file-archive' };
    return icons[type] || 'fa-file';
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="error-container">{error}</div>;

  return (
    <div className="my-files-page">
      <div className="page-header">
        <h1><i className="fas fa-folder"></i> My Files</h1>
        <button className="upload-btn" onClick={() => window.location.href = '/upload'}>
          <i className="fas fa-cloud-upload-alt"></i> Upload
        </button>
      </div>

      <div className="files-grid">
        {files.length === 0 ? (
          <div className="empty-state"><i className="fas fa-folder-open"></i><p>No files found. Upload your first file!</p></div>
        ) : (
          files.map(file => (
            <div key={file.id} className="file-card">
              <div className="file-icon"><i className={`fas ${getFileIcon(file.file_type)}`}></i></div>
              <div className="file-info">
                <div className="file-name">{file.filename}</div>
                <div className="file-meta">{formatBytes(file.file_size)} • {new Date(file.upload_date).toLocaleDateString()}</div>
              </div>
              <div className="file-actions">
                {file.is_shared && <i className="fas fa-share-alt"></i>}
                <button className="action-btn"><i className="fas fa-download"></i></button>
                <button className="action-btn"><i className="fas fa-trash"></i></button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );a
};

export default MyFiles;