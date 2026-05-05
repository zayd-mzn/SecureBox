import React, { useState, useEffect } from 'react';
import { formatNumber, formatBytes } from '../utils/formatters';
import './FileTypeDistribution.css';
import axios from 'axios';

const FileTypeDistribution = ({ data: propData, fileId, userId, autoFetch = false }) => {
  const [data, setData] = useState(propData || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_URL = 'http://localhost:5000/api';

  // Auto-fetch data if autoFetch is true and no prop data provided
  useEffect(() => {
    if (autoFetch && !propData) {
      fetchFileTypeDistribution();
    }
  }, [autoFetch, fileId, userId]);

  // Fetch file type distribution from backend
  const fetchFileTypeDistribution = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('access_token');
      
      let endpoint = `${API_URL}/dashboard/file-type-distribution`;
      if (fileId) {
        endpoint = `${API_URL}/files/${fileId}/type-distribution`;
      } else if (userId) {
        endpoint = `${API_URL}/admin/users/${userId}/file-distribution`;
      }
      
      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setData(response.data);
    } catch (err) {
      console.error('Error fetching file type distribution:', err);
      setError(err.response?.data?.error || 'Failed to load file type distribution');
    } finally {
      setLoading(false);
    }
  };

  // Get icon based on file type
  const getFileIcon = (type) => {
    const icons = {
      document: 'fa-file-alt',
      image: 'fa-image',
      video: 'fa-video',
      audio: 'fa-music',
      archive: 'fa-file-archive',
      other: 'fa-file'
    };
    return icons[type.toLowerCase()] || 'fa-file';
  };

  // Get color based on file type
  const getTypeColor = (type, index) => {
    const colors = {
      document: '#4299e1',
      image: '#48bb78',
      video: '#ed8936',
      audio: '#9f7aea',
      archive: '#f687b3',
      other: '#a0aec0'
    };
    return colors[type.toLowerCase()] || `hsl(${index * 45}, 70%, 60%)`;
  };

  // Calculate trend (mock for now - would come from backend)
  const getTrend = (type) => {
    const trends = {
      document: '+12%',
      image: '+8%',
      video: '+23%',
      audio: '+5%',
      archive: '-2%',
      other: '+1%'
    };
    return trends[type.toLowerCase()] || '+0%';
  };

  const getTrendUp = (type) => {
    return !getTrend(type).startsWith('-');
  };

  if (loading) {
    return (
      <div className="card file-distribution">
        <div className="card-header">
          <h2><i className="fas fa-chart-bar"></i> File Type Distribution</h2>
          <div className="loading-spinner-small">
            <i className="fas fa-spinner fa-spin"></i>
          </div>
        </div>
        <div className="distribution-loading">
          <p>Loading distribution data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card file-distribution">
        <div className="card-header">
          <h2><i className="fas fa-chart-bar"></i> File Type Distribution</h2>
        </div>
        <div className="distribution-error">
          <i className="fas fa-exclamation-triangle"></i>
          <p>{error}</p>
          <button onClick={fetchFileTypeDistribution} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="card file-distribution">
        <div className="card-header">
          <h2><i className="fas fa-chart-bar"></i> File Type Distribution</h2>
        </div>
        <div className="distribution-empty">
          <i className="fas fa-chart-pie"></i>
          <p>No file type data available</p>
          <p className="text-muted">Upload some files to see distribution</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card file-distribution">
      <div className="card-header">
        <h2>
          <i className="fas fa-chart-bar"></i>
          File Type Distribution
        </h2>
        <button className="refresh-btn-small" onClick={fetchFileTypeDistribution} title="Refresh">
          <i className="fas fa-sync-alt"></i>
        </button>
      </div>

      <div className="distribution-summary">
        <div className="summary-stat">
          <span className="stat-label">Total Files</span>
          <span className="stat-value">{formatNumber(data.reduce((sum, t) => sum + t.count, 0))}</span>
        </div>
        <div className="summary-stat">
          <span className="stat-label">Total Size</span>
          <span className="stat-value">{formatBytes(data.reduce((sum, t) => sum + (t.size || 0), 0))}</span>
        </div>
        <div className="summary-stat">
          <span className="stat-label">File Types</span>
          <span className="stat-value">{data.length}</span>
        </div>
      </div>

      <div className="distribution-list">
        {data.map((type, idx) => {
          const typeColor = type.color || getTypeColor(type.type, idx);
          const trend = type.trend || getTrend(type.type);
          const trendUp = type.trendUp !== undefined ? type.trendUp : getTrendUp(type.type);
          const percentage = type.percentage || (type.count / data.reduce((sum, t) => sum + t.count, 0)) * 100;
          
          return (
            <div key={idx} className="distribution-item">
              <div className="dist-item-header">
                <div className="dist-item-info">
                  <i className={`fas ${getFileIcon(type.type)} dist-item-icon`} style={{ color: typeColor }}></i>
                  <div>
                    <div className="dist-item-name">{type.type}</div>
                    <div className="dist-item-meta">
                      {formatNumber(type.count)} files
                      {type.size && <span className="meta-separator">•</span>}
                      {type.size && <span>{formatBytes(type.size)}</span>}
                    </div>
                  </div>
                </div>
                <div className={`dist-item-trend ${trendUp ? 'positive' : 'negative'}`}>
                  <i className={`fas fa-arrow-${trendUp ? 'up' : 'down'}`}></i>
                  {trend}
                </div>
              </div>
              
              <div className="dist-progress-bar">
                <div 
                  className="dist-progress-fill" 
                  style={{ width: `${percentage}%`, background: typeColor }}
                >
                  <span className="progress-percent">{percentage.toFixed(1)}%</span>
                </div>
              </div>
              
              <div className="dist-item-footer">
                <span>{percentage.toFixed(1)}% of total files</span>
                {type.avgSize && (
                  <span className="avg-size">Avg: {formatBytes(type.avgSize)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FileTypeDistribution;