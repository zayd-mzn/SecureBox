import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { formatBytes } from '../utils/formatters';
import '../styles/MyFiles.css';

const API_URL = 'http://localhost:5000/api';

const MyFiles = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');
  const [viewMode, setViewMode] = useState('grid');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

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
      setError(err.response?.data?.error || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadError('');
    setUploadSuccess('');
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const token = localStorage.getItem('access_token');
      await axios.post(`${API_URL}/files/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percent);
        }
      });
      setUploadSuccess('File uploaded successfully!');
      setUploadFile(null);
      fetchFiles();
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadSuccess('');
        setUploadProgress(0);
      }, 1500);
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId) => {
    if (!window.confirm('Move this file to recycle bin?')) return;
    try {
      const token = localStorage.getItem('access_token');
      await axios.delete(`${API_URL}/files/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchFiles();
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed');
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

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setUploadFile(file);
      setShowUploadModal(true);
    }
  };

  const getFileIcon = (type) => {
    const icons = {
      document: { icon: 'fa-file-alt', color: '#4299e1' },
      image: { icon: 'fa-image', color: '#48bb78' },
      video: { icon: 'fa-video', color: '#ed8936' },
      audio: { icon: 'fa-music', color: '#9f7aea' },
      archive: { icon: 'fa-file-archive', color: '#e53e3e' },
      other: { icon: 'fa-file', color: '#718096' }
    };
    return icons[type] || icons.other;
  };

  // Filter + Search + Sort
  const filteredFiles = files
    .filter(f => filterType === 'all' || f.file_type === filterType)
    .filter(f => f.filename.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.upload_date) - new Date(a.upload_date);
      if (sortBy === 'date_asc') return new Date(a.upload_date) - new Date(b.upload_date);
      if (sortBy === 'name_asc') return a.filename.localeCompare(b.filename);
      if (sortBy === 'name_desc') return b.filename.localeCompare(a.filename);
      if (sortBy === 'size_desc') return b.file_size - a.file_size;
      if (sortBy === 'size_asc') return a.file_size - b.file_size;
      return 0;
    });

  if (loading) return (
    <div className="loading-state">
      <i className="fas fa-spinner fa-spin"></i>
      <p>Loading files...</p>
    </div>
  );

  if (error) return (
    <div className="error-state">
      <i className="fas fa-exclamation-triangle"></i>
      <p>{error}</p>
      <button onClick={fetchFiles}>Retry</button>
    </div>
  );

  return (
    <div className="my-files-page">

      {/* Header */}
      <div className="files-header">
        <div>
          <h1><i className="fas fa-folder"></i> My Files</h1>
          <p className="files-subtitle">
            {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <button className="btn-upload" onClick={() => setShowUploadModal(true)}>
          <i className="fas fa-cloud-upload-alt"></i> Upload File
        </button>
      </div>

      {/* Filters Bar */}
      <div className="files-filters">
        <div className="search-box">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Search files..."
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

      {/* Drop Zone */}
      <div
        className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <i className="fas fa-cloud-upload-alt"></i>
        <span>Drop files here to upload</span>
      </div>

      {/* Files Grid / List */}
      {filteredFiles.length === 0 ? (
        <div className="empty-state">
          <i className="fas fa-folder-open"></i>
          <h3>No files found</h3>
          <p>Upload your first file or change your filters</p>

        </div>
      ) : (
        <div className={`files-container ${viewMode}`}>
          {filteredFiles.map(file => {
            const { icon, color } = getFileIcon(file.file_type);
            return (
              <div key={file.id} className="file-card">
                <div className="file-icon" style={{ color }}>
                  <i className={`fas ${icon}`}></i>
                </div>
                <div className="file-info">
                  <div className="file-name" title={file.filename}>
                    {file.filename}
                  </div>
                  <div className="file-meta">
                    <span><i className="fas fa-weight"></i> {formatBytes(file.file_size)}</span>
                    <span><i className="fas fa-calendar"></i> {new Date(file.upload_date).toLocaleDateString()}</span>
                    {file.is_shared && (
                      <span className="shared-badge">
                        <i className="fas fa-share-alt"></i> Shared
                      </span>
                    )}
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
                  <button
                    className="action-btn delete"
                    title="Delete"
                    onClick={() => handleDelete(file.id)}
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => !uploading && setShowUploadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-cloud-upload-alt"></i> Upload File</h2>
              <button
                className="modal-close"
                onClick={() => !uploading && setShowUploadModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="modal-body">
              {/* Drop area inside modal */}
              <div
                className={`upload-drop-area ${dragOver ? 'drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  setUploadFile(e.dataTransfer.files[0]);
                }}
                onClick={() => fileInputRef.current.click()}
              >
                <i className="fas fa-cloud-upload-alt"></i>
                {uploadFile ? (
                  <p className="selected-file">
                    <i className="fas fa-file"></i> {uploadFile.name}
                    <span>({formatBytes(uploadFile.size)})</span>
                  </p>
                ) : (
                  <>
                    <p>Drag & drop your file here</p>
                    <span>or click to browse</span>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                onChange={(e) => setUploadFile(e.target.files[0])}
              />

              {/* Progress Bar */}
              {uploading && (
                <div className="upload-progress">
                  <div className="progress-bar-bg">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <span>{uploadProgress}%</span>
                </div>
              )}

              {uploadSuccess && (
                <div className="alert success">
                  <i className="fas fa-check-circle"></i> {uploadSuccess}
                </div>
              )}
              {uploadError && (
                <div className="alert error">
                  <i className="fas fa-exclamation-circle"></i> {uploadError}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn-cancel"
                onClick={() => !uploading && setShowUploadModal(false)}
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                className="btn-save"
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
              >
                {uploading ? (
                  <><i className="fas fa-spinner fa-spin"></i> Uploading...</>
                ) : (
                  <><i className="fas fa-upload"></i> Upload</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyFiles;