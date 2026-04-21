import React from 'react';
import { formatBytes } from '../utils/formatters';

const StorageBar = ({ used, quota, percentage }) => {
  return (
    <div className="storage-progress">
      <div className="storage-progress-header">
        <span>Storage Usage</span>
        <span className="storage-progress-percent">{percentage || 0}%</span>
      </div>
      <div className="storage-progress-bar">
        <div className="storage-progress-fill" style={{ width: `${percentage || 0}%` }}>
          <span className="storage-progress-label">{formatBytes(used)}</span>
        </div>
      </div>
    </div>
  );
};

export default StorageBar;