import React from 'react';

const LoadingSpinner = () => {
  return (
    <div className="loading-screen">
      <div className="loading-spinner">
        <i className="fas fa-circle-notch fa-spin"></i>
      </div>
      <p>Loading...</p>
    </div>
  );
};

export default LoadingSpinner;