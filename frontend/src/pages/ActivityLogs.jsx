import React, { useState, useEffect, useMemo } from 'react';
import { formatDate } from '../utils/formatters';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/ActivityLogs.css';
import axios from 'axios';

const ActivityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const API_URL = 'http://localhost:5000/api';

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(response.data);
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError(err.response?.data?.error || 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action) => {
    if (action.includes('UPLOAD')) return 'fa-cloud-upload-alt';
    if (action.includes('DOWNLOAD')) return 'fa-cloud-download-alt';
    if (action.includes('LOGIN_FAILED')) return 'fa-exclamation-triangle';
    if (action.includes('LOGIN')) return 'fa-sign-in-alt';
    if (action.includes('DELETE')) return 'fa-trash-alt';
    if (action.includes('SHARE')) return 'fa-share-alt';
    if (action.includes('EDIT')) return 'fa-edit';
    if (action.includes('PERMISSION')) return 'fa-shield-alt';
    return 'fa-file';
  };

  const getActionClass = (action) => {
    if (action.includes('UPLOAD')) return 'action-upload';
    if (action.includes('DOWNLOAD')) return 'action-download';
    if (action.includes('LOGIN_FAILED')) return 'action-failed';
    if (action.includes('LOGIN')) return 'action-login';
    if (action.includes('DELETE')) return 'action-delete';
    if (action.includes('SHARE')) return 'action-share';
    if (action.includes('EDIT')) return 'action-edit';
    return 'action-default';
  };

  const getActionLabel = (action) => {
    return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  // Filter logs
  const filteredLogs = useMemo(() => {
    let filtered = [...logs];

    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.user?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.resource?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.ip_address?.includes(searchTerm)
      );
    }

    if (filterAction !== 'all') {
      filtered = filtered.filter(log => log.action === filterAction);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(log => log.status === filterStatus);
    }

    if (dateRange.start) {
      const startDate = new Date(dateRange.start);
      filtered = filtered.filter(log => new Date(log.timestamp) >= startDate);
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59);
      filtered = filtered.filter(log => new Date(log.timestamp) <= endDate);
    }

    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return filtered;
  }, [logs, searchTerm, filterAction, filterStatus, dateRange]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const stats = {
    total: logs.length,
    success: logs.filter(l => l.status === 'success').length,
    failed: logs.filter(l => l.status === 'failed').length,
    uniqueUsers: new Set(logs.map(l => l.user)).size
  };

  const uniqueActions = [...new Set(logs.map(log => log.action))];

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterAction('all');
    setFilterStatus('all');
    setDateRange({ start: '', end: '' });
    setCurrentPage(1);
    setSaveMessage('Filters cleared');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleViewDetails = (log) => {
    setSelectedLog(log);
    setShowDetailsModal(true);
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="error-container">{error}</div>;

  return (
    <div className="activity-logs-page">
      {/* Header */}
      <div className="logs-header">
        <div>
          <h1>
            <i className="fas fa-clipboard-list"></i>
            Activity Logs
          </h1>
          <p className="logs-subtitle">Monitor and track all system activities</p>
        </div>
        {saveMessage && (
          <div className="save-message success">
            <i className="fas fa-check-circle"></i>
            {saveMessage}
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="logs-stats-grid">
        <div className="stat-card">
          <div className="stat-icon total">
            <i className="fas fa-list"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Events</span>
            <span className="stat-value">{stats.total}</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon success">
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Successful</span>
            <span className="stat-value">{stats.success}</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon failed">
            <i className="fas fa-times-circle"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Failed</span>
            <span className="stat-value">{stats.failed}</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon users">
            <i className="fas fa-users"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Active Users</span>
            <span className="stat-value">{stats.uniqueUsers}</span>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-header-left">
            <h2>
              <i className="fas fa-history"></i>
              Event History
            </h2>
            <p className="card-description">View and filter all system activity logs</p>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="filters-bar">
          <div className="search-box">
            <i className="fas fa-search"></i>
            <input
              type="text"
              placeholder="Search by user, action, resource or IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="filter-group">
            <select
              className="filter-select"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
            >
              <option value="all">All Actions</option>
              {uniqueActions.map(action => (
                <option key={action} value={action}>{getActionLabel(action)}</option>
              ))}
            </select>
            
            <select
              className="filter-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="date-range">
            <input
              type="date"
              className="date-input"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              placeholder="Start Date"
            />
            <span>to</span>
            <input
              type="date"
              className="date-input"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              placeholder="End Date"
            />
          </div>

          {(searchTerm || filterAction !== 'all' || filterStatus !== 'all' || dateRange.start || dateRange.end) && (
            <button className="btn-clear-filters" onClick={handleClearFilters}>
              <i className="fas fa-times"></i>
              Clear Filters
            </button>
          )}
        </div>

        {/* Table Controls */}
        <div className="table-controls">
          <div className="items-per-page">
            <span>Show:</span>
            <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>entries</span>
          </div>
          <div className="results-count">
            Showing {paginatedLogs.length} of {filteredLogs.length} results
          </div>
        </div>

        {/* Logs Table */}
        <div className="logs-table">
          {filteredLogs.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-clipboard-list"></i>
              <p>No activity logs found</p>
              <button className="btn-clear-filters" onClick={handleClearFilters}>
                Clear Filters
              </button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>IP Address</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map(log => (
                  <tr key={log.id} className={log.status === 'failed' ? 'log-failed' : ''}>
                    <td className="timestamp-cell">
                      <i className="fas fa-clock"></i>
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="user-cell">
                      <div className="user-avatar-small">
                        {log.user?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      {log.user || 'Unknown'}
                    </td>
                    <td>
                      <span className={`action-badge ${getActionClass(log.action)}`}>
                        <i className={`fas ${getActionIcon(log.action)}`}></i>
                        {getActionLabel(log.action)}
                      </span>
                    </td>
                    <td className="resource-cell">
                      {log.resource ? (
                        <>
                          <i className="fas fa-file-alt"></i>
                          {log.resource}
                        </>
                      ) : '-'}
                    </td>
                    <td className="ip-cell">
                      <i className="fas fa-network-wired"></i>
                      {log.ip_address || '-'}
                    </td>
                    <td>
                      <span className={`status-badge ${log.status === 'success' ? 'status-success' : 'status-failed'}`}>
                        <i className={`fas ${log.status === 'success' ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                        {log.status === 'success' ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="view-details-btn"
                        onClick={() => handleViewDetails(log)}
                        title="View Details"
                      >
                        <i className="fas fa-eye"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="pagination-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
            >
              <i className="fas fa-chevron-left"></i>
              Previous
            </button>
            
            <div className="pagination-pages">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    className={`pagination-page ${currentPage === pageNum ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              className="pagination-btn"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              Next
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        )}
      </div>

      {/* Log Details Modal */}
      {showDetailsModal && selectedLog && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <i className="fas fa-info-circle"></i>
                Log Details
              </h2>
              <button className="modal-close" onClick={() => setShowDetailsModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="detail-group">
                <label>Timestamp</label>
                <div className="detail-value">
                  <i className="fas fa-calendar-alt"></i>
                  {new Date(selectedLog.timestamp).toLocaleString()}
                </div>
              </div>
              
              <div className="detail-group">
                <label>User</label>
                <div className="detail-value">
                  <div className="user-avatar-detail">
                    {selectedLog.user?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  {selectedLog.user || 'Unknown'}
                </div>
              </div>
              
              <div className="detail-group">
                <label>Action</label>
                <div className="detail-value">
                  <span className={`action-badge ${getActionClass(selectedLog.action)}`}>
                    <i className={`fas ${getActionIcon(selectedLog.action)}`}></i>
                    {getActionLabel(selectedLog.action)}
                  </span>
                </div>
              </div>
              
              <div className="detail-group">
                <label>Resource</label>
                <div className="detail-value">
                  <i className="fas fa-file-alt"></i>
                  {selectedLog.resource || 'N/A'}
                </div>
              </div>
              
              <div className="detail-group">
                <label>IP Address</label>
                <div className="detail-value">
                  <i className="fas fa-network-wired"></i>
                  {selectedLog.ip_address || 'N/A'}
                </div>
              </div>
              
              <div className="detail-group">
                <label>Status</label>
                <div className="detail-value">
                  <span className={`status-badge ${selectedLog.status === 'success' ? 'status-success' : 'status-failed'}`}>
                    <i className={`fas ${selectedLog.status === 'success' ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                    {selectedLog.status === 'success' ? 'Success' : 'Failed'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn-close" onClick={() => setShowDetailsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityLogs;