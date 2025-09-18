import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
document.body.style.overflow = 'hidden';
import 'leaflet/dist/leaflet.css';


// Pages
import Login from './pages/Authentication/login';
import ADMINDashboard from './pages/Admin/ADMIN-Dashboard/ADMIN-Dashboard';
import LGUDashboard from './pages/LGU/LGU-Dashboard/LGU-Dashboard';
import BRGYDashboard from './pages/Barangay/BRGY-Dashboard/BRGY-Dashboard';

// Super Admin
import LGUAccessRequests from './pages/Admin/ADMIN-LGU-Access-Requests/ADMIN-LGU-Access-Requests';
import AllBarangayReports from './pages/Admin/ADMIN-Barangay-Reports/ADMIN-Barangay-Reports';
import AllDocumentRequests from './pages/Admin/ADMIN-Document-Requests/ADMIN-Document-Requests';
import AllAnnouncements from './pages/Admin/ADMIN-Announcements/ADMIN-Announcements';
import ADMINSupportTickets from './pages/Admin/ADMIN-Support-Tickets/ADMIN-Support-Tickets';
import ADMINSettings from './pages/Admin/ADMIN-Settings/ADMIN-Settings';
import ADMINMobileUsers from './pages/Admin/ADMIN-Mobile-Users/ADMIN-Mobile-Users';

// Local Government Unit
import ManageBarangay from './pages/LGU/LGU-Manage-Barangay/LGU-Manage-Barangay';
import LGUBarangayReports from './pages/LGU/LGU-Barangay-Reports/LGU-Barangay-Reports';
import LGUDocumentRequests from './pages/LGU/LGU-Document-Requests/LGU-Document-Requests';
import LGUAnnouncements from './pages/LGU/LGU-Announcements/LGU-Announcement';
import LGUSupportTickets from './pages/LGU/LGU-Support-Tickets/LGU-Support-Tickets';
import LGUSettings from './pages/LGU/LGU-Settings/LGU-Settings';

// Barangay
import MobileUserRegistry from './pages/Barangay/BRGY-Mobile-Users/BRGY-Mobile-Users';
import BRGYBarangayReport from './pages/Barangay/BRGY-Barangay-Reports/BRGY-Barangay-Reports';
import BRGYDocumentRequests from './pages/Barangay/BRGY-Document-Requests/BRGY-Document-Requests';
import BRGYAnnouncements from './pages/Barangay/BRGY-Announcements/BRGY-Announcements';
import BRGYSupportTickets from './pages/Barangay/BRGY-Support-Tickets/BRGY-Support-Tickets';
import BRGYSettings from './pages/Barangay/BRGY-Settings/BRGY-Settings';

function AppRoutes({ token, role }) {
  const location = useLocation();

  // Redirect to role-specific dashboard on root path
  function DashboardRedirect() {
    const path = window.location.pathname;
    console.log('🚦 Redirecting from root path:', path);

    switch (role) {
      case 'super admin':
        console.log('Redirecting to ADMIN Dashboard');
        return path !== '/ADMINDashboard' ? <Navigate to="/ADMINDashboard" /> : null;
      case 'local government unit':
        console.log('Redirecting to LGU Dashboard');
        return path !== '/LGUDashboard' ? <Navigate to="/LGUDashboard" /> : null;
      case 'barangay':
        console.log('Redirecting to BARANGAY Dashboard');
        return path !== '/BRGYDashboard' ? <Navigate to="/BRGYDashboard" /> : null;
      default:
        console.log('Unknown role or not logged in. Redirecting to login');
        return <Navigate to="/login" />;
    }
  }

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={token ? <DashboardRedirect /> : <Navigate to="/login" />}
        />

        {/* Super Admin Routes */}
        {token && role === 'super admin' && (
          <>
            <Route path="/ADMINDashboard" element={<ADMINDashboard />} />
            <Route path="/admin/lgu-approval-requests" element={<LGUAccessRequests />} />
            <Route path="/admin/all-barangay-reports" element={<AllBarangayReports />} />
            <Route path="/admin/all-document-requests" element={<AllDocumentRequests />} />
            <Route path="/admin/all-announcements" element={<AllAnnouncements />} />
            <Route path="/admin/support-tickets" element={<ADMINSupportTickets />} />
            <Route path="/admin/settings" element={<ADMINSettings />} />
            <Route path="/admin/mobile-users" element={<ADMINMobileUsers />} />
          </>
        )}

        {/* LGU Admin Routes */}
        {token && role === 'local government unit' && (
          <>
            <Route path="/LGUDashboard" element={<LGUDashboard />} />
            <Route path="/lgu/Manage-Barangay" element={<ManageBarangay />} />
            <Route path="/lgu/barangay-reports" element={<LGUBarangayReports />} />
            <Route path="/lgu/document-requests" element={<LGUDocumentRequests />} />
            <Route path="/lgu/announcements" element={<LGUAnnouncements />} />
            <Route path="/lgu/support-tickets" element={<LGUSupportTickets />} />
            <Route path="/lgu/settings" element={<LGUSettings />} />
          </>
        )}

        {/* Barangay Staff Routes */}
        {token && role === 'barangay' && (
          <>
            <Route path="/BRGYDashboard" element={<BRGYDashboard />} />
            <Route path="/barangay/mobile-users" element={<MobileUserRegistry />} />
            <Route path="/barangay/barangay-reports" element={<BRGYBarangayReport />} />
            <Route path="/barangay/document-requests" element={<BRGYDocumentRequests />} />
            <Route path="/barangay/announcements" element={<BRGYAnnouncements />} />
            <Route path="/barangay/support-tickets" element={<BRGYSupportTickets />} />
            <Route path="/barangay/settings" element={<BRGYSettings />} />
          </>
        )}

        {/* Catch-all route */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [role, setRole] = useState(localStorage.getItem('role')?.toLowerCase());
  const [notification, setNotification] = useState(null); // { message, type }

  //console.log('Current Token:', token);
  console.log('Current Role:', role);

  // Sync state with localStorage changes (e.g., logout from another tab)
  useEffect(() => {
    const syncAuth = (e) => {
      if (e.key === 'token' || e.key === 'role') {
        const newToken = localStorage.getItem('token');
        const newRole = localStorage.getItem('role');
        //console.log('Storage change detected:', e.key);
        //console.log('New Token:', newToken);
        //console.log('New Role:', newRole);
        setToken(newToken);
        setRole(newRole);
      }
    };

    window.addEventListener('storage', syncAuth);
    return () => window.removeEventListener('storage', syncAuth);
  }, []);

  return (
    <Router>
      <AppRoutes token={token} role={role} />
    </Router>
  );
}

export default App;
