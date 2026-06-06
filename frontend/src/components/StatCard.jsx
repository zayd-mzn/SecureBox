import React from 'react';
import { formatNumber, formatBytes } from '../utils/formatters';

const StatCard = ({ icon, label, value, subtext, trend, color = 'blue' }) => {
  const getGradientClass = () => {
    const gradients = { blue: 'gradient-blue', green: 'gradient-green', purple: 'gradient-purple', orange: 'gradient-orange' };
    return gradients[color] || 'gradient-blue';
  };

  const formattedValue = typeof value === 'number' && value > 1000 ? formatNumber(value) : 
                         typeof value === 'number' ? formatBytes(value) : value;

  return (
    <div className={`stat-card ${getGradientClass()}`}>
      <div className="stat-icon-wrapper">
        <i className={`fas ${icon} stat-icon`}></i>
      </div>
      <div className="stat-content">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{formattedValue}</div>
        {subtext && <div className="stat-trend">{subtext}</div>}
        {trend && <div className="stat-trend positive"><i className="fas fa-arrow-up"></i><span>{trend}</span></div>}
      </div>
    </div>
  );
};

export default StatCard;