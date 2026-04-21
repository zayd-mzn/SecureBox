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

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [quickStats, setQuickStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('week');
  const { userRole } = useAuth();

  const API_URL = 'http://localhost:5000/api';

  useEffect(() => {
    fetchDashboardData();
  }, [selectedTimeRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
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
    } catch (err) {
      console.error('Dashboard error:', err);
      setError(err.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="error-container"><p>{error}</p><button onClick={fetchDashboardData}>Retry</button></div>;

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1><i className="fas fa-chart-line"></i> Dashboard Overview</h1>
          <p className="page-subtitle">Welcome back! Here's what's happening with your files.</p>
        </div>
        <select className="time-range-select" value={selectedTimeRange} onChange={(e) => setSelectedTimeRange(e.target.value)}>
          <option value="day">Today</option>
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
          <option value="year">This Year</option>
        </select>
      </div>

      <div className="stats-grid">
        <StatCard icon="fa-folder-open" label="Total Files" value={stats?.total_files} trend="12% from last month" color="blue" />
        <StatCard icon="fa-database" label="Storage Used" value={stats?.storage_used} subtext={`of ${formatBytes(stats?.storage_quota)}`} color="green" />
        <StatCard icon="fa-exchange-alt" label="Today's Activity" value={stats?.today_uploads + stats?.today_downloads} subtext={`↑${stats?.today_uploads} ↓${stats?.today_downloads}`} color="purple" />
        <StatCard icon="fa-share-alt" label="Total Shares" value={stats?.total_shares} subtext={`${stats?.public_links} public links`} color="orange" />
      </div>

      <div className="stats-grid secondary">
        <div className="stat-card-mini"><i className="fas fa-bolt"></i><div><div className="mini-value">{stats?.avg_upload_speed || 0} MB/s</div><div className="mini-label">Upload Speed</div></div></div>
        <div className="stat-card-mini"><i className="fas fa-users"></i><div><div className="mini-value">{stats?.active_users_today || 0}</div><div className="mini-label">Active Users</div></div></div>
        <div className="stat-card-mini"><i className="fas fa-check-circle"></i><div><div className="mini-value">{stats?.success_rate || 0}%</div><div className="mini-label">Success Rate</div></div></div>
        <div className="stat-card-mini"><i className="fas fa-clock"></i><div><div className="mini-value">{stats?.avg_session_duration || 0} min</div><div className="mini-label">Avg Session</div></div></div>
      </div>

      <div className="card">
        <div className="card-header"><h2><i className="fas fa-chart-pie"></i> Storage Analytics</h2></div>
        <div className="storage-overview">
          <div className="storage-stat-item"><div className="storage-stat-icon"><i className="fas fa-hdd"></i></div><div><div className="storage-stat-label">Used Space</div><div className="storage-stat-value">{formatBytes(stats?.storage_used)}</div><div className="storage-stat-sub">of {formatBytes(stats?.storage_quota)}</div></div></div>
          <div className="storage-stat-item"><div className="storage-stat-icon"><i className="fas fa-cloud"></i></div><div><div className="storage-stat-label">Available</div><div className="storage-stat-value">{formatBytes((stats?.storage_quota || 0) - (stats?.storage_used || 0))}</div><div className="storage-stat-sub">{100 - (stats?.storage_percentage || 0)}% remaining</div></div></div>
        </div>
        <StorageBar used={stats?.storage_used} quota={stats?.storage_quota} percentage={stats?.storage_percentage} />
      </div>

      <FileTypeDistribution data={stats?.file_type_breakdown} />
      <WeeklyActivityChart uploads={stats?.weekly_uploads} downloads={stats?.weekly_downloads} />
      <RecentActivity activities={activities} />
    </div>
  );
};

export default Dashboard;