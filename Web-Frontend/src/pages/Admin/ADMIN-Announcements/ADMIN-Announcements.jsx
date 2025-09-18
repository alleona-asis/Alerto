import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ADMINNavbar from '../../../components/NavBar/ADMIN-Navbar';
import ADMINSidebar from '../../../components/SideBar/ADMIN-Sidebar';
import '../../../components/SideBar/styles.css';
import axios from '../../../axios/axiosInstance';

export default function ADMINBarangayReports() {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch announcements
  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const response = await axios.get('/api/admin/get-all-announcements'); // adjust path if needed
        setAnnouncements(response.data);
      } catch (error) {
        console.error('Error fetching announcements:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncements();
  }, []);

  // Helper to safely get image URLs
  const getImages = (announcement) => {
    let images = [];
    if (announcement.image_urls) {
      if (typeof announcement.image_urls === 'string') {
        try {
          images = JSON.parse(announcement.image_urls); // JSON string
        } catch {
          images = [announcement.image_urls]; // fallback single URL
        }
      } else if (Array.isArray(announcement.image_urls)) {
        images = announcement.image_urls; // already an array
      }
    }
    return images;
  };


  return (
    <div className="wrapper">
      <div className="navbar">
        <ADMINNavbar />
      </div>
      <div className="layout">
        <ADMINSidebar
          isCollapsed={isSidebarCollapsed}
          toggleSidebar={() => setSidebarCollapsed(!isSidebarCollapsed)}
        />
        <div
          className="main-content"
          style={{
            marginLeft: isSidebarCollapsed ? 80 : 270,
            width: isSidebarCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 270px)',
            transition: 'margin-left 0.3s, width 0.3s',
            overflowY: 'auto',
            height: 'calc(100vh - <navbarHeight>)'
          }}
        >
          <div className="header-row">
            <h2 className="page-title">Announcements</h2>
          </div>

          {loading ? (
            <p>Loading announcements...</p>
          ) : (
            <div
              className="announcements-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: '20px',
              }}
            >
{announcements.map((announcement) => {
  const images = getImages(announcement);
  const firstImage = images.length > 0 ? images[0] : '/icons/announcement.png'; // fallback

  return (
    <div
      key={announcement.id}
      className="announcement-card"
      style={{
        border: '1px solid #ccc',
        borderRadius: '8px',
        padding: '15px',
        backgroundColor: '#fff',
        boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <img
        src={firstImage}
        alt={`Announcement ${announcement.id}`}
        style={{
          width: '100%',
          maxHeight: '150px',
          objectFit: 'cover',
          marginBottom: '10px',
          borderRadius: '5px',
        }}
      />
      <h3 style={{ fontSize: '16px', marginBottom: '10px', color: '#374856' }}>
        {announcement.title}
      </h3>
      <p
        style={{
          fontSize: '14px',
          color: '#555',
          maxHeight: '60px', // adjust as needed
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 3, // limits to 3 lines
          WebkitBoxOrient: 'vertical',
          marginBottom: '10px',
        }}
      >
        {announcement.text}
      </p>
      <p style={{ fontSize: '12px', color: '#888', marginTop: 'auto' }}>
        {new Date(announcement.created_at).toLocaleDateString()}
      </p>
    </div>
  );
})}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
