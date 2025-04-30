// src/components/LoadingSpinner.jsx
import React from 'react';
import './LoadingSpinner.module.css'; // optional CSS

const LoadingSpinner = () => {
  return (
    <div className="spinner-container">
      <div className="spinner"></div>
    </div>
  );
};

export default LoadingSpinner;
