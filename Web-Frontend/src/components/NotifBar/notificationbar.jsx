import React, { useEffect, useState } from 'react';
import './styles.css';

const NotificationBar = ({ message, type, duration = 4000, onClose }) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const percent = Math.max(100 - (elapsed / duration) * 100, 0);
      setProgress(percent);
      if (percent === 0) {
        clearInterval(interval);
        if (onClose) onClose();
      }
    }, 30);

    return () => clearInterval(interval);
  }, [duration, onClose]);

  return (
    <div className={`notification-bar ${type}`}>
      <span>{message}</span>
      <div className="progress-bar" style={{ width: `${progress}%` }} />
    </div>
  );
};

export default NotificationBar;
