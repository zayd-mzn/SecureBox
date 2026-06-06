import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { formatBytes } from '../utils/formatters';
import LiveViewer from '../components/LiveViewer';
import '../styles/SharedWithMe.css';

const API_URL = 'http://localhost:5000/api';

const SharedWithMe = () => {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');
  const [filterPermission, setFilterPermission] = useState('all');
  const [selectedFile, setSelectedFile] = useState(null);
  const [showFileInfoModal, setShowFileInfoModal] = useState(false);
  const [fileInfo, setFileInfo] = useState(null);
  const [showViewerModal, setShowViewerModal] = useState(false);
  const [viewerContent, setViewerContent] = useState(null);
  const [viewerType, setViewerType] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [downloadPassword, setDownloadPassword] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [showEditFileModal, setShowEditFileModal] = useState(false);
  const [editFileName, setEditFileName] = useState('');
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermissions, setSharePermissions] = useState({ read: true, write: false, delete: false });
  const [actionInProgress, setActionInProgress] = useState(false);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [editorFilename, setEditorFilename] = useState('');
  const [editorFileId, setEditorFileId] = useState(null);
  const [editorSaving, setEditorSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockInfo, setLockInfo] = useState(null);
  const [showLiveViewer, setShowLiveViewer] = useState(false);
  const [liveViewFile, setLiveViewFile] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    fetchSharedFiles();
    fetchFolders();
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

  // Lock a file for editing (requires write permission)
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

  // Edit content of text/code file (requires write permission)
  const handleEditContent = async (file) => {
    if (!file.permissions.write) {
      alert('You do not have write permission to edit this file');
      return;
    }

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
      if (window.confirm(`This file is being edited by ${lockStatus.locked_by}. Would you like to watch the live edits?`)) {
        setLiveViewFile(file);
        setShowLiveViewer(true);
      }
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
      
      // Connect socket for live broadcasting
      const socket = io('http://localhost:5000', { transports: ['websocket'] });
      socket.on('connect', () => {
        socket.emit('join_file', { token, file_id: file.id });
      });
      socketRef.current = socket;

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
      
      await axios.put(`${API_URL}/files/${editorFileId}/content`, editorContent, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'text/plain'
        }
      });
      
      await unlockFile(editorFileId);
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
      
      setShowEditorModal(false);
      setEditorContent('');
      setEditorFilename('');
      setEditorFileId(null);
      fetchSharedFiles();
      
      setSaveMessage('File saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error('Error saving file:', err);
      alert('Failed to save file');
    } finally {
      setEditorSaving(false);
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
        setSelectedFile({ id: fileId, filename });
        setShowPasswordModal(true);
      } else if (err.response?.status === 401) {
        alert('Invalid password!');
      } else {
        alert('Download failed');
      }
    }
  };

  const handleDownloadRequest = async (file) => {
    // Check lock status (show warning but allow download)
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

  const handleOpenFileInfo = async (file) => {
    setSelectedFile(file);
    // Get lock status
    const lockStatus = await checkFileLock(file.id);
    setFileInfo({
      id: file.id,
      filename: file.filename,
      file_type: file.file_type,
      size: file.size,
      owner: file.owner,
      shared_at: file.shared_at,
      permissions: file.permissions,
      is_locked: lockStatus.is_locked,
      locked_by: lockStatus.locked_by
    });
    setShowFileInfoModal(true);
  };

  // Edit/Rename file (requires write permission)
  const handleEditFile = (file) => {
    if (!file.permissions.write) {
      alert('You do not have write permission for this file');
      return;
    }
    setSelectedFile(file);
    setEditFileName(file.filename);
    setShowEditFileModal(true);
  };

  const handleRename = async () => {
    if (!editFileName.trim() || !selectedFile) return;
    if (!selectedFile.permissions.write) {
      alert('You do not have write permission for this file');
      return;
    }
    
    setActionInProgress(true);
    try {
      const token = localStorage.getItem('access_token');
      await axios.put(`${API_URL}/files/${selectedFile.id}/rename`,
        { filename: editFileName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowEditFileModal(false);
      fetchSharedFiles();
      setSaveMessage('File renamed successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to rename file');
    } finally {
      setActionInProgress(false);
    }
  };

  // Delete file (requires delete permission)
  const handleDelete = async (file) => {
    if (!file.permissions.delete) {
      alert('You do not have delete permission for this file');
      return;
    }
    
    // Check lock status before deletion
    const lockStatus = await checkFileLock(file.id);
    if (lockStatus.is_locked) {
      alert(`This file is currently locked by ${lockStatus.locked_by}. Cannot delete.`);
      return;
    }
    
    if (!window.confirm(`Move "${file.filename}" to recycle bin?`)) return;
    
    setActionInProgress(true);
    try {
      const token = localStorage.getItem('access_token');
      await axios.delete(`${API_URL}/files/${file.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchSharedFiles();
      setSaveMessage('File moved to recycle bin!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed');
    } finally {
      setActionInProgress(false);
    }
  };

  // Share file (requires share permission)
  const handleShareFile = (file) => {
    if (!file.permissions.share) {
      alert('You do not have share permission for this file');
      return;
    }
    setSelectedFile(file);
    setShowShareModal(true);
  };

  const handleShare = async () => {
    if (!shareEmail || !selectedFile) return;
    if (!selectedFile.permissions.share) {
      alert('You do not have share permission for this file');
      return;
    }
    
    setActionInProgress(true);
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
    } finally {
      setActionInProgress(false);
    }
  };

  // Move file to folder (requires write permission)
  const handleMoveFile = (file) => {
    if (!file.permissions.write) {
      alert('You do not have write permission to move this file');
      return;
    }
    setSelectedFileId(file.id);
    setShowMoveModal(true);
  };

  const handleMove = async () => {
    if (!selectedFileId) return;
    const file = files.find(f => f.id === selectedFileId);
    if (file && !file.permissions.write) {
      alert('You do not have write permission to move this file');
      return;
    }
    
    setActionInProgress(true);
    try {
      const token = localStorage.getItem('access_token');
      await axios.put(`${API_URL}/files/${selectedFileId}/move`,
        { folder_id: currentFolder?.id || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowMoveModal(false);
      setSelectedFileId(null);
      fetchSharedFiles();
      setSaveMessage('File moved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to move file');
    } finally {
      setActionInProgress(false);
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
        {saveMessage && (
          <div className="save-message success">
            <i className="fas fa-check-circle"></i> {saveMessage}
          </div>
        )}
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
            <option value="code">Code</option>
            <option value="pdf">PDF</option>
            <option value="spreadsheet">Spreadsheets</option>
            <option value="presentation">Presentations</option>
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
            <option value="date_desc">Newest Shared</option>
            <option value="date_asc">Oldest Shared</option>
            <option value="name_asc">Name A-Z</option>
            <option value="name_desc">Name Z-A</option>
            <option value="size_desc">Largest First</option>
            <option value="size_asc">Smallest First</option>
          </select>
        </div>
      </div>

      {/* Files List */}
      {filteredFiles.length === 0 ? (
        <div className="empty-state">
          <i className="fas fa-share-alt"></i>
          <h3>No shared files found</h3>
          <p>No files have been shared with you yet, or none match your filters.</p>
        </div>
      ) : (
        <div className="files-container list">
          {filteredFiles.map(file => {
            const { icon, color } = getFileIcon(file);
            const permBadges = getPermissionBadges(file.permissions);
            const isEditable = (file.file_type === 'code' || file.file_type === 'document') && !file.is_encrypted && file.permissions.write;
            const editableExtensions = ['txt', 'md', 'json', 'xml', 'yml', 'yaml', 'sh', 'sql', 'js', 'py', 'java', 'cpp', 'c', 'html', 'css', 'php', 'rb', 'go', 'ts', 'jsx', 'tsx'];
            const ext = file.filename.split('.').pop()?.toLowerCase();
            const canEdit = isEditable || (editableExtensions.includes(ext) && file.permissions.write);
            
            return (
              <div key={file.id} className="shared-card">
                <div className="file-icon" style={{ color }} onClick={() => handleOpenFileInfo(file)}>
                  <i className={icon}></i>
                </div>

                <div className="file-info" onClick={() => handleOpenFileInfo(file)}>
                  <div className="file-name" title={file.filename}>
                    {file.filename}
                    {file.is_locked && <i className="fas fa-lock locked-icon" title="Locked by another user"></i>}
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
                    className="action-btn view"
                    title="View"
                    onClick={() => handleViewFile(file)}
                    disabled={!file.permissions.read}
                  >
                    <i className="fas fa-eye"></i>
                  </button>
                  {file.is_locked && (
                    <button
                      className="action-btn live"
                      title="Watch Live Edits"
                      onClick={() => { setLiveViewFile(file); setShowLiveViewer(true); }}
                      style={{ color: '#ed8936' }}
                    >
                      <i className="fas fa-broadcast-tower"></i>
                    </button>
                  )}
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
                    onClick={() => handleOpenFileInfo(file)}
                  >
                    <i className="fas fa-info-circle"></i>
                  </button>
                  {file.permissions.write && (
                    <button
                      className="action-btn edit"
                      title="Edit/Rename"
                      onClick={() => handleEditFile(file)}
                    >
                      <i className="fas fa-i-cursor"></i>
                    </button>
                  )}
                  {file.permissions.share && (
                    <button
                      className="action-btn share"
                      title="Share"
                      onClick={() => handleShareFile(file)}
                    >
                      <i className="fas fa-share-alt"></i>
                    </button>
                  )}
                  {file.permissions.write && (
                    <button
                      className="action-btn move"
                      title="Move to Folder"
                      onClick={() => handleMoveFile(file)}
                    >
                      <i className="fas fa-folder-open"></i>
                    </button>
                  )}
                  <button
                    className="action-btn download"
                    title="Download"
                    onClick={() => handleDownloadRequest(file)}
                    disabled={!file.permissions.read}
                  >
                    <i className="fas fa-download"></i>
                  </button>
                  {file.permissions.delete && (
                    <button
                      className="action-btn delete"
                      title="Delete"
                      onClick={() => handleDelete(file)}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  )}
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
            if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
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
                  if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
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
                <i className="fas fa-broadcast-tower"></i> Live — viewers can see your changes in real-time
              </div>
              <textarea
                className="editor-textarea"
                value={editorContent}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditorContent(val);
                  if (socketRef.current) {
                    const ta = e.target;
                    const pos = ta.selectionStart;
                    const lines = val.substring(0, pos).split('\n');
                    const cursor = { line: lines.length - 1, ch: lines[lines.length - 1].length };
                    socketRef.current.emit('content_change', {
                      token: localStorage.getItem('access_token'),
                      file_id: editorFileId,
                      content: val,
                      cursor
                    });
                  }
                }}
                onSelect={(e) => {
                  if (socketRef.current && editorFileId) {
                    const ta = e.target;
                    const pos = ta.selectionStart;
                    const lines = editorContent.substring(0, pos).split('\n');
                    const cursor = { line: lines.length - 1, ch: lines[lines.length - 1].length };
                    socketRef.current.emit('cursor_move', {
                      token: localStorage.getItem('access_token'),
                      file_id: editorFileId,
                      cursor
                    });
                  }
                }}
                spellCheck="false"
              />
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => {
                if (window.confirm('Discard changes? File will be unlocked.')) {
                  unlockFile(editorFileId);
                  if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
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

      {/* Live Viewer Modal */}
      {showLiveViewer && liveViewFile && (
        <LiveViewer
          fileId={liveViewFile.id}
          filename={liveViewFile.filename}
          onClose={() => { setShowLiveViewer(false); setLiveViewFile(null); }}
        />
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
                <p><strong>Owner:</strong> {fileInfo.owner}</p>
                <p><strong>Shared at:</strong> {new Date(fileInfo.shared_at).toLocaleString()}</p>
                <p><strong>Locked:</strong> {fileInfo.is_locked ? `Yes (by ${fileInfo.locked_by})` : 'No'}</p>
                <p><strong>Your Permissions:</strong></p>
                <div className="permission-badges">
                  {fileInfo.permissions.read && <span className="perm-badge perm-read"><i className="fas fa-eye"></i> Read</span>}
                  {fileInfo.permissions.write && <span className="perm-badge perm-write"><i className="fas fa-pen"></i> Write</span>}
                  {fileInfo.permissions.delete && <span className="perm-badge perm-delete"><i className="fas fa-trash"></i> Delete</span>}
                  {fileInfo.permissions.share && <span className="perm-badge perm-share"><i className="fas fa-share-alt"></i> Share</span>}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-close" onClick={() => setShowFileInfoModal(false)}>Close</button>
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
              <button className="btn-save" onClick={handleRename} disabled={actionInProgress}>
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
              <button className="btn-save" onClick={handleMove} disabled={actionInProgress}>
                <i className="fas fa-check"></i> Move Here
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
              <button className="btn-save" onClick={handleShare} disabled={actionInProgress}>
                <i className="fas fa-share-alt"></i> Share
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

export default SharedWithMe;