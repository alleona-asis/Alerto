import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from '../../axios/axiosInstance';
import './styles.css';
import { FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';

export default function LGUSidebar({ isCollapsed, toggleSidebar }) {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    const [lastName, setLastName] = useState('');
    const [firstName, setFirstName] = useState('');
    const [position, setPosition] = useState('Admin');

    useEffect(() => {
        console.log('User ID:', localStorage.getItem('userId'));

        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('token');

        if (!userId || !token) return;

        const fetchProfile = async () => {
        try {
            const res = await axios.get(`/api/auth/lgu-admin-profile/${userId}`);
            console.log('Profile Data:', res.data);

            const { last_name, first_name, position } = res.data || {};

            setLastName(last_name || 'Unknown');
            setFirstName(first_name || 'Unknown');
            setPosition(position || 'Super Admin');
        } catch (error) {
            console.error('Failed to fetch representative name:', error?.response?.data || error.message);
            setLastName('Unknown');
            setFirstName('Unknown');
            setPosition('Unknown');
        }
        };

        fetchProfile();
    }, []);

    const menuItems = [
        {
            label: 'Dashboard',
            icon: '/icons/home-dashboard.png',
            path: '/LGUDashboard',
            isActive: pathname === '/LGUDashboard' || pathname === '/admin',
        },
        {
            label: 'Manage Barangay',
            icon: '/icons/manage-lgu.png',
            path: '/lgu/manage-barangay',
            isActive: pathname === '/lgu/manage-barangay',
        },
        {
            label: 'Barangay Reports',
            icon: '/icons/Reports.png',
            path: '/lgu/barangay-reports',
            isActive: pathname === '/lgu/barangay-reports',
        },
        {
            label: 'Document Requests',
            icon: '/icons/Requests.png',
            path: '/lgu/document-requests',
            isActive: pathname === '/lgu/document-requests',
        },
        {
            label: 'Announcements',
            icon: '/icons/announcements.png',
            path: '/lgu/announcements',
            isActive: pathname === '/lgu/announcements',
        },
    ];

    // =================================================
    // LOGOUT FUNCTION
    // =================================================
    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
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
            <span className="name">{lastName}, {firstName}</span>
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
                onClick={() => navigate('/lgu/support-tickets', '_blank')}
                >
                <img src="/icons/help-center.png" alt="Settings" className="icon" />
                {!isCollapsed && <span>Support Tickets</span>}
            </div>

            <div
                className="menu-item"
                onClick={() => navigate('/lgu/settings', '_blank')}
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
