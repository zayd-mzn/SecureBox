import React from 'react';

const LoadingSpinner = ({ message = 'Loading...' }) => {
  return (
    <div className="loading-state">
      <i className="fas fa-spinner fa-spin"></i>
      <p>{message}</p>
    </div>
  );
};

export default LoadingSpinner;