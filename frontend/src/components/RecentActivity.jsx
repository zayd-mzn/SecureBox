import React from 'react';
import { getActivityIcon } from '../utils/formatters';

const RecentActivity = ({ activities }) => {
  if (!activities) return null;

  return (
    <div className="card activity-feed">
      <div className="card-header">
        <h2><i className="fas fa-stream"></i> Recent Activity</h2>
      </div>
      <div className="activity-timeline">
        {activities.map((activity, idx) => (
          <div key={idx} className="timeline-item">
            <div className={`timeline-icon ${activity.action}`}>
              <i className={`fas ${getActivityIcon(activity.action)}`}></i>
            </div>
            <div className="timeline-content">
              <div className="timeline-header">
                <strong>{activity.user}</strong> {activity.action}d{' '}
                <span className="timeline-file">{activity.file}</span>
              </div>
              <div className="timeline-time">{activity.time}</div>
            </div>
            <div className={`timeline-status ${activity.status}`}>
              <i className={`fas ${activity.status === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentActivity;