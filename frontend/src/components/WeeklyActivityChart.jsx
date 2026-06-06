import React from 'react';

const WeeklyActivityChart = ({ uploads, downloads }) => {
  if (!uploads || !downloads) return null;

  const getMaxValue = () => Math.max(...uploads, ...downloads);

  return (
    <div className="card activity-chart">
      <div className="card-header">
        <h2><i className="fas fa-chart-area"></i> Weekly Activity Trends</h2>
        <div className="chart-legend">
          <span className="legend-item"><span className="legend-dot upload"></span>Uploads</span>
          <span className="legend-item"><span className="legend-dot download"></span>Downloads</span>
        </div>
      </div>
      <div className="chart-container">
        <div className="chart-grid">
          {uploads.map((uploadValue, idx) => {
            const downloadValue = downloads[idx];
            const maxValue = getMaxValue();
            return (
              <div key={idx} className="chart-column">
                <div className="chart-bars">
                  <div className="chart-bar upload-bar" style={{ height: `${(uploadValue / maxValue) * 150}px` }}>
                    <span className="bar-value">{uploadValue}</span>
                  </div>
                  <div className="chart-bar download-bar" style={{ height: `${(downloadValue / maxValue) * 150}px` }}>
                    <span className="bar-value">{downloadValue}</span>
                  </div>
                </div>
                <div className="chart-label">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][idx]}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WeeklyActivityChart;