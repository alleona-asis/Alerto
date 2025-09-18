import { useState, useEffect } from 'react';
import axios from '../../axios/axiosInstance';
import './styles.css';
import { Link } from 'react-router-dom';

export default function LGUNavbar() {
  const [showSidebar, setShowSidebar] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [adminData, setAdminData] = useState(null);
  const [activeTab, setActiveTab] = useState('unread');

  const unreadNotifications = notifications.filter(notif => !notif.is_read);
  const readNotifications = notifications.filter(notif => notif.is_read);
  const unreadCount = unreadNotifications.length;

  const [LGUProfile, setLGUProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const userId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');  

  const capitalizeWords = (str) =>
    str?.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) || '';

    const handleOutsideClick = () => {
    setShowSidebar(false);
    };

  const toggleSidebar = () => {
    setShowSidebar(prev => !prev);
  };

  // ================== Fetch Profile ================== //
  useEffect(() => {
    if (!userId || !token) {
      setError('User not logged in.');
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await axios.get(`/api/auth/lgu-admin-profile/${userId}`);
        setLGUProfile(response.data);
      } catch (error) {
        console.error('Failed to fetch profile:', error);
        setError('Failed to load profile.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId, token]);


  return (
    <>
      <div className="navbar">
        <Link to="/LGUDashboard">
          <img src="/icons/logo.png" alt="Logo" className="logo" />
        </Link>
        <div className="center-content">
          {loading && <span className="location-text">Loading...</span>}
          {error && <span className="location-text">{error}</span>}
          {!loading && !error && LGUProfile && (
            <span className="location-text">
              {capitalizeWords(LGUProfile.city)},&nbsp;
              {capitalizeWords(LGUProfile.province)},&nbsp;
              {capitalizeWords(LGUProfile.region)}
            </span>
          )}
        </div>
        <div
          className="bell-icon"
          onClick={toggleSidebar}
          role="button"
          tabIndex={0}
          aria-label="Toggle notifications sidebar"
        >
          <img src="/icons/notification.png" alt="Notifications" className="icon-bell-button" />
          {unreadCount > 0 && (
            <span className="notification-count" aria-live="polite">
              {unreadCount}
            </span>
          )}
        </div>
      </div>

      {showSidebar && <div className={`notification-overlay ${showSidebar ? 'open' : ''}`} onClick={handleOutsideClick} />}

      <div className={`notification-sidebar ${showSidebar ? 'open' : ''}`}>
        <h3 className="sidebar-title">Notifications</h3>
        <p className="sidebar-subtitle">
          Notifications sent to this inbox can be viewed for up to 30 days.
        </p>
      </div>
    </>
  );
}
