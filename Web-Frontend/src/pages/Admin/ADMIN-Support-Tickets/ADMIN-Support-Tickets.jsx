import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Player } from '@lottiefiles/react-lottie-player';
import ADMINNavbar from '../../../components/NavBar/ADMIN-Navbar';
import ADMINSidebar from '../../../components/SideBar/ADMIN-Sidebar';
import developmentAnimation from '@/assets/animations/Software Development.json';
import '../../../components/SideBar/styles.css';
import { motion } from 'framer-motion';

export default function ADMINBarangayReports() {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDevelopmentOngoing, setIsDevelopmentOngoing] = useState(true);

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
            overflow: 'hidden'
          }}
        >
          <div className="header-row">
            <h2 className="page-title">Customer Service</h2>
          </div>

{isDevelopmentOngoing && (
  <div className="development-container">
    <div className="animation-card">
      <div className="animation-content">
                <Player
          autoplay
          loop
          src={developmentAnimation}
          style={{
            width: 'clamp(250px, 50vw, 350px)',
            height: 'auto',
            maxWidth: '100%',
          }}
        />
        <h2 className="animation-title">Under Development</h2>
        <p className="animation-text">
          We're actively building this section to give you the best experience. Please check back soon.
        </p>

      </div>
    </div>
  </div>
)}

        </div>
      </div>
    </div>

  );
}
