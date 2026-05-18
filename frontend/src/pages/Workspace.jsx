import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { formatBytes } from '../utils/formatters';
import '../styles/Workspace.css';

const API_URL = 'http://localhost:5000/api';

const Workspace = () => {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Current user info
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState('user');

  // Active workspace detail
  const [activeWs, setActiveWs] = useState(null);
  const [wsDetail, setWsDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  // Forms
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [joinCode, setJoinCode] = useState('');
  const [uploadFile, setUploadFile] = useState(null);

  // Toast
  const [toast, setToast] = useState(null);

  // ─────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      const u = JSON.parse(stored);
      setCurrentUser(u);
      setUserRole(u.role || 'user');
    }
    fetchWorkspaces();
  }, []);

  const authHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem('access_token')}`
  });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ─────────────────────────────
  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/workspaces`, { headers: authHeader() });
      setWorkspaces(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (wsId) => {
    try {
      setDetailLoading(true);
      const res = await axios.get(`${API_URL}/workspaces/${wsId}`, { headers: authHeader() });
      setWsDetail(res.data);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load workspace', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const openWorkspace = (ws) => {
    setActiveWs(ws);
    fetchDetail(ws.id);
  };

  // ─────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/workspaces`, createForm, { headers: authHeader() });
      setWorkspaces(prev => [...prev, res.data.workspace]);
      setShowCreate(false);
      setCreateForm({ name: '', description: '' });
      showToast('Workspace created successfully!');
    } catch (err) {
      showToast(err.response?.data?.error || 'Creation failed', 'error');
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(
        `${API_URL}/workspaces/join`,
        { invite_code: joinCode },
        { headers: authHeader() }
      );
      setWorkspaces(prev => [...prev, res.data.workspace]);
      setShowJoin(false);
      setJoinCode('');
      showToast(`Joined "${res.data.workspace.name}" successfully!`);
    } catch (err) {
      showToast(err.response?.data?.error || 'Invalid code', 'error');
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile || !activeWs) return;
    const fd = new FormData();
    fd.append('file', uploadFile);
    try {
      await axios.post(`${API_URL}/workspaces/${activeWs.id}/files`, fd, {
        headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' }
      });
      setShowUpload(false);
      setUploadFile(null);
      showToast('File uploaded to workspace!');
      fetchDetail(activeWs.id);
    } catch (err) {
      showToast(err.response?.data?.error || 'Upload failed', 'error');
    }
  };

  const handleRemoveMember = async (memberId, username) => {
    if (!window.confirm(`Remove ${username} from this workspace?`)) return;
    try {
      await axios.delete(
        `${API_URL}/workspaces/${activeWs.id}/members/${memberId}`,
        { headers: authHeader() }
      );
      showToast(`${username} removed`);
      fetchDetail(activeWs.id);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to remove', 'error');
    }
  };

  const handleRegenCode = async () => {
    try {
      const res = await axios.post(
        `${API_URL}/workspaces/${activeWs.id}/regenerate-code`,
        {},
        { headers: authHeader() }
      );
      setWsDetail(prev => ({ ...prev, invite_code: res.data.invite_code }));
      showToast('Invitation code regenerated');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const handleDeleteWs = async () => {
    if (!window.confirm(`Delete workspace "${activeWs.name}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API_URL}/workspaces/${activeWs.id}`, { headers: authHeader() });
      setWorkspaces(prev => prev.filter(w => w.id !== activeWs.id));
      setActiveWs(null);
      setWsDetail(null);
      showToast('Workspace deleted');
    } catch (err) {
      showToast(err.response?.data?.error || 'Delete failed', 'error');
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    showToast('Code copied to clipboard!');
  };

  const isSpaceAdmin = userRole === 'space_admin' || userRole === 'global_admin';

  // ══════════════════════════════════
  // RENDER
  // ══════════════════════════════════
  return (
    <div className="workspace-page">
      {/* Toast */}
      {toast && (
        <div className={`ws-toast ws-toast--${toast.type}`}>
          <i className={`fas ${toast.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="ws-header">
        <div>
          <h1 className="ws-title">
            <i className="fas fa-layer-group"></i> Workspaces
          </h1>
          <p className="ws-subtitle">Collaborate securely with your team in shared spaces</p>
        </div>
        <div className="ws-header-actions">
          {isSpaceAdmin && (
            <button className="ws-btn ws-btn--primary" onClick={() => setShowCreate(true)}>
              <i className="fas fa-plus"></i> Create Workspace
            </button>
          )}
          <button className="ws-btn ws-btn--secondary" onClick={() => setShowJoin(true)}>
            <i className="fas fa-door-open"></i> Join via Code
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="ws-layout">
        {/* Left: workspace list */}
        <div className="ws-list-panel">
          <h2 className="ws-panel-title">My Workspaces</h2>

          {loading && (
            <div className="ws-empty">
              <i className="fas fa-spinner fa-spin"></i>
              <p>Loading...</p>
            </div>
          )}

          {!loading && error && (
            <div className="ws-empty ws-empty--error">
              <i className="fas fa-exclamation-triangle"></i>
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && workspaces.length === 0 && (
            <div className="ws-empty">
              <i className="fas fa-layer-group"></i>
              <p>No workspaces yet.</p>
              <small>
                {isSpaceAdmin
                  ? 'Create one or join via invitation code.'
                  : 'Ask your Space Admin for an invitation code.'}
              </small>
            </div>
          )}

          {workspaces.map(ws => (
            <div
              key={ws.id}
              className={`ws-card ${activeWs?.id === ws.id ? 'ws-card--active' : ''}`}
              onClick={() => openWorkspace(ws)}
            >
              <div className="ws-card-icon">
                <i className="fas fa-users"></i>
              </div>
              <div className="ws-card-info">
                <div className="ws-card-name">{ws.name}</div>
                <div className="ws-card-meta">
                  <span><i className="fas fa-user-tie"></i> {ws.admin_username}</span>
                  <span><i className="fas fa-users"></i> {ws.member_count} members</span>
                  <span><i className="fas fa-file"></i> {ws.file_count} files</span>
                </div>
              </div>
              {ws.is_admin && (
                <span className="ws-badge ws-badge--admin">Admin</span>
              )}
            </div>
          ))}
        </div>

        {/* Right: workspace detail */}
        <div className="ws-detail-panel">
          {!activeWs && (
            <div className="ws-empty ws-empty--hint">
              <i className="fas fa-hand-pointer"></i>
              <p>Select a workspace to view details</p>
            </div>
          )}

          {activeWs && detailLoading && (
            <div className="ws-empty">
              <i className="fas fa-spinner fa-spin"></i>
              <p>Loading workspace...</p>
            </div>
          )}

          {activeWs && wsDetail && !detailLoading && (
            <>
              {/* Detail header */}
              <div className="ws-detail-header">
                <div>
                  <h2 className="ws-detail-title">{wsDetail.name}</h2>
                  {wsDetail.description && (
                    <p className="ws-detail-desc">{wsDetail.description}</p>
                  )}
                  <div className="ws-detail-meta">
                    <span><i className="fas fa-user-tie"></i> Admin: {wsDetail.admin_username}</span>
                    <span><i className="fas fa-calendar"></i> Created: {new Date(wsDetail.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="ws-detail-actions">
                  {wsDetail.is_admin && (
                    <>
                      <button className="ws-btn ws-btn--success" onClick={() => setShowUpload(true)}>
                        <i className="fas fa-upload"></i> Upload File
                      </button>
                      <button className="ws-btn ws-btn--danger ws-btn--sm" onClick={handleDeleteWs}>
                        <i className="fas fa-trash"></i> Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Invite code (admin only) */}
              {wsDetail.invite_code && (
                <div className="ws-invite-box">
                  <div className="ws-invite-label">
                    <i className="fas fa-key"></i> Invitation Code
                    <small>Share this code with users so they can join</small>
                  </div>
                  <div className="ws-invite-code-row">
                    <span className="ws-invite-code">{wsDetail.invite_code}</span>
                    <button className="ws-btn ws-btn--outline ws-btn--sm" onClick={() => copyCode(wsDetail.invite_code)}>
                      <i className="fas fa-copy"></i> Copy
                    </button>
                    {wsDetail.is_admin && (
                      <button className="ws-btn ws-btn--outline ws-btn--sm" onClick={handleRegenCode}>
                        <i className="fas fa-sync"></i> Regenerate
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Members */}
              <div className="ws-section">
                <h3 className="ws-section-title">
                  <i className="fas fa-users"></i> Members ({wsDetail.members?.length || 0})
                </h3>
                <div className="ws-members-table">
                  <div className="ws-members-header">
                    <span>User</span>
                    <span>Role</span>
                    <span>Joined</span>
                    {wsDetail.is_admin && <span>Action</span>}
                  </div>
                  {wsDetail.members?.map(m => (
                    <div key={m.id} className="ws-members-row">
                      <span className="ws-member-name">
                        <i className="fas fa-user-circle"></i>
                        {m.username}
                        {m.id === wsDetail.admin_id && (
                          <span className="ws-badge ws-badge--admin ws-badge--sm">Admin</span>
                        )}
                      </span>
                      <span>
                        <span className={`ws-role-badge ws-role-badge--${m.role}`}>
                          {m.role === 'global_admin' ? 'Global Admin' :
                           m.role === 'space_admin' ? 'Space Admin' : 'User'}
                        </span>
                      </span>
                      <span className="ws-member-date">
                        {new Date(m.joined_at).toLocaleDateString()}
                      </span>
                      {wsDetail.is_admin && (
                        <span>
                          {m.id !== wsDetail.admin_id && (
                            <button
                              className="ws-btn ws-btn--danger ws-btn--xs"
                              onClick={() => handleRemoveMember(m.id, m.username)}
                            >
                              <i className="fas fa-user-minus"></i> Remove
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Files */}
              <div className="ws-section">
                <h3 className="ws-section-title">
                  <i className="fas fa-folder-open"></i> Files ({wsDetail.files?.length || 0})
                </h3>
                {wsDetail.files?.length === 0 ? (
                  <div className="ws-empty ws-empty--sm">
                    <i className="fas fa-file-slash"></i>
                    <p>No files yet. {wsDetail.is_admin ? 'Upload the first one!' : 'The admin will upload files here.'}</p>
                  </div>
                ) : (
                  <div className="ws-files-table">
                    <div className="ws-files-header">
                      <span>Name</span>
                      <span>Type</span>
                      <span>Size</span>
                      <span>Owner</span>
                      <span>Uploaded</span>
                    </div>
                    {wsDetail.files?.map(f => (
                      <div key={f.id} className="ws-files-row">
                        <span className="ws-file-name">
                          <i className={`fas ${getFileIcon(f.file_type)}`}></i>
                          {f.filename}
                        </span>
                        <span><span className="ws-file-type">{f.file_type}</span></span>
                        <span>{formatBytes(f.size)}</span>
                        <span>{f.owner}</span>
                        <span>{new Date(f.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Modal: Create Workspace ─────────────── */}
      {showCreate && (
        <div className="ws-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="ws-modal" onClick={e => e.stopPropagation()}>
            <div className="ws-modal-header">
              <h3><i className="fas fa-plus-circle"></i> Create New Workspace</h3>
              <button className="ws-modal-close" onClick={() => setShowCreate(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleCreate} className="ws-modal-body">
              <div className="ws-form-group">
                <label>Workspace Name <span className="ws-required">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Project Alpha"
                  value={createForm.name}
                  onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
                  required
                  className="ws-input"
                />
              </div>
              <div className="ws-form-group">
                <label>Description <span className="ws-optional">(optional)</span></label>
                <textarea
                  placeholder="Brief description of this workspace..."
                  value={createForm.description}
                  onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                  className="ws-input ws-textarea"
                  rows={3}
                />
              </div>
              <div className="ws-modal-footer">
                <button type="button" className="ws-btn ws-btn--secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="ws-btn ws-btn--primary">
                  <i className="fas fa-plus"></i> Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Join Workspace ───────────────── */}
      {showJoin && (
        <div className="ws-modal-overlay" onClick={() => setShowJoin(false)}>
          <div className="ws-modal ws-modal--sm" onClick={e => e.stopPropagation()}>
            <div className="ws-modal-header">
              <h3><i className="fas fa-door-open"></i> Join a Workspace</h3>
              <button className="ws-modal-close" onClick={() => setShowJoin(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleJoin} className="ws-modal-body">
              <div className="ws-join-illustration">
                <i className="fas fa-key"></i>
              </div>
              <div className="ws-form-group">
                <label>Invitation Code</label>
                <input
                  type="text"
                  placeholder="Enter the 8-character code"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  required
                  maxLength={8}
                  className="ws-input ws-input--code"
                />
              </div>
              <p className="ws-join-hint">
                <i className="fas fa-info-circle"></i>
                Get this code from your Space Admin.
              </p>
              <div className="ws-modal-footer">
                <button type="button" className="ws-btn ws-btn--secondary" onClick={() => setShowJoin(false)}>
                  Cancel
                </button>
                <button type="submit" className="ws-btn ws-btn--primary">
                  <i className="fas fa-sign-in-alt"></i> Join
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Upload File ──────────────────── */}
      {showUpload && (
        <div className="ws-modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="ws-modal ws-modal--sm" onClick={e => e.stopPropagation()}>
            <div className="ws-modal-header">
              <h3><i className="fas fa-upload"></i> Upload to "{activeWs?.name}"</h3>
              <button className="ws-modal-close" onClick={() => setShowUpload(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleUpload} className="ws-modal-body">
              <div
                className="ws-dropzone"
                onDrop={e => { e.preventDefault(); setUploadFile(e.dataTransfer.files[0]); }}
                onDragOver={e => e.preventDefault()}
                onClick={() => document.getElementById('ws-file-input').click()}
              >
                {uploadFile ? (
                  <>
                    <i className="fas fa-file-check" style={{ color: 'var(--success-color)', fontSize: '2.5rem' }}></i>
                    <p>{uploadFile.name}</p>
                    <small>{formatBytes(uploadFile.size)}</small>
                  </>
                ) : (
                  <>
                    <i className="fas fa-cloud-upload-alt"></i>
                    <p>Drop file here or click to browse</p>
                    <small>All file types accepted</small>
                  </>
                )}
                <input
                  id="ws-file-input"
                  type="file"
                  style={{ display: 'none' }}
                  onChange={e => setUploadFile(e.target.files[0])}
                />
              </div>
              <p className="ws-join-hint">
                <i className="fas fa-info-circle"></i>
                All workspace members will automatically get read access.
              </p>
              <div className="ws-modal-footer">
                <button type="button" className="ws-btn ws-btn--secondary" onClick={() => setShowUpload(false)}>
                  Cancel
                </button>
                <button type="submit" className="ws-btn ws-btn--primary" disabled={!uploadFile}>
                  <i className="fas fa-upload"></i> Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// File icon helper
function getFileIcon(type) {
  const icons = {
    document: 'fa-file-word',
    image: 'fa-file-image',
    video: 'fa-file-video',
    audio: 'fa-file-audio',
    archive: 'fa-file-zipper',
    code: 'fa-file-code',
    spreadsheet: 'fa-file-excel',
    presentation: 'fa-file-powerpoint',
    pdf: 'fa-file-pdf',
    other: 'fa-file'
  };
  return icons[type] || 'fa-file';
}

export default Workspace;
