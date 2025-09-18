import { useState, useEffect } from 'react';
import axios from '../../axios/axiosInstance';
import './styles.css';
import { Link } from 'react-router-dom';

export default function ADMINNavbar() {
  const [showSidebar, setShowSidebar] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [adminData, setAdminData] = useState(null);
  const [activeTab, setActiveTab] = useState('unread');

  const unreadNotifications = notifications.filter(notif => !notif.is_read);
  const readNotifications = notifications.filter(notif => notif.is_read);
  const unreadCount = unreadNotifications.length;

  const handleOutsideClick = () => {
    setShowSidebar(false);
  };

  const toggleSidebar = () => {
    setShowSidebar(prev => !prev);
  };

  useEffect(() => {
    const adminDataRaw = localStorage.getItem('adminInfo');
    if (adminDataRaw) {
      try {
        const parsed = JSON.parse(adminDataRaw);
        setAdminData(parsed);
      } catch {
        console.error('Failed to parse adminInfo from localStorage');
      }
    }
  }, []);

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';

    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    hours = hours ? hours : 12;

    return `${mm}/${dd}/${yyyy} | ${hours}:${minutes} ${ampm}`;
  };

  const markNotificationAsRead = async (id) => {
    if (!adminData) return;

    const first_name = adminData.first_name || adminData.firstName || '';
    const last_name = adminData.last_name || adminData.lastName || '';

    try {
      await axios.put(`/api/admin/admin-accounts/${id}/mark-read`, {
        first_name,
        last_name,
      });

      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === id
            ? {
                ...notif,
                is_read: true,
                read_by: `${first_name} ${last_name}`,
                read_at: new Date().toISOString(),
              }
            : notif
        )
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await axios.get('/api/admin/pending-accounts');
        const freshNotifications = response.data;

        const now = new Date();
        const filtered = freshNotifications.filter((notif) => {
          if (!notif.is_read || !notif.read_at) return true;

          const readAt = new Date(notif.read_at);
          const now = new Date();
          const diffMs = now - readAt;

          return diffMs <= 30 * 24 * 60 * 60 * 1000; // 30 days
        }); // 30 days × 24 hours × 60 minutes × 60 seconds × 1000 milliseconds

        setNotifications(filtered);
      } catch (error) {
        console.error('Error fetching notifications:', error.message);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="navbar">
        <Link to="/ADMINDashboard">
          <img src="/icons/logo.png" alt="Logo" className="logo" />
        </Link>
        <div className="center-content">
          <span className="location-text">ADMIN</span>
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

        <div className="notif-tabs">
          <button
            className={`notif-tab-btn ${activeTab === 'unread' ? 'active' : ''}`}
            onClick={() => setActiveTab('unread')}
          >
            Unread
            {unreadCount > 0 && (
              <span className="unread-badge">{unreadCount}</span>
            )}
          </button>
          <button
            className={`notif-tab-btn ${activeTab === 'read' ? 'active' : ''}`}
            onClick={() => setActiveTab('read')}
          >
            Read
          </button>
        </div>

        <div className="notification-wrapper">
          <div className={`notif-list ${
            (activeTab === 'unread' && unreadNotifications.length === 0) ||
            (activeTab === 'read' && readNotifications.length === 0)
              ? 'center-content'
              : ''
          }`}>
            {activeTab === 'unread' ? (
              unreadNotifications.length === 0 ? (
                <div className="no-notification-container">
                  <img className="alert" src="/icons/notification-alert.png" alt="No unread notifications" />
                  <h3 className="no-notifications">No unread notifications</h3>
                  <p className="subtitle-notifications">
                    We’ll let you know when there will be something to update you.
                  </p>
                </div>
              ) : (
                <ul className="notification-list">
                  {unreadNotifications.map((notif) => (
                  <li key={notif.id} className="notification-item">
                    <div className="notif-header">
                      <h4 className="notif-title">LGU Access Request</h4>
                      <span className="notif-timestamp">{formatDateTime(notif.created_at)}</span>
                    </div>

                    <div className="notif-content">
                      <p className="notif-body">
                        A new access request has been submitted by <strong>{notif.first_name} {notif.last_name}</strong>.
                        Please review and take the appropriate action.
                      </p>

                      <button
                        className="mark-read-btn"
                        onClick={() => markNotificationAsRead(notif.id)}
                        aria-label="Mark as read"
                      >
                        <span className="check-icon">✔✔</span>
                      </button>
                    </div>
                  </li>
                  ))}
                </ul>
              )
            ) : (
              readNotifications.length === 0 ? (
                <div className="no-notification-container">
                  <img className="alert" src="/icons/notification-alert.png" alt="No unread notifications" />
                  <h3 className="no-notifications">No read notifications</h3>
                  <p className="subtitle-notifications">
                    We’ll let you know when there will be something to update you.
                  </p>
                </div>
              ) : (
                <ul className="notification-list">
                  {readNotifications.map((notif) => (
                    <li key={notif.id} className="notification-item">
                      <div className="notif-header">
                        <h4 className="notif-title">LGU Access Request</h4>
                        <span className="notif-timestamp">{formatDateTime(notif.created_at)}</span>
                      </div>
                      <div className="notif-content">
                        <p className="notif-body">
                          A new access request has been submitted by <strong>{notif.first_name} {notif.last_name}</strong>.
                          Please review and take the appropriate action.
                        </p>
                      </div>
                        <p className="read-by">Read by {notif.read_by ?? 'Unknown'}</p>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
}
