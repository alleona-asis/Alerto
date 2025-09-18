import { useState, useEffect, useCallback } from 'react';
import axios from '../../axios/axiosInstance';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import './styles.css';
//import 'react-toastify/dist/ReactToastify.css';

export default function BRGYNavbar() {
  const [showSidebar, setShowSidebar] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('unread');
  const [BRGYProfile, setBRGYProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const userId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');

  // ---------------- Helper Functions ----------------
  const capitalizeWords = str =>
    str?.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) || '';

  const formatDateTime = dateString => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${mm}/${dd}/${yyyy} | ${hours}:${minutes} ${ampm}`;
  };

  const toggleSidebar = () => setShowSidebar(prev => !prev);

  // ---------------- Fetch Barangay Profile ----------------
  useEffect(() => {
    if (!userId || !token) {
      setError('User not logged in.');
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const res = await axios.get(`/api/auth/barangay-staff-profile/${userId}`);
        const data = Array.isArray(res.data) ? res.data[0] || null : res.data;
        setBRGYProfile(data);
        if (!data) setError('No profile found.');
      } catch {
        setError('Failed to load profile.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId, token]);

  // ---------------- Restore Notifications from LocalStorage ----------------
  useEffect(() => {
    if (!BRGYProfile) return;
    const saved = JSON.parse(localStorage.getItem('notifications') || '[]');
    const filtered = saved.filter(n =>
      n.region === BRGYProfile.region &&
      n.province === BRGYProfile.province &&
      n.city === BRGYProfile.city &&
      n.barangay === BRGYProfile.barangay
    );
    setNotifications(filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  }, [BRGYProfile]);

// ---------------- Fetch Notifications from Backend ----------------
useEffect(() => {
  if (!BRGYProfile) return;

  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`/api/brgy/notifications`, {
        params: {
          region: BRGYProfile.region,
          province: BRGYProfile.province,
          city: BRGYProfile.city,
          barangay: BRGYProfile.barangay
        }
      });

const notifData = res.data.notifications.map(n => {

  return {
    ...n,
    type: n.type ?? (
      n.status === 'pending' || n.status === 'unverified'
        ? 'verificationRequest'
        : n.type === 'newBarangayReport'
          ? 'newBarangayReport'
          : 'mobileRegistered'
    ),
    created_at: n.created_at ? new Date(n.created_at).toISOString() : new Date().toISOString(),
    is_read: n.is_read ?? false,
    read_by: n.read_by || null,
    read_at: n.read_at || null,
    reported_by: n.first_name && n.last_name ? `${n.first_name} ${n.last_name}` : '',
    incident_type: n.incident_type || ''  // <-- keeps whatever backend sends
  };
});


      // Merge with existing notifications in localStorage
      const localSaved = JSON.parse(localStorage.getItem('notifications') || '[]');

      const merged = notifData.concat(
        localSaved.filter(localNotif => !notifData.some(n => n.id === localNotif.id))
      );

      const sorted = merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      localStorage.setItem('notifications', JSON.stringify(sorted));
      setNotifications(sorted);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  fetchNotifications();
}, [BRGYProfile]);




  // ---------------- Mark Notification as Read ----------------
const markNotificationAsRead = async (id) => {
  if (!id) {
    console.error('❌ Cannot mark notification as read: ID is missing');
    return;
  }
  if (!BRGYProfile?.first_name || !BRGYProfile?.last_name) {
    console.error("❌ Missing staff first_name / last_name in BRGYProfile");
    return;
  }

  try {
    await axios.put(`/api/brgy/notifications/${id}/mark-read`, {
      first_name: BRGYProfile.first_name,
      last_name: BRGYProfile.last_name
    });

    setNotifications(prev =>
      prev.map(n =>
        n.id === id
          ? {
              ...n,
              is_read: true,
              read_by: `${BRGYProfile.first_name} ${BRGYProfile.last_name}`,
              read_at: new Date().toISOString()
            }
          : n
      )
    );
  } catch (err) {
    console.error("❌ Failed to mark as read:", err.response?.data || err.message);
  }
};


// ---------------- Socket Connection ----------------
useEffect(() => {
  if (!BRGYProfile) return;

  const socket = io('http://192.168.1.2:5000');

  const refreshNotifications = async () => {
    try {
      const res = await axios.get(`/api/brgy/notifications`, {
        params: {
          region: BRGYProfile.region,
          province: BRGYProfile.province,
          city: BRGYProfile.city,
          barangay: BRGYProfile.barangay
        }
      });

      
    const notifData = res.data.notifications.map(n => {

    return {
      ...n,
      type: n.type ?? (
        n.status === 'pending' || n.status === 'unverified'
          ? 'verificationRequest'
          : n.type === 'newBarangayReport'
            ? 'newBarangayReport'
            : n.type === 'newDocumentRequest'
              ? 'newDocumentRequest'
              : 'mobileRegistered'
      ),
      created_at: n.created_at ? new Date(n.created_at).toISOString() : new Date().toISOString(),
      is_read: n.is_read ?? false,
      read_by: n.read_by || null,
      read_at: n.read_at || null,
      reported_by: n.first_name && n.last_name ? `${n.first_name} ${n.last_name}` : '',
      incident_type: n.incident_type || ''
    };
  });


      const sorted = notifData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      localStorage.setItem('notifications', JSON.stringify(sorted));
      setNotifications(sorted);

    } catch (err) {
      console.error("❌ Failed to refresh notifications:", err);
    }
  };


  socket.on('connect', () => console.log('🔌 Connected to socket server'));
  
  socket.on('mobileUserRegistered', refreshNotifications);
  socket.on('newVerificationRequest', refreshNotifications);
  socket.on('newBarangayReport', refreshNotifications);
  socket.on('newDocumentRequest', refreshNotifications);


  return () => {
    socket.disconnect();
    console.log('🔌 Disconnected from socket server');
  };
}, [BRGYProfile]);




// ---------------- Cleanup Old Notifications ---------------- //
useEffect(() => {
  const interval = setInterval(() => {
    setNotifications(prev => {
      const now = new Date();

      const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000; // FIVE_MINUTES = 5 * 60 * 1000
      const expired = prev.filter(
        n => n.is_read && (now - new Date(n.read_at)) > THIRTY_DAYS
      );

      // delete expired notifications from DB
      expired.forEach(async notif => {
        try {
          await axios.delete(`/api/brgy/notifications/${notif.id}`);
          console.log(`🗑 Deleted notification ${notif.id} from DB`);
        } catch (err) {
          console.error(`❌ Failed to delete notification ${notif.id}`, err);
        }
      });

      // keep unread + valid read notifications
      const filtered = prev.filter(
        n => !n.is_read || (now - new Date(n.read_at)) <= 5 * 60 * 1000
      );

      localStorage.setItem('notifications', JSON.stringify(filtered));
      return filtered;
    });
  }, 1000); // check every 10s

  return () => clearInterval(interval);
}, []);



  // ---------------- Derived State ----------------
  const unreadNotifications = notifications.filter(n => !n.is_read);
  const readNotifications = notifications.filter(n => n.is_read);
  const unreadCount = unreadNotifications.length;

  // ---------------- Render ----------------
  return (
    <>
      <div className="navbar">
        <Link to="/BRGYDashboard"><img src="/icons/logo.png" alt="Logo" className="logo" /></Link>

        <div className="center-content">
          {loading && <span className="location-text">Loading...</span>}
          {error && <span className="location-text">{error}</span>}
          {!loading && !error && BRGYProfile && (
            <div className="location-text" style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#37474f', marginBottom: '5px' }}>
                Barangay {capitalizeWords(BRGYProfile.barangay)}
              </div>
              <div style={{ fontSize: '14px', color: '#8696BB' }}>
                {capitalizeWords(BRGYProfile.city)}, {capitalizeWords(BRGYProfile.province)}, {capitalizeWords(BRGYProfile.region)}
              </div>
            </div>
          )}
        </div>

        <div className="bell-icon" onClick={toggleSidebar} role="button" tabIndex={0} aria-label="Toggle notifications sidebar">
          <img src="/icons/notification.png" alt="Notifications" className="icon-bell-button" />
          {unreadCount > 0 && <span className="notification-count" aria-live="polite">{unreadCount}</span>}
        </div>
      </div>

      {showSidebar && <div className={`notification-overlay ${showSidebar ? 'open' : ''}`} onClick={toggleSidebar} />}

      <div className={`notification-sidebar ${showSidebar ? 'open' : ''}`}>
        <h3 className="sidebar-title">Notifications</h3>
        <p className="sidebar-subtitle">Notifications sent to this inbox can be viewed for up to 30 days.</p>

        <div className="notif-tabs">
          <button className={`notif-tab-btn ${activeTab === 'unread' ? 'active' : ''}`} onClick={() => setActiveTab('unread')}>
            Unread {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
          </button>
          <button className={`notif-tab-btn ${activeTab === 'read' ? 'active' : ''}`} onClick={() => setActiveTab('read')}>Read</button>
        </div>
        <div className="notification-wrapper">
          <div className="notif-list" style={{ width: '100%' }}>
            {(activeTab === 'unread' ? unreadNotifications : readNotifications).length === 0 ? (
              <div className="no-notification-container">
                <img className="alert" src="/icons/notification-alert.png" alt="No notifications" />
                <h3 className="no-notifications">{activeTab === 'unread' ? 'No unread notifications' : 'No read notifications'}</h3>
                <p className="subtitle-notifications">We’ll let you know when there will be something to update you.</p>
              </div>
            ) : (
              <ul className="notification-list">
                {(activeTab === 'unread' ? unreadNotifications : readNotifications).map(notif => (
                  <li
                    key={`${notif.id}-${notif.type}-${notif.created_at}`}
                    className="notification-item"
                  >
                    <div className="notif-header">
                      <h4 className="notif-title">
                        {notif.type === 'mobileRegistered' 
                          ? 'New User Registration'
                          : notif.type === 'verificationRequest'
                            ? 'Pending Verification Request'
                            : notif.type === 'newDocumentRequest'
                              ? 'New Document Request'
                              : 'New Barangay Report'}
                      </h4>
                      <span className="notif-timestamp">{formatDateTime(notif.created_at)}</span>
                    </div>

                    <div className="notif-content">
                      <p className="notif-body">
                        {notif.type === 'mobileRegistered'
                          ? <span><strong>{notif.first_name} {notif.last_name}</strong> has registered.</span>
                          : notif.type === 'verificationRequest'
                            ? <span><strong>{notif.first_name} {notif.last_name}</strong> has submitted a verification request.</span>
                            : notif.type === 'newDocumentRequest'
                              ? <span><strong>{notif.reported_by}</strong> has submitted a new document request. Please review the details promptly.</span>
                              : <span><strong>{notif.reported_by}</strong> has submitted a new report regarding <strong>{notif.incident_type}</strong>. Please review the details promptly.</span>
                        }
                      </p>
                      {activeTab === 'unread' && (
                        <button
                          className="mark-read-btn"
                          onClick={() => markNotificationAsRead(notif.id)}
                        >
                          ✔✔
                        </button>
                      )}
                      {/*
                      {activeTab === 'read' && (
                        <p className="read-by">Read by {notif.read_by ?? 'Unknown'}</p>
                      )}
                      */}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
