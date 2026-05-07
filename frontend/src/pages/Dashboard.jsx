import React, { useState, useEffect } from 'react';
import StatCard from '../components/StatCard';
import StorageBar from '../components/StorageBar';
import FileTypeDistribution from '../components/FileTypeDistribution';
import WeeklyActivityChart from '../components/WeeklyActivityChart';
import RecentActivity from '../components/RecentActivity';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatBytes } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [quickStats, setQuickStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('week');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const { userRole, user } = useAuth();

  const API_URL = 'http://localhost:5000/api';

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => fetchDashboardData(true), 300000);
    return () => clearInterval(interval);
  }, [selectedTimeRange]);

  const fetchDashboardData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const token = localStorage.getItem('access_token');
      
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const [statsRes, activityRes, quickStatsRes] = await Promise.all([
        axios.get(`${API_URL}/dashboard/stats`, config),
        axios.get(`${API_URL}/dashboard/activity`, config),
        axios.get(`${API_URL}/dashboard/quick-stats`, config)
      ]);
      
      setStats(statsRes.data.stats);
      setActivities(activityRes.data.activities || []);
      setQuickStats(quickStatsRes.data.quick_stats);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Dashboard error:', err);
      setError(err.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
  };

  const getStorageWarningLevel = () => {
    const percentage = stats?.storage_percentage || 0;
    if (percentage >= 90) return { level: 'critical', message: 'Storage almost full! Please clean up or upgrade.' };
    if (percentage >= 75) return { level: 'warning', message: 'Storage is running low.' };
    return { level: 'good', message: 'Storage is healthy.' };
  };

  const getWelcomeMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const storageWarning = getStorageWarningLevel();
  const displayName = user?.full_name || user?.username || 'User';

  if (loading) return <LoadingSpinner message="Loading dashboard data..." />;
  if (error) return (
    <div className="error-container">
      <i className="fas fa-exclamation-triangle"></i>
      <p>{error}</p>
      <button onClick={() => fetchDashboardData()} className="retry-btn">Try Again</button>
    </div>
  );

  return (
    <div className="dashboard-page">
      {/* Header with Welcome Message */}
      <div className="page-header">
        <div className="welcome-section">
          <h1>
            <i className="fas fa-chart-line"></i> 
            {getWelcomeMessage()}, {displayName}!
          </h1>
          <p className="page-subtitle">
            Here's what's happening with your files. 
            {lastUpdated && <span className="last-updated"> Last updated: {lastUpdated.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div className="header-actions">
          <select className="time-range-select" value={selectedTimeRange} onChange={(e) => setSelectedTimeRange(e.target.value)}>
            <option value="day">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="year">This Year</option>
          </select>
          <button className="refresh-btn" onClick={handleRefresh} disabled={refreshing}>
            <i className={`fas fa-sync-alt ${refreshing ? 'fa-spin' : ''}`}></i>
            <span>{refreshing ? 'Refreshing...' : ''}</span>
          </button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="stats-grid primary-stats">
        <StatCard 
          icon="fa-folder-open" 
          label="Total Files" 
          value={stats?.total_files || 0} 
          trend="+12% from last month" 
          color="blue" 
        />
        <StatCard 
          icon="fa-database" 
          label="Storage Used" 
          value={stats?.storage_used || 0} 
          subtext={`of ${formatBytes(stats?.storage_quota)}`} 
          color="green" 
        />
        <StatCard 
          icon="fa-exchange-alt" 
          label="Today's Activity" 
          value={(stats?.today_uploads || 0) + (stats?.today_downloads || 0)} 
          subtext={`↑${stats?.today_uploads || 0} uploads ↓${stats?.today_downloads || 0} downloads`} 
          color="purple" 
        />
        <StatCard 
          icon="fa-share-alt" 
          label="Total Shares" 
          value={stats?.total_shares || 0} 
          subtext={`${stats?.public_links || 0} public links`} 
          color="orange" 
        />
      </div>

      {/* Quick Stats Mini Cards */}
      <div className="stats-grid secondary-stats">
        <div className="stat-card-mini">
          <i className="fas fa-bolt"></i>
          <div>
            <div className="mini-value">{stats?.avg_upload_speed || 0} MB/s</div>
            <div className="mini-label">Upload Speed</div>
          </div>
        </div>
        <div className="stat-card-mini">
          <i className="fas fa-users"></i>
          <div>
            <div className="mini-value">{stats?.active_users_today || 0}</div>
            <div className="mini-label">Active Users Today</div>
          </div>
        </div>
        <div className="stat-card-mini">
          <i className="fas fa-check-circle"></i>
          <div>
            <div className="mini-value">{stats?.success_rate || 0}%</div>
            <div className="mini-label">Success Rate</div>
          </div>
        </div>
        <div className="stat-card-mini">
          <i className="fas fa-clock"></i>
          <div>
            <div className="mini-value">{stats?.avg_session_duration || 0} min</div>
            <div className="mini-label">Avg Session Duration</div>
          </div>
        </div>
      </div>

      {/* Storage Analytics Section */}
      <div className="card storage-card">
        <div className="card-header">
          <h2><i className="fas fa-chart-pie"></i> Storage Analytics</h2>
          {storageWarning.level !== 'good' && (
            <div className={`storage-warning-badge ${storageWarning.level}`}>
              <i className={`fas ${storageWarning.level === 'critical' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`}></i>
              {storageWarning.message}
            </div>
          )}
        </div>
        
        <div className="storage-overview">
          <div className="storage-stat-item">
            <div className="storage-stat-icon">
              <i className="fas fa-hdd"></i>
            </div>
            <div>
              <div className="storage-stat-label">Used Space</div>
              <div className="storage-stat-value">{formatBytes(stats?.storage_used)}</div>
              <div className="storage-stat-sub">of {formatBytes(stats?.storage_quota)}</div>
            </div>
          </div>
          <div className="storage-stat-item">
            <div className="storage-stat-icon">
              <i className="fas fa-cloud-upload-alt"></i>
            </div>
            <div>
              <div className="storage-stat-label">Available</div>
              <div className="storage-stat-value">{formatBytes((stats?.storage_quota || 0) - (stats?.storage_used || 0))}</div>
              <div className="storage-stat-sub">{100 - (stats?.storage_percentage || 0)}% remaining</div>
            </div>
          </div>
          {stats?.storage_percentage >= 90 && (
            <div className="storage-action">
              <button className="btn-upgrade" onClick={() => window.location.href = '/quota'}>
                <i className="fas fa-rocket"></i> Upgrade Storage
              </button>
            </div>
          )}
        </div>
        
        <StorageBar 
          used={stats?.storage_used} 
          quota={stats?.storage_quota} 
          percentage={stats?.storage_percentage} 
        />
      </div>

      {/* Two Column Layout for Charts */}
      <div className="two-column-grid">
        <FileTypeDistribution autoFetch={true} />
        <WeeklyActivityChart 
          uploads={stats?.weekly_uploads} 
          downloads={stats?.weekly_downloads} 
        />
      </div>

      {/* Recent Activity Section */}
      <RecentActivity autoFetch={true} limit={10} />

      {/* Footer Stats */}
      <div className="dashboard-footer">
        <div className="footer-stat">
          <i className="fas fa-calendar-alt"></i>
          <span>Account created: {new Date(stats?.account_created).toLocaleDateString() || 'N/A'}</span>
        </div>
        <div className="footer-stat">
          <i className="fas fa-chart-line"></i>
          <span>Data based on {selectedTimeRange} range</span>
        </div>
        <div className="footer-stat">
          <i className="fas fa-shield-alt"></i>
          <span>Role: {userRole?.replace('_', ' ') || 'User'}</span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;