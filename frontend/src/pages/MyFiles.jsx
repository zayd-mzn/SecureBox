import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { formatBytes } from '../utils/formatters';
import '../styles/MyFiles.css';

const API_URL = 'http://localhost:5000/api';

const MyFiles = () => {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
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
  const [dragOver, setDragOver] = useState(false);
  const [requirePassword, setRequirePassword] = useState(false);
  const [filePassword, setFilePassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [downloadPassword, setDownloadPassword] = useState('');
  const [currentFolder, setCurrentFolder] = useState(null);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermissions, setSharePermissions] = useState({ read: true, write: false, delete: false });
  const [showFileInfoModal, setShowFileInfoModal] = useState(false);
  const [fileInfo, setFileInfo] = useState(null);
  const [showEditFileModal, setShowEditFileModal] = useState(false);
  const [editFileName, setEditFileName] = useState('');
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [showViewerModal, setShowViewerModal] = useState(false);
  const [viewerContent, setViewerContent] = useState(null);
  const [viewerType, setViewerType] = useState(null);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [editorFilename, setEditorFilename] = useState('');
  const [editorFileId, setEditorFileId] = useState(null);
  const [editorSaving, setEditorSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockInfo, setLockInfo] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchFiles();
    fetchFolders();
  }, [currentFolder]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const url = currentFolder 
        ? `${API_URL}/files?folder_id=${currentFolder.id}`
        : `${API_URL}/files`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFiles(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const fetchFolders = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/folders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFolders(response.data);
    } catch (err) {
      console.error('Error fetching folders:', err);
    }
  };

  // Check if a file is locked
  const checkFileLock = async (fileId) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/files/${fileId}/lock-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsLocked(response.data.is_locked);
      setLockInfo(response.data.locked_by ? {
        username: response.data.locked_by,
        locked_at: response.data.locked_at
      } : null);
      return response.data;
    } catch (err) {
      console.error('Error checking lock status:', err);
      return { is_locked: false };
    }
  };

  // Lock a file for editing
  const lockFile = async (fileId) => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(`${API_URL}/files/${fileId}/lock`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsLocked(true);
      return true;
    } catch (err) {
      if (err.response?.status === 409) {
        alert('This file is currently locked by another user.');
      } else {
        alert('Failed to lock file');
      }
      return false;
    }
  };

  // Unlock a file after editing
  const unlockFile = async (fileId) => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(`${API_URL}/files/${fileId}/unlock`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsLocked(false);
      setLockInfo(null);
      return true;
    } catch (err) {
      console.error('Error unlocking file:', err);
      return false;
    }
  };

  // Edit text/code file
  const handleEditContent = async (file) => {
    // Check if file is editable
    const editableExtensions = ['txt', 'md', 'json', 'xml', 'yml', 'yaml', 'sh', 'sql', 'js', 'py', 'java', 'cpp', 'c', 'html', 'css', 'php', 'rb', 'go', 'ts', 'jsx', 'tsx'];
    const ext = file.filename.split('.').pop()?.toLowerCase();
    
    if (!editableExtensions.includes(ext) && file.file_type !== 'code' && file.file_type !== 'document') {
      alert('This file type cannot be edited in the browser. Please download and edit locally.');
      return;
    }

    if (file.is_encrypted) {
      alert('Encrypted files cannot be edited directly. Please download, decrypt, and edit locally.');
      return;
    }

    // Check lock status
    const lockStatus = await checkFileLock(file.id);
    if (lockStatus.is_locked) {
      alert(`This file is currently being edited by ${lockStatus.locked_by}. Please wait until it's unlocked.`);
      return;
    }

    // Lock the file
    const locked = await lockFile(file.id);
    if (!locked) return;

    // Fetch file content
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/files/download/${file.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'text'
      });
      
      setEditorContent(response.data);
      setEditorFilename(file.filename);
      setEditorFileId(file.id);
      setShowEditorModal(true);
    } catch (err) {
      console.error('Error loading file content:', err);
      alert('Failed to load file content');
      await unlockFile(file.id);
    }
  };

  // Save edited file content
  const handleSaveContent = async () => {
    if (!editorFileId || !editorContent) return;
    
    setEditorSaving(true);
    try {
      const token = localStorage.getItem('access_token');
      
      // Create a blob from the content
      const blob = new Blob([editorContent], { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', blob, editorFilename);
      formData.append('version_comment', 'Edited via browser editor');
      
      // Upload as new version
      await axios.post(`${API_URL}/files/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // Unlock the file
      await unlockFile(editorFileId);
      
      setShowEditorModal(false);
      setEditorContent('');
      setEditorFilename('');
      setEditorFileId(null);
      fetchFiles();
      
      alert('File saved successfully!');
    } catch (err) {
      console.error('Error saving file:', err);
      alert('Failed to save file');
    } finally {
      setEditorSaving(false);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(`${API_URL}/folders`, 
        { name: newFolderName, parent_id: currentFolder?.id || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowCreateFolderModal(false);
      setNewFolderName('');
      fetchFolders();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create folder');
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
    if (currentFolder) {
      formData.append('folder_id', currentFolder.id);
    }
    if (requirePassword && filePassword) {
      formData.append('require_password', 'true');
      formData.append('file_password', filePassword);
    }

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
      setFilePassword('');
      setRequirePassword(false);
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
    // Check if file is locked before deletion
    const lockStatus = await checkFileLock(fileId);
    if (lockStatus.is_locked) {
      alert(`This file is currently locked by ${lockStatus.locked_by}. Cannot delete.`);
      return;
    }
    
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

  const handleShare = async () => {
    if (!shareEmail || !selectedFile) return;
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(`${API_URL}/files/${selectedFile.id}/share`, {
        email: shareEmail,
        permissions: sharePermissions
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('File shared successfully!');
      setShowShareModal(false);
      setShareEmail('');
      setSharePermissions({ read: true, write: false, delete: false });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to share file');
    }
  };

  const handleRename = async () => {
    if (!editFileName.trim() || !selectedFile) return;
    try {
      const token = localStorage.getItem('access_token');
      await axios.put(`${API_URL}/files/${selectedFile.id}/rename`,
        { filename: editFileName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowEditFileModal(false);
      fetchFiles();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to rename file');
    }
  };

  const handleMove = async () => {
    if (!selectedFileId) return;
    try {
      const token = localStorage.getItem('access_token');
      await axios.put(`${API_URL}/files/${selectedFileId}/move`,
        { folder_id: currentFolder?.id || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowMoveModal(false);
      setSelectedFileId(null);
      fetchFiles();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to move file');
    }
  };

  const handleDeleteFolder = async (folderId) => {
    if (!window.confirm('Delete this folder and all its contents?')) return;
    try {
      const token = localStorage.getItem('access_token');
      await axios.delete(`${API_URL}/folders/${folderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (currentFolder?.id === folderId) {
        setCurrentFolder(null);
      }
      fetchFolders();
      fetchFiles();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete folder');
    }
  };

  const handleDownloadRequest = async (file) => {
    // Check if file is locked (show warning but allow download)
    const lockStatus = await checkFileLock(file.id);
    if (lockStatus.is_locked) {
      alert(`Note: This file is currently being edited by ${lockStatus.locked_by}. Downloading may get an outdated version.`);
    }
    
    if (file.is_encrypted) {
      setSelectedFile(file);
      setShowPasswordModal(true);
    } else {
      handleDownload(file.id, file.filename);
    }
  };

  const handleDownload = async (fileId, filename, password = null) => {
    try {
      const token = localStorage.getItem('access_token');
      const config = {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      };
      
      let data = {};
      if (password) {
        data = { password };
      }
      
      const response = await axios.post(`${API_URL}/files/download/${fileId}`, data, config);
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      if (showPasswordModal) {
        setShowPasswordModal(false);
        setDownloadPassword('');
        setSelectedFile(null);
      }
    } catch (err) {
      if (err.response?.status === 402) {
        alert('This file is password protected. Please enter the password.');
      } else if (err.response?.status === 401) {
        alert('Invalid password!');
      } else {
        alert('Download failed');
      }
    }
  };

  const handleSubmitPassword = () => {
    if (selectedFile && downloadPassword) {
      handleDownload(selectedFile.id, selectedFile.filename, downloadPassword);
    }
  };

  const handleViewFile = async (file) => {
    if (file.is_encrypted) {
      alert('Encrypted files cannot be previewed. Please download to view.');
      return;
    }

    const previewableTypes = ['image', 'pdf', 'code', 'document', 'spreadsheet', 'presentation'];
    const ext = file.filename.split('.').pop()?.toLowerCase();
    const textExtensions = ['txt', 'md', 'json', 'xml', 'yml', 'yaml', 'sh', 'sql', 'js', 'py', 'java', 'cpp', 'c', 'html', 'css', 'php', 'rb', 'go'];
    
    if (!previewableTypes.includes(file.file_type) && !textExtensions.includes(ext)) {
      alert('This file type cannot be previewed. Please download to view.');
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/files/download/${file.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const blob = response.data;
      const fileType = blob.type;
      
      if (file.file_type === 'image' || fileType.startsWith('image/')) {
        const url = URL.createObjectURL(blob);
        setViewerContent(url);
        setViewerType('image');
        setShowViewerModal(true);
      } else if (file.file_type === 'pdf' || fileType === 'application/pdf') {
        const url = URL.createObjectURL(blob);
        setViewerContent(url);
        setViewerType('pdf');
        setShowViewerModal(true);
      } else {
        const text = await blob.text();
        setViewerContent(text);
        setViewerType('text');
        setShowViewerModal(true);
      }
    } catch (err) {
      console.error('Error viewing file:', err);
      alert('Failed to preview file');
    }
  };

  const handleOpenFile = async (file) => {
    setSelectedFile(file);
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/files/${file.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Also get lock status
      const lockStatus = await checkFileLock(file.id);
      setFileInfo({
        ...response.data,
        is_locked: lockStatus.is_locked,
        locked_by: lockStatus.locked_by
      });
      setShowFileInfoModal(true);
    } catch (err) {
      console.error('Error fetching file info:', err);
    }
  };

  const handleEditFile = (file) => {
    setSelectedFile(file);
    setEditFileName(file.filename);
    setShowEditFileModal(true);
  };

  const handleShareFile = (file) => {
    setSelectedFile(file);
    setShowShareModal(true);
  };

  const handleMoveFile = (fileId) => {
    setSelectedFileId(fileId);
    setShowMoveModal(true);
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

  const getFileIcon = (file) => {
    const type = file.file_type;
    const filename = file.filename;
    const ext = filename?.split('.').pop()?.toLowerCase();
    
    const codeIcons = {
      js: { icon: 'fab fa-js', color: '#f7df1e' },
      py: { icon: 'fab fa-python', color: '#3776ab' },
      java: { icon: 'fab fa-java', color: '#007396' },
      html: { icon: 'fab fa-html5', color: '#e34f26' },
      css: { icon: 'fab fa-css3-alt', color: '#1572b6' },
      php: { icon: 'fab fa-php', color: '#777bb4' },
      json: { icon: 'fas fa-code', color: '#f5a623' },
      xml: { icon: 'fas fa-code', color: '#f5a623' },
      ts: { icon: 'fas fa-code', color: '#3178c6' },
      jsx: { icon: 'fab fa-react', color: '#61dafb' },
      tsx: { icon: 'fab fa-react', color: '#61dafb' },
      rb: { icon: 'fas fa-gem', color: '#cc342d' },
      go: { icon: 'fas fa-code', color: '#00add8' },
      rs: { icon: 'fas fa-code', color: '#dea584' },
      swift: { icon: 'fas fa-code', color: '#fa7343' },
      kt: { icon: 'fas fa-code', color: '#7f52ff' },
      cpp: { icon: 'fas fa-code', color: '#00599c' },
      c: { icon: 'fas fa-code', color: '#00599c' },
      sql: { icon: 'fas fa-database', color: '#4479a1' },
      sh: { icon: 'fas fa-terminal', color: '#4eaa25' },
      yaml: { icon: 'fas fa-code', color: '#f5a623' },
      yml: { icon: 'fas fa-code', color: '#f5a623' },
      md: { icon: 'fab fa-markdown', color: '#083fa1' }
    };
    
    const typeIcons = {
      document: { icon: 'fas fa-file-alt', color: '#4299e1' },
      image: { icon: 'fas fa-image', color: '#48bb78' },
      video: { icon: 'fas fa-video', color: '#ed8936' },
      audio: { icon: 'fas fa-music', color: '#9f7aea' },
      archive: { icon: 'fas fa-file-archive', color: '#e53e3e' },
      pdf: { icon: 'fas fa-file-pdf', color: '#e53e3e' },
      spreadsheet: { icon: 'fas fa-file-excel', color: '#48bb78' },
      presentation: { icon: 'fas fa-file-powerpoint', color: '#ed8936' },
      code: codeIcons[ext] || { icon: 'fas fa-code', color: '#4299e1' },
      other: { icon: 'fas fa-file', color: '#718096' }
    };
    
    if (type === 'code' && codeIcons[ext]) {
      return codeIcons[ext];
    }
    
    return typeIcons[type] || typeIcons.other;
  };

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
        <div className="header-buttons">
          <button className="btn-secondary" onClick={() => setShowCreateFolderModal(true)}>
            <i className="fas fa-folder-plus"></i> New Folder
          </button>
          <button className="btn-upload" onClick={() => setShowUploadModal(true)}>
            <i className="fas fa-cloud-upload-alt"></i> Upload File
          </button>
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      <div className="breadcrumb">
        <button 
          className={`breadcrumb-item ${!currentFolder ? 'active' : ''}`}
          onClick={() => setCurrentFolder(null)}
        >
          <i className="fas fa-home"></i> Root
        </button>
        {currentFolder && (
          <>
            <i className="fas fa-chevron-right"></i>
            <span className="breadcrumb-item active">
              <i className="fas fa-folder"></i> {currentFolder.name}
            </span>
          </>
        )}
      </div>

      {/* Folders Section */}
      {folders.filter(f => f.parent_id === (currentFolder?.id || null)).length > 0 && (
        <div className="folders-section">
          <h3><i className="fas fa-folder-open"></i> Folders</h3>
          <div className="folders-container">
            {folders
              .filter(f => f.parent_id === (currentFolder?.id || null))
              .map(folder => (
                <div key={folder.id} className="folder-card">
                  <div className="folder-icon" onClick={() => setCurrentFolder(folder)}>
                    <i className="fas fa-folder" style={{ color: '#f5a623' }}></i>
                  </div>
                  <div className="folder-info" onClick={() => setCurrentFolder(folder)}>
                    <div className="folder-name">{folder.name}</div>
                    <div className="folder-meta">{folder.file_count || 0} items</div>
                  </div>
                  <div className="folder-actions">
                    <button 
                      className="action-btn-folder delete"
                      onClick={() => handleDeleteFolder(folder.id)}
                      title="Delete Folder"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

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
            <option value="code">Code</option>
            <option value="pdf">PDF</option>
            <option value="spreadsheet">Spreadsheets</option>
            <option value="presentation">Presentations</option>
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
      </div>

      {/* Drop Zone */}
      <div
        className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <i className="fas fa-cloud-upload-alt"></i>
        <span>Drop files here to upload to {currentFolder ? currentFolder.name : 'Root'}</span>
      </div>

      {/* Files List */}
      {filteredFiles.length === 0 ? (
        <div className="empty-state">
          <i className="fas fa-folder-open"></i>
          <h3>No files found</h3>
          <p>Upload your first file or change your filters</p>
        </div>
      ) : (
        <div className="files-container list">
          {filteredFiles.map(file => {
            const { icon, color } = getFileIcon(file);
            const isEditable = (file.file_type === 'code' || file.file_type === 'document') && !file.is_encrypted;
            const editableExtensions = ['txt', 'md', 'json', 'xml', 'yml', 'yaml', 'sh', 'sql', 'js', 'py', 'java', 'cpp', 'c', 'html', 'css', 'php', 'rb', 'go', 'ts', 'jsx', 'tsx'];
            const ext = file.filename.split('.').pop()?.toLowerCase();
            const canEdit = isEditable || editableExtensions.includes(ext);
            
            return (
              <div key={file.id} className="file-card">
                <div className="file-icon" style={{ color }} onClick={() => handleOpenFile(file)}>
                  <i className={icon}></i>
                </div>
                <div className="file-info" onClick={() => handleOpenFile(file)}>
                  <div className="file-name" title={file.filename}>
                    {file.filename}
                    {file.is_locked && <i className="fas fa-lock locked-icon" title="Locked by another user"></i>}
                    {file.is_encrypted && <i className="fas fa-lock encrypted-icon" title="Password protected"></i>}
                  </div>
                  <div className="file-meta">
                    <span><i className="fas fa-weight"></i> {formatBytes(file.file_size)}</span>
                    <span><i className="fas fa-calendar"></i> {new Date(file.upload_date).toLocaleDateString()}</span>
                    {file.is_shared && (
                      <span className="shared-badge">
                        <i className="fas fa-share-alt"></i> Shared
                      </span>
                    )}
                    {file.is_encrypted && (
                      <span className="encrypted-badge">
                        <i className="fas fa-lock"></i> Encrypted
                      </span>
                    )}
                    {file.is_locked && (
                      <span className="locked-badge">
                        <i className="fas fa-lock"></i> Locked
                      </span>
                    )}
                  </div>
                </div>
                <div className="file-actions">
                  <button
                    className="action-btn view"
                    title="View"
                    onClick={() => handleViewFile(file)}
                  >
                    <i className="fas fa-eye"></i>
                  </button>
                  {canEdit && (
                    <button
                      className="action-btn edit-content"
                      title="Edit Content"
                      onClick={() => handleEditContent(file)}
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                  )}
                  <button
                    className="action-btn info"
                    title="Info"
                    onClick={() => handleOpenFile(file)}
                  >
                    <i className="fas fa-info-circle"></i>
                  </button>
                  <button
                    className="action-btn rename"
                    title="Rename"
                    onClick={() => handleEditFile(file)}
                  >
                    <i className="fas fa-i-cursor"></i>
                  </button>
                  <button
                    className="action-btn share"
                    title="Share"
                    onClick={() => handleShareFile(file)}
                  >
                    <i className="fas fa-share-alt"></i>
                  </button>
                  <button
                    className="action-btn move"
                    title="Move"
                    onClick={() => handleMoveFile(file.id)}
                  >
                    <i className="fas fa-folder-open"></i>
                  </button>
                  <button
                    className="action-btn download"
                    title="Download"
                    onClick={() => handleDownloadRequest(file)}
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

      {/* File Editor Modal */}
      {showEditorModal && (
        <div className="modal-overlay editor-modal" onClick={() => {
          if (window.confirm('Close editor? Unsaved changes will be lost.')) {
            unlockFile(editorFileId);
            setShowEditorModal(false);
            setEditorContent('');
            setEditorFilename('');
            setEditorFileId(null);
          }
        }}>
          <div className="modal-content editor-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-edit"></i> Editing: {editorFilename}</h2>
              <button className="modal-close" onClick={() => {
                if (window.confirm('Close editor? Unsaved changes will be lost.')) {
                  unlockFile(editorFileId);
                  setShowEditorModal(false);
                  setEditorContent('');
                  setEditorFilename('');
                  setEditorFileId(null);
                }
              }}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body editor-body">
              <div className="editor-info">
                <span><i className="fas fa-info-circle"></i> File is locked while editing - others cannot modify it</span>
              </div>
              <textarea
                className="editor-textarea"
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                spellCheck="false"
              />
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => {
                if (window.confirm('Discard changes? File will be unlocked.')) {
                  unlockFile(editorFileId);
                  setShowEditorModal(false);
                  setEditorContent('');
                  setEditorFilename('');
                  setEditorFileId(null);
                }
              }}>
                Cancel
              </button>
              <button className="btn-save" onClick={handleSaveContent} disabled={editorSaving}>
                <i className="fas fa-save"></i>
                {editorSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Viewer Modal */}
      {showViewerModal && (
        <div className="modal-overlay viewer-modal" onClick={() => setShowViewerModal(false)}>
          <div className="modal-content viewer-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-eye"></i> File Viewer</h2>
              <button className="modal-close" onClick={() => setShowViewerModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body viewer-body">
              {viewerType === 'image' && (
                <img src={viewerContent} alt="Preview" className="viewer-image" />
              )}
              {viewerType === 'pdf' && (
                <iframe 
                  src={viewerContent} 
                  className="viewer-pdf"
                  title="PDF Viewer"
                />
              )}
              {viewerType === 'text' && (
                <pre className="viewer-text">{viewerContent}</pre>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-close" onClick={() => setShowViewerModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* File Info Modal */}
      {showFileInfoModal && fileInfo && (
        <div className="modal-overlay" onClick={() => setShowFileInfoModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-info-circle"></i> File Information</h2>
              <button className="modal-close" onClick={() => setShowFileInfoModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="file-info-detail">
                <p><strong>Name:</strong> {fileInfo.filename}</p>
                <p><strong>Type:</strong> {fileInfo.file_type}</p>
                <p><strong>Size:</strong> {formatBytes(fileInfo.size)}</p>
                <p><strong>Created:</strong> {new Date(fileInfo.created_at).toLocaleString()}</p>
                <p><strong>Modified:</strong> {new Date(fileInfo.updated_at).toLocaleString()}</p>
                <p><strong>Owner:</strong> {fileInfo.owner}</p>
                <p><strong>Version:</strong> {fileInfo.version}</p>
                <p><strong>Shared:</strong> {fileInfo.is_shared ? 'Yes' : 'No'}</p>
                <p><strong>Locked:</strong> {fileInfo.is_locked ? `Yes (by ${fileInfo.locked_by})` : 'No'}</p>
                {fileInfo.is_encrypted && <p><strong>Encrypted:</strong> Yes (Password Protected)</p>}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-close" onClick={() => setShowFileInfoModal(false)}>Close</button>
            </div>
          </div>
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

              <div className="upload-location">
                <label>Upload to:</label>
                <span>{currentFolder ? currentFolder.name : 'Root'}</span>
              </div>

              <div className="password-option">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={requirePassword}
                    onChange={(e) => setRequirePassword(e.target.checked)}
                  />
                  <span>Protect this file with a password</span>
                </label>
              </div>

              {requirePassword && (
                <div className="password-input">
                  <label>File Password</label>
                  <input
                    type="password"
                    value={filePassword}
                    onChange={(e) => setFilePassword(e.target.value)}
                    placeholder="Enter password for this file"
                    className="form-input"
                  />
                  <p className="hint">Password required when downloading this file</p>
                </div>
              )}

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

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <div className="modal-overlay" onClick={() => setShowCreateFolderModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-folder-plus"></i> Create New Folder</h2>
              <button className="modal-close" onClick={() => setShowCreateFolderModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Folder Name</label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Enter folder name"
                  className="form-input"
                  autoFocus
                  onKeyPress={(e) => e.key === 'Enter' && createFolder()}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowCreateFolderModal(false)}>
                Cancel
              </button>
              <button className="btn-save" onClick={createFolder}>
                <i className="fas fa-folder-plus"></i> Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && selectedFile && (
        <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-share-alt"></i> Share File</h2>
              <button className="modal-close" onClick={() => setShowShareModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <p>Share <strong>{selectedFile.filename}</strong> with:</p>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="form-input"
                />
              </div>
              <div className="permissions-section">
                <label>Permissions:</label>
                <div className="permissions-options">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={sharePermissions.read}
                      onChange={(e) => setSharePermissions({ ...sharePermissions, read: e.target.checked })}
                    />
                    <span>Read</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={sharePermissions.write}
                      onChange={(e) => setSharePermissions({ ...sharePermissions, write: e.target.checked })}
                    />
                    <span>Write</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={sharePermissions.delete}
                      onChange={(e) => setSharePermissions({ ...sharePermissions, delete: e.target.checked })}
                    />
                    <span>Delete</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowShareModal(false)}>
                Cancel
              </button>
              <button className="btn-save" onClick={handleShare}>
                <i className="fas fa-share-alt"></i> Share
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit File Name Modal */}
      {showEditFileModal && selectedFile && (
        <div className="modal-overlay" onClick={() => setShowEditFileModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-edit"></i> Rename File</h2>
              <button className="modal-close" onClick={() => setShowEditFileModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>New File Name</label>
                <input
                  type="text"
                  value={editFileName}
                  onChange={(e) => setEditFileName(e.target.value)}
                  className="form-input"
                  autoFocus
                  onKeyPress={(e) => e.key === 'Enter' && handleRename()}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowEditFileModal(false)}>
                Cancel
              </button>
              <button className="btn-save" onClick={handleRename}>
                <i className="fas fa-save"></i> Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move to Folder Modal */}
      {showMoveModal && (
        <div className="modal-overlay" onClick={() => setShowMoveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-folder-open"></i> Move to Folder</h2>
              <button className="modal-close" onClick={() => setShowMoveModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <p>Select destination folder:</p>
              <div className="folder-list">
                <button 
                  className={`folder-option ${!currentFolder ? 'active' : ''}`}
                  onClick={() => setCurrentFolder(null)}
                >
                  <i className="fas fa-home"></i> Root
                </button>
                {folders.map(folder => (
                  <button 
                    key={folder.id}
                    className={`folder-option ${currentFolder?.id === folder.id ? 'active' : ''}`}
                    onClick={() => setCurrentFolder(folder)}
                  >
                    <i className="fas fa-folder"></i> {folder.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowMoveModal(false)}>
                Cancel
              </button>
              <button className="btn-save" onClick={handleMove}>
                <i className="fas fa-check"></i> Move Here
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Modal for Download */}
      {showPasswordModal && selectedFile && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-lock"></i> Password Required</h2>
              <button className="modal-close" onClick={() => setShowPasswordModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <p>This file is password protected: <strong>{selectedFile.filename}</strong></p>
              <div className="password-input">
                <label>Enter Password</label>
                <input
                  type="password"
                  value={downloadPassword}
                  onChange={(e) => setDownloadPassword(e.target.value)}
                  placeholder="File password"
                  className="form-input"
                  onKeyPress={(e) => e.key === 'Enter' && handleSubmitPassword()}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowPasswordModal(false)}>
                Cancel
              </button>
              <button className="btn-save" onClick={handleSubmitPassword}>
                <i className="fas fa-download"></i> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyFiles;