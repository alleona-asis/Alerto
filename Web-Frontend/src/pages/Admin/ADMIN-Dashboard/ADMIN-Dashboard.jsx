import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Player } from '@lottiefiles/react-lottie-player';
import ADMINNavbar from '../../../components/NavBar/ADMIN-Navbar';
import ADMINSidebar from '../../../components/SideBar/ADMIN-Sidebar';
import '../../../components/SideBar/styles.css';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';
import axios from '../../../axios/axiosInstance';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import ActsoflasciviousnessIcon from "@/assets/pins/Acts-of-lasciviousness.png";
import AnimalIssuesIcon from "@/assets/pins/Animal-Issues.png";
import BlockedDrainageIcon from "@/assets/pins/Blocked-Drainage.png";
import BrokenstreetlightIcon from '@/assets/pins/Broken-streetlight.png';
import DomesticIcon from '@/assets/pins/Domestic.png';
import FloodingIcon from '@/assets/pins/Flooding.png';
import GarbageIcon from '@/assets/pins/Garbage.png';
import IllegalgamblingIcon from '@/assets/pins/Illegal-gambling.png';
import IllegalParkingIcon from '@/assets/pins/Illegal-Parking.png';
import MaliciousmischiefIcon from '@/assets/pins/Malicious-mischief.png';
import MissingpersonIcon from '@/assets/pins/Missing-person.png';
import MonetaryIssuesIcon from '@/assets/pins/Monetary-Issues.png';
import NeighborconflictsIcon from '@/assets/pins/Neighbor-conflicts.png';
import NoiseIcon from '@/assets/pins/Noise.png';
import otherIcon from '@/assets/pins/other.png';
import PhysicalinjuriesIcon from '@/assets/pins/Physical-injuries.png';
import PotholeIcon from '@/assets/pins/Pothole.png';
import StagnantwaterIcon from '@/assets/pins/Stagnant-water.png';
import SuspeciouspersonreportIcon from '@/assets/pins/Suspecious-person-report.png';
import SuspiciousIcon from '@/assets/pins/Suspicious.png';
import TheftIcon from '@/assets/pins/Theft.png';
import VehicularaccidentsIcon from '@/assets/pins/Vehicular-accidents.png';



export default function ADMINDashboard() {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [totalReports, setTotalReports] = useState(0);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [totalMobileUsers, setTotalMobileUsers] = useState(0);
  const [totalAnnouncements, setTotalAnnouncements] = useState(0);
  const [totalLGUAccounts, setTotalLGUAccounts] = useState(0);

  const [mobileUsersGraph, setMobileUsersGraph] = useState([]);
  const [barangayReportsGraph, setBarangayReportsGraph] = useState([]);
  const [documentRequestsGraph, setDocumentRequestsGraph] = useState([]);
  const [lguAccountsGraph, setLguAccountsGraph] = useState([]);
  const [pins, setPins] = useState([]);

  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [selectedPin, setSelectedPin] = useState(null);




  // Map incident type to icons
  const pinIcons = {
    'Garbage': GarbageIcon,
    'Stagnant water': StagnantwaterIcon,
    'Noise': NoiseIcon,
    'Monetary Issues': MonetaryIssuesIcon,
    'Theft / Robbery': TheftIcon,
    'Suspicious Activity ': SuspiciousIcon,
    'Loitering / Suspicious person report': SuspeciouspersonreportIcon,
    'Domestic Violence': DomesticIcon,
    'Acts of lasciviousness': ActsoflasciviousnessIcon,
    'Physical injuries': PhysicalinjuriesIcon,
    'Vehicular accidents': VehicularaccidentsIcon,
    'Missing Persons': MissingpersonIcon,
    'Malicious Mischief ': MaliciousmischiefIcon,
    'Illegal Gatherings / Gambling': IllegalgamblingIcon,
    'Animal issues': AnimalIssuesIcon,
    'Neighbor Conflicts': NeighborconflictsIcon,
    'Broken streetlight': BrokenstreetlightIcon,
    'Pothole': PotholeIcon,
    'Flooding': FloodingIcon,
    'Blocked Drainage': BlockedDrainageIcon,
    'Abandoned Vehicles / Illegal Parking': IllegalParkingIcon,
    'Any other barangay-relevant concern': otherIcon,
    'Other': otherIcon,
    'other': otherIcon
  };

  const getPinIcon = (type) => {
    const iconUrl = pinIcons[type] || otherIcon;
    return L.icon({
      iconUrl,
      iconSize: [34, 36],
      iconAnchor: [17, 36],
      popupAnchor: [0, -36],
    });
  };

  useEffect(() => {
    const documentItems = [
      'Barangay Clearance',
      'Barangay Certificate of Residency',
      'Barangay Certificate of Indigency',
      'Barangay Certificate of Good Moral Character',
      'Barangay Business Clearance',
      'Barangay Certificate of No Objection',
      'Other Documents',
    ];

    const fetchTotals = async () => {
      try {
        const [
          reportsRes,
          documentsRes,
          mobileUsersRes,
          announcementsRes,
          lguAccountsRes,
          pinsRes
        ] = await Promise.all([
          axios.get('/api/admin/total-barangay-reports'),
          axios.get('/api/admin/total-barangay-document-requests'),
          axios.get('/api/admin/total-mobile-users'),
          axios.get('/api/admin/total-announcements'),
          axios.get('/api/admin/total-LGU-accounts'),
          axios.get('/api/admin/admin-get-all-pins')
        ]);

        setTotalReports(reportsRes.data.total);
        setTotalDocuments(documentsRes.data.total);
        setTotalMobileUsers(mobileUsersRes.data.total);
        setTotalAnnouncements(announcementsRes.data.total);
        setTotalLGUAccounts(lguAccountsRes.data.total);
        setPins(pinsRes.data);

        // Graphs (assuming your controller also returns chart data or breakdown)
        setBarangayReportsGraph(reportsRes.data.graphData || []);
        setMobileUsersGraph(mobileUsersRes.data.graphData || []);
      // Convert string values to numbers
      const lguGraphData = lguAccountsRes.data.graphData.map(item => ({
        status: item.status,
        value: Number(item.value),
      }));
      console.log('LGU Accounts Graph Data:', lguGraphData);

      setTotalLGUAccounts(lguAccountsRes.data.total);
      setLguAccountsGraph(lguGraphData);

        // Merge document requests with predefined items
        const mergedDocumentData = documentItems.map(label => {
          const found = documentsRes.data.graphData?.find(d => d.label === label);
          return { label, value: found ? Number(found.value) : 0 };
        });
        console.log('Document Requests Graph:', mergedDocumentData);
        setDocumentRequestsGraph(mergedDocumentData);

      } catch (err) {
        console.error("Error fetching totals:", err);
      }
    };

    fetchTotals();
  }, []); // run once on mount

  function FitBounds({ pins }) {
    const map = useMap();
    useEffect(() => {
      if (pins.length === 0) return;
      const bounds = pins.map(pin => [pin.latitude, pin.longitude]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }, [pins, map]);
    return null;
  }

  

  return (
    <>
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
            <h2 className="page-title">Dashboard</h2>
          </div>


         {/* Dashboard Grid Layout */}
          <div style={styles.dashboardGrid}>
            {/* Row 1 - 4 mini cards */}
            <div style={styles.rowFour}>

              <div style={styles.miniCard}>
                <p style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#6b7280',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>Barangay Reports</p>
                <h3 style={{
                  fontSize: '32px',
                  fontWeight: '700',
                  color: '#111827',
                  margin: 0,
                }}>{totalReports}</h3>
              </div>
              
              <div style={styles.miniCard}>
                <p style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#6b7280',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>Document Requests</p>
                <h3 style={{
                  fontSize: '32px',
                  fontWeight: '700',
                  color: '#111827',
                  margin: 0,
                }}>{totalDocuments}</h3>
              </div>

              <div style={styles.miniCard}>
                <p style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#6b7280',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>Mobile Users</p>
                <h3 style={{
                  fontSize: '32px',
                  fontWeight: '700',
                  color: '#111827',
                  margin: 0,
                }}>{totalMobileUsers}</h3>
              </div>

              <div style={styles.miniCard}>
                <p style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#6b7280',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>LGU Accounts</p>
                <h3 style={{
                  fontSize: '32px',
                  fontWeight: '700',
                  color: '#111827',
                  margin: 0,
                }}>{totalLGUAccounts}</h3>
              </div>

              <div style={styles.miniCard}>
                <p style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#6b7280',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>Announcements</p>
                <h3 style={{
                  fontSize: '32px',
                  fontWeight: '700',
                  color: '#111827',
                  margin: 0,
                }}>{totalAnnouncements}</h3>
              </div>

            </div>

            {/* Row 2 - 2 graphs */}
            <div style={styles.rowTwo}>
              
              <div style={{
                ...styles.graphCard,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
              }}>
                <h3 style={{ 
                  textAlign: 'left', 
                  marginBottom: '15px', 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  color: '#374856' 
                }}>
                  Barangay Reports by Month
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={barangayReportsGraph}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#374856" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{
                ...styles.graphCard,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
              }}>
                <h3 style={{ 
                  textAlign: 'left', 
                  marginBottom: '15px', 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  color: '#374856' 
                }}>
                  Mobile Users by Month
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={mobileUsersGraph}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#374856" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

            </div>

            {/* Row 3 - 2 graphs */}
            <div style={styles.rowThree}>

              <div style={{
                ...styles.graphCard,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                width: '100%'
              }}>
                <h3 style={{ 
                  textAlign: 'left', 
                  marginBottom: '15px', 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  color: '#374856' 
                }}>
                  Document Requests by Type
                </h3>

                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={documentRequestsGraph}
                      dataKey="value"
                      nameKey="label"
                      cx="40%"
                      cy="50%"
                      outerRadius={80}
                      fill="#10b981"
                    >
                      {documentRequestsGraph.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={["#2E7D32", "#2196F3", "#FF9800", "#F44336", "#9C27B0", "#795548", "#3b240aff"][index % 7]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />

                    <Legend 
                      layout="vertical"
                      verticalAlign="middle"
                      align="right"
                      wrapperStyle={{ 
                        top: '50%',
                        transform: 'translateY(-50%)', // this centers vertically
                        fontSize: '15px',
                        fontWeight: 500,
                        color: '#374856',
                        lineHeight: '2em'
                      }}
                      iconSize={12}
                    />

                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{
                ...styles.graphCard,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
              }}>
                <h3 style={{ 
                  textAlign: 'left', 
                  marginBottom: '15px', 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  color: '#374856' 
                }}>
                  Map
                </h3>

                <div 
                  style={{ width: '100%', height: '250px', cursor: 'pointer' }}
                  onClick={() => setMapModalVisible(true)} // opens the modal
                >
                  <MapContainer 
                    center={[13.6215, 123.1811]} // fallback center
                    zoom={13} 
                    style={{ width: '100%', height: '100%' }}
                    dragging={false}          // disable dragging on small map
                    scrollWheelZoom={false}   // disable scroll zoom
                    doubleClickZoom={false}   // disable double click zoom
                    attributionControl={false}
                    zoomControl={false}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {pins.map((pin, index) => (
                      <Marker 
                        key={index} 
                        position={[pin.latitude, pin.longitude]} 
                        icon={getPinIcon(pin.incident_type)}
                      >
                        <Popup>
                          {pin.barangay_name}, {pin.city} <br />
                          {pin.incident_type}
                        </Popup>
                      </Marker>
                    ))}

                    <FitBounds pins={pins} />
                  </MapContainer>
                </div>
              </div>


              <div style={{
                ...styles.graphCard,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                width: '100%'
              }}>
                <h3 style={{ 
                  textAlign: 'left', 
                  marginBottom: '15px', 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  color: '#374856' 
                }}>
                  LGU Accounts
                </h3>

                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={lguAccountsGraph}
                      dataKey="value"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#10b981"
                    >
                      {lguAccountsGraph.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={["#2E7D32", "#F44336", "#FF9800"][index % 3]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend 
                      layout="horizontal"
                      verticalAlign="bottom"
                      align="center"
                      wrapperStyle={{ fontSize: '14px', lineHeight: '1.8em', marginTop: 10 }}
                      iconSize={12}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>

{/* Map Modal */}
{mapModalVisible && (
  <div
    className="overlay modal-fade"
    onClick={() => setMapModalVisible(false)}
  >
    <div
      className="modal"
      style={{ width: '90%', maxWidth: '900px', height: '80%', padding: 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ width: '100%', height: '100%' }}>
        <MapContainer
          center={[13.6215, 123.1811]}
          zoom={13}
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {pins.map((pin, index) => (
            <Marker
              key={index}
              position={[pin.latitude, pin.longitude]}
              icon={getPinIcon(pin.incident_type)}
            >
              <Popup>
                {pin.barangay}, {pin.city} <br />
                {pin.incident_type}
              </Popup>
            </Marker>
          ))}

          <FitBounds pins={pins} />
        </MapContainer>
      </div>
    </div>
  </div>
)}




    </>
  );
}

const styles = {
    dashboardGrid: {
    display: 'grid',
    gridTemplateRows: '15% 40% 40%',
    gap: '20px',
    height: 'calc(100% - 40px)',
  },
  rowFour: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '20px',
  },
  rowTwo: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '20px',
  },
rowThree: {
  display: 'grid',
  gridTemplateColumns: 'calc(40% - 13.33px) calc(40% - 8.66px) calc(20% - 20px)',
  gap: '20px',
},

  miniCard: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
    textAlign: 'center',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    flexDirection: 'column',
    //border: '1px solid #ddd',
  },
  graphCard: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    //border: '1px solid #ddd',
  },
}