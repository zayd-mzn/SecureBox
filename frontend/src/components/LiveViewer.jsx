import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

/**
 * LiveViewer - Read-only real-time view of a file being edited by another user.
 * Shows live content, cursor position, and active viewers.
 */
const LiveViewer = ({ fileId, filename, onClose }) => {
  const [content, setContent] = useState('Loading...');
  const [cursor, setCursor] = useState(null);
  const [editor, setEditor] = useState('');
  const [viewers, setViewers] = useState([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    
    // Fetch initial file content
    axios.get(`http://localhost:5000/api/files/download/${fileId}`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'text'
    }).then(res => setContent(res.data))
      .catch(() => setContent('(Failed to load file content)'));

    const socket = io('http://localhost:5000', { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join_file', { token, file_id: fileId });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('live_update', (data) => {
      setContent(data.content);
      setCursor(data.cursor);
      setEditor(data.editor);
    });

    socket.on('cursor_update', (data) => {
      setCursor(data.cursor);
      setEditor(data.editor);
    });

    socket.on('viewers_updated', (data) => setViewers(data));

    socket.on('error', (data) => {
      alert(data.message);
      onClose();
    });

    socket.on('editor_disconnected', () => {
      alert('Editor disconnected. File has been unlocked.');
      onClose();
    });

    return () => {
      socket.emit('leave_file', { file_id: fileId });
      socket.disconnect();
    };
  }, [fileId, onClose]);

  // Compute cursor indicator position
  const getCursorInfo = () => {
    if (!cursor) return null;
    return `Line ${cursor.line + 1}, Col ${cursor.ch + 1}`;
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <h3 style={styles.title}>
              <i className="fas fa-eye" style={{ marginRight: 8 }}></i>
              Live View: {filename}
            </h3>
            <span style={styles.badge}>READ-ONLY</span>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>&times;</button>
        </div>

        {/* Status bar */}
        <div style={styles.statusBar}>
          <div style={styles.statusLeft}>
            <span style={{
              ...styles.dot,
              backgroundColor: connected ? '#48bb78' : '#fc8181'
            }}></span>
            {connected ? 'Connected' : 'Disconnected'}
            {editor && <span style={styles.editorLabel}>
              &nbsp;— Editing by <strong>{editor}</strong>
            </span>}
          </div>
          <div style={styles.statusRight}>
            {getCursorInfo() && <span style={styles.cursorInfo}>
              <i className="fas fa-i-cursor" style={{ marginRight: 4 }}></i>
              {getCursorInfo()}
            </span>}
            <span style={styles.viewerCount}>
              <i className="fas fa-users" style={{ marginRight: 4 }}></i>
              {viewers.length} viewer{viewers.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Content area */}
        <div style={styles.editorContainer}>
          <div style={styles.lineNumbers}>
            {content.split('\n').map((_, i) => (
              <div key={i} style={{
                ...styles.lineNum,
                backgroundColor: cursor && cursor.line === i ? '#3d4556' : 'transparent'
              }}>
                {i + 1}
              </div>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            value={content}
            readOnly
            style={styles.textarea}
            spellCheck={false}
          />
          {/* Cursor highlight indicator */}
          {cursor && (
            <div style={{
              ...styles.cursorHighlight,
              top: cursor.line * 20 + 8,
            }} title={`${editor}'s cursor`}>
            </div>
          )}
        </div>

        {/* Viewers list */}
        {viewers.length > 0 && (
          <div style={styles.viewersBar}>
            {viewers.map((v, i) => (
              <span key={i} style={{
                ...styles.viewerChip,
                backgroundColor: v.is_editor ? '#ed8936' : '#4299e1'
              }}>
                <i className={`fas ${v.is_editor ? 'fa-pen' : 'fa-eye'}`} style={{ marginRight: 4 }}></i>
                {v.username}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 10000
  },
  modal: {
    backgroundColor: '#1a202c', borderRadius: 12, width: '85%', maxWidth: 900,
    height: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 20px', borderBottom: '1px solid #2d3748'
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  title: { margin: 0, color: '#e2e8f0', fontSize: 16 },
  badge: {
    backgroundColor: '#e53e3e', color: '#fff', padding: '2px 8px',
    borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: 0.5
  },
  closeBtn: {
    background: 'none', border: 'none', color: '#a0aec0', fontSize: 24,
    cursor: 'pointer', padding: '0 8px'
  },
  statusBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 20px', backgroundColor: '#2d3748', fontSize: 13, color: '#a0aec0'
  },
  statusLeft: { display: 'flex', alignItems: 'center' },
  statusRight: { display: 'flex', alignItems: 'center', gap: 16 },
  dot: { width: 8, height: 8, borderRadius: '50%', marginRight: 8 },
  editorLabel: { color: '#cbd5e0' },
  cursorInfo: { color: '#a0aec0' },
  viewerCount: { color: '#a0aec0' },
  editorContainer: {
    flex: 1, display: 'flex', position: 'relative', overflow: 'hidden'
  },
  lineNumbers: {
    width: 48, backgroundColor: '#1e2533', padding: '8px 0',
    overflowY: 'hidden', borderRight: '1px solid #2d3748'
  },
  lineNum: {
    height: 20, lineHeight: '20px', textAlign: 'right', paddingRight: 12,
    fontSize: 12, color: '#4a5568', fontFamily: 'monospace'
  },
  textarea: {
    flex: 1, backgroundColor: '#1a202c', color: '#e2e8f0', border: 'none',
    padding: '8px 16px', fontFamily: "'Fira Code', 'Courier New', monospace",
    fontSize: 14, lineHeight: '20px', resize: 'none', outline: 'none',
    overflowY: 'auto'
  },
  cursorHighlight: {
    position: 'absolute', left: 48, right: 0, height: 20,
    backgroundColor: 'rgba(237, 137, 54, 0.1)', pointerEvents: 'none',
    borderLeft: '2px solid #ed8936'
  },
  viewersBar: {
    padding: '8px 20px', borderTop: '1px solid #2d3748',
    display: 'flex', gap: 8, flexWrap: 'wrap'
  },
  viewerChip: {
    color: '#fff', padding: '3px 10px', borderRadius: 12,
    fontSize: 12, fontWeight: 500
  }
};

export default LiveViewer;
