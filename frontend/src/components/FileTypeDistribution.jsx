import React from 'react';
import { formatNumber, formatBytes } from '../utils/formatters';

const FileTypeDistribution = ({ data }) => {
  if (!data) return null;

  return (
    <div className="card file-distribution">
      <div className="card-header">
        <h2><i className="fas fa-chart-bar"></i> File Type Distribution</h2>
      </div>
      <div className="distribution-list">
        {data.map((type, idx) => (
          <div key={idx} className="distribution-item">
            <div className="dist-item-header">
              <div className="dist-item-info">
                <i className={`fas fa-file dist-item-icon`} style={{ color: type.color }}></i>
                <div>
                  <div className="dist-item-name">{type.type}</div>
                  <div className="dist-item-meta">{formatNumber(type.count)} files</div>
                </div>
              </div>
              <div className={`dist-item-trend ${type.trendUp ? 'positive' : 'negative'}`}>
                <i className={`fas fa-arrow-${type.trendUp ? 'up' : 'down'}`}></i>
                {type.trend}
              </div>
            </div>
            <div className="dist-progress-bar">
              <div className="dist-progress-fill" style={{ width: `${type.percentage}%`, background: type.color }}></div>
            </div>
            <div className="dist-item-footer">{type.percentage}% of total files</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileTypeDistribution;