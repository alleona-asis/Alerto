import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from '../../axios/axiosInstance';
import './styles.css';
import { FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';

export default function BRGYSidebar({ isCollapsed, toggleSidebar }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [last_name, setLastName] = useState('');
  const [first_name, setFirstName] = useState('');
  const [position, setPosition] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

useEffect(() => {
  const userId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');

  if (!userId || !token) {
    setError('Missing authentication info.');
    setLoading(false);
    return;
  }

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`/api/auth/barangay-staff-profile/${userId}`);

      const data = res.data;
      if (Array.isArray(data) && data.length > 0) {
        const profile = data[0];
        setLastName(profile.last_name || 'Unknown');
        setFirstName(profile.first_name || 'Unknown');
        setPosition(profile.position || 'Unknown');
      } else {
        setError('No profile data found.');
      }
    } catch (err) {
      setError('Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  fetchProfile();
}, []);


  const menuItems = [
    {
        label: 'Dashboard',
        icon: '/icons/home-dashboard.png',
        path: '/BRGYDashboard',
        isActive: pathname === '/BRGYDashboard' || pathname === '/admin',
    },
    {
        label: 'Mobile Users',
        icon: '/icons/mobile-user.png',
        path: '/barangay/mobile-users',
        isActive: pathname === '/barangay/mobile-users',
    },
    {
        label: 'Barangay Reports',
        icon: '/icons/Reports.png',
        path: '/barangay/barangay-reports',
        isActive: pathname === '/barangay/barangay-reports',
    },
    {
        label: 'Document Requests',
        icon: '/icons/Requests.png',
        path: '/barangay/document-requests',
        isActive: pathname === '/barangay/document-requests',
    },
    {
        label: 'Announcements',
        icon: '/icons/announcements.png',
        path: '/barangay/announcements',
        isActive: pathname === '/barangay/announcements',
    },
  ];

  const handleLogout = () => {
    console.log('🚪 [BRGYSidebar] Logging out...');
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userId');
    window.location.href = '/';
  };

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : 'expanded'}`}>
      <button
        onClick={toggleSidebar}
        className={isCollapsed ? 'menu-button' : 'close-button'}
      >
        {isCollapsed ? <FiChevronsRight size={24} /> : <FiChevronsLeft size={24} />}
      </button>

        {!isCollapsed && (
        <div className="profile-box">
            <div className="avatar"></div>
            <div>
            <span className="name">{last_name}, {first_name}</span>
            <div className="role">{position}</div>
            </div>
        </div>
        )}


        <div className="menu-section">
            {!isCollapsed && <p className="menu-title">Menu</p>}
            {menuItems.map(({ label, icon, path }) => {
            const isActive = pathname === path;

            return (
                <div
                key={label}
                className={`menu-item ${isActive ? 'active' : ''}`}
                style={{ justifyContent: isCollapsed ? 'center' : 'flex-start' }}
                onClick={(e) => {
                    e.stopPropagation();
                    navigate(path);
                }}
                title={isCollapsed ? label : undefined}
                >
                <img src={icon} alt={label} className="icon" />
                {!isCollapsed && <span className="label">{label}</span>}
                </div>
            );
            })}
        </div>

        <div className="menu-section support-section">
            {!isCollapsed && <p className="menu-title">Support</p>}

            <div
                className="menu-item"
                onClick={() => navigate('/barangay/support-tickets', '_blank')}
                >
                <img src="/icons/help-center.png" alt="Settings" className="icon" />
                {!isCollapsed && <span>Support Tickets</span>}
            </div>

            <div
                className="menu-item"
                onClick={() => navigate('/barangay/settings', '_blank')}
                >
                <img src="/icons/settings.png" alt="Settings" className="icon" />
                {!isCollapsed && <span>Settings</span>}
            </div>

            <div className="menu-item" onClick={handleLogout}>
                <img src="/icons/logout.png" alt="Logout" className="icon" />
                {!isCollapsed && <span>Logout</span>}
            </div>
        </div>


    </div>
  );
}
