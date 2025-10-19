import { useState } from 'react';
import { Player } from '@lottiefiles/react-lottie-player';
import LGUNavbar from '../../../components/NavBar/LGU-Navbar';
import LGUSidebar from '../../../components/SideBar/LGU-Sidebar';
import developmentAnimation from '@/assets/animations/Software Development.json';
import '../../../components/SideBar/styles.css';

export default function LGUDashboard() {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDevelopmentOngoing, setIsDevelopmentOngoing] = useState(true);

  return (
    <div className="wrapper">
      <div className="navbar">
        <LGUNavbar />
      </div>
      <div className="layout">
        <LGUSidebar 
          isCollapsed={isSidebarCollapsed}
          toggleSidebar={() => setSidebarCollapsed(!isSidebarCollapsed)}
        />
        <div 
          className="main-content"
          style={{ 
            marginLeft: isSidebarCollapsed ? 80 : 300,
            width: isSidebarCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 300px)',
            transition: 'margin-left 0.3s, width 0.3s',
            overflow: 'hidden'
          }}
        >
          <div className="header-row">
            <h2 className="page-title">Settings</h2>
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