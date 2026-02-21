import { useState, useEffect } from 'react';

const SuccessNotification = ({ message, isVisible, onClose }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className="success-notification">
      <div className="success-content">
        <span className="success-icon">✓</span>
        <span className="success-message">{message}</span>
      </div>
    </div>
  );
};

export default SuccessNotification;