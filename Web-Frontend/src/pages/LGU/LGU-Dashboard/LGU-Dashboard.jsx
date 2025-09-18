import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Player } from '@lottiefiles/react-lottie-player';
import LGUNavbar from '../../../components/NavBar/LGU-Navbar';
import LGUSidebar from '../../../components/SideBar/LGU-Sidebar';
import '../../../components/SideBar/styles.css';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';
import axios from '../../../axios/axiosInstance';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  regions,
  getProvincesByRegion,
  getCityMunByProvince,
  getBarangayByMun,
} from 'phil-reg-prov-mun-brgy';
import Select from 'react-select';

import ActsoflasciviousnessIcon from '@/assets/pins/Acts-of-lasciviousness.png';
import AnimalIssuesIcon from '@/assets/pins/Animal-Issues.png';
import BlockedDrainageIcon from '@/assets/pins/Blocked-Drainage.png';
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

export default function LGUDashboard() {

  const userId = localStorage.getItem("userId");
  const token = localStorage.getItem("token");
  const [profile, setProfile] = useState(null);

  const navigate = useNavigate();
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDevelopmentOngoing, setIsDevelopmentOngoing] = useState(true);



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

  const [barangayDirectory, setBarangayDirectory] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [selectedBarangay, setSelectedBarangay] = useState("");

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

  // =================================================
  //  FETCH LGU PROFILE
  // =================================================
  useEffect(() => {
    if (!userId || !token) {
      console.warn("Missing userId or token. Cannot fetch profile.");
      return;
    }
    const fetchProfile = async () => {
      try {
        const res = await axios.get(`/api/auth/lgu-admin-profile/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setProfile({
          region: res.data.region || "",
          province: res.data.province || "",
          city: res.data.city || "",
        });

        console.log("Profile location set:", res.data.region, res.data.province, res.data.city);
      } catch (error) {
        console.error("Failed to fetch profile location:", error?.response?.data || error.message);
        setProfile({ region: "", province: "", city: "" });
      }
    };

    fetchProfile();
  }, []);

const lguAxios = (url, options = {}) => {
  if (!profile) throw new Error("Profile not loaded");

  const defaultParams = {
    city: profile.city,
    province: profile.province,
    region: profile.region,
  };

  const mergedOptions = {
    ...options,
    params: { ...(options.params || {}), ...defaultParams },
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
  };

  return axios(url, mergedOptions);
};



useEffect(() => {
  // Only run if profile is loaded
  if (!profile) return;

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
        lguAxios('/api/lgu/get-all-barangay-reports'),
        axios.get('/api/admin/total-barangay-document-requests'),
        lguAxios('/api/lgu/total-mobile-users'),

        axios.get('/api/admin/total-announcements'),
        axios.get('/api/admin/total-LGU-accounts'),
        lguAxios('/api/admin/admin-get-all-pins')
      ]);

      console.log("Pins:", pinsRes.data);

      // Set totals
      setTotalReports(reportsRes.data.total || 0);
      setTotalDocuments(documentsRes.data.total || 0);
      setTotalMobileUsers(mobileUsersRes.data.total || 0);
      setTotalAnnouncements(announcementsRes.data.total || 0);
      setTotalLGUAccounts(lguAccountsRes.data.total || 0);
      setPins(pinsRes.data || []);


      // Set graphs
      setBarangayReportsGraph(reportsRes.data.graphData || []);
      setMobileUsersGraph(mobileUsersRes.data.graphData || []);



      // Convert LGU accounts graph data to numbers
      const lguGraphData = (lguAccountsRes.data.graphData || []).map(item => ({
        status: item.status,
        value: Number(item.value) || 0,
      }));
      setLguAccountsGraph(lguGraphData);

      // Merge document requests with predefined items
      const mergedDocumentData = documentItems.map(label => {
        const found = documentsRes.data.graphData?.find(d => d.label === label);
        return { label, value: found ? Number(found.value) : 0 };
      });
      setDocumentRequestsGraph(mergedDocumentData);

    } catch (err) {
      console.error("Error fetching totals:", err?.response?.data || err.message);
    }
  };

  fetchTotals();
}, [profile]); // <-- depend on profile so it runs after profile is loaded




function FitBounds({ pins }) {
  const map = useMap();
  useEffect(() => {
    if (pins.length === 0) return;
    const bounds = pins.map(pin => [pin.latitude, pin.longitude]);
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [pins, map]);
  return null;
}



    // =================================================
    //  BARANGAY LIST
    // =================================================
    const barangayList = useMemo(() => {
    if (!profile?.region || !profile?.province || !profile?.city) return [];

    const regionLabelToCode = regions.reduce((map, region) => {
        map[region.name] = region.reg_code;
        return map;
    }, {});
    
    const regCode = regionLabelToCode[profile.region];
    if (!regCode) {
        console.warn('Region code not found for:', profile.region);
        return [];
    }

    const provinces = getProvincesByRegion(regCode);
    console.log("Provinces for region:", profile.region, provinces.map(p => p.name));

    const matchedProvince = provinces.find(
        (prov) =>
        prov.name.toLowerCase().includes(profile.province.toLowerCase().trim()) ||
        profile.province.toLowerCase().includes(prov.name.toLowerCase().trim())
    );

    if (!matchedProvince) {
        console.warn('Province not matched:', profile.province);
        return [];
    }

    const cities = getCityMunByProvince(matchedProvince.prov_code);

    const normalize = (str) =>
    str.toLowerCase().replace(/ city| municipality/g, '').trim();

    const matchedCity = cities.find(
    (c) => normalize(c.name) === normalize(profile.city)
    );

    if (!matchedCity) {
    console.warn('City not matched:', profile.city);
    console.log('Available cities:', cities.map(c => c.name));
    return [];
    }

    return getBarangayByMun(matchedCity.mun_code);
    }, [profile]);


// Compute the most reported barangay
const mostReportedBarangay = useMemo(() => {
  if (!barangayReportsGraph || barangayReportsGraph.length === 0) return "";

  // Aggregate totals per barangay
  const totals = {};
  barangayReportsGraph.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (key === "label") return;
      totals[key] = (totals[key] || 0) + (row[key] || 0);
    });
  });

  // Find the barangay with the highest total
  let max = 0;
  let mostReported = "";
  Object.entries(totals).forEach(([barangay, total]) => {
    if (total > max) {
      max = total;
      mostReported = barangay;
    }
  });

  return mostReported;
}, [barangayReportsGraph]);


    // Filtered graph data based on selected barangay
    const filteredBarangayReportsGraph = useMemo(() => {

      if (!selectedBarangay) {
        // ➡ No barangay selected → sum across all barangays
        const allBarangays = Object.keys(barangayReportsGraph[0] || {}).filter(
          (k) => k !== "label"
        );

        const aggregated = barangayReportsGraph.map((row) => {
          const total = allBarangays.reduce((sum, b) => sum + (row[b] || 0), 0);
          return { label: row.label, value: total };
        });

        return aggregated;
      }

      // ➡ Specific barangay selected
      const filtered = barangayReportsGraph.map((row) => ({
        label: row.label,
        value: row[selectedBarangay] || 0,
      }));

      return filtered;
    }, [barangayReportsGraph, selectedBarangay]);


    // Filtered pins based on selected barangay
    const normalize = (str) => str?.toLowerCase().trim() || "";

    const filteredPins = useMemo(() => {
      if (!pins || pins.length === 0) return [];

      return pins.filter(pin => {
        const regionMatch = profile?.region ? normalize(pin.region) === normalize(profile.region) : true;
        const provinceMatch = profile?.province ? normalize(pin.province) === normalize(profile.province) : true;
        const cityMatch = profile?.city ? normalize(pin.city) === normalize(profile.city) : true;

        return regionMatch && provinceMatch && cityMatch;
      });
    }, [pins, profile]);





  return (
    <>
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
                }}>Announcements</p>
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
                }}>Most Reported Barangay</p>
                <h3 style={{
                  fontSize: '32px',
                  fontWeight: '700',
                  color: '#111827',
                  margin: 0,
                }}>{mostReportedBarangay || "N/A"}</h3>
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

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    textAlign: "center",
                    width: "100%",
                  }}
                >
                  <h3
                    style={{
                      textAlign: "left",
                      marginBottom: "0px",
                      fontSize: "16px",
                      fontWeight: "600",
                      color: "#374856",
                    }}
                  >
                    Barangay Reports by Month
                  </h3>

                  {/* Barangay Dropdown */}
                  <Select
                    options={barangayList.map((b) => {
                      const formattedName = b.name
                        .toLowerCase()
                        .replace(/\b\w/g, (c) => c.toUpperCase())
                        .trim();
                      return { value: formattedName, label: formattedName };
                    })}
                    value={
                      selectedBarangay
                        ? { value: selectedBarangay, label: selectedBarangay }
                        : null
                    }
                    onChange={(selectedOption) =>
                      setSelectedBarangay(selectedOption?.value || "")
                    }
                    placeholder="Select Barangay"
                    styles={dropdownStyles}
                  />
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={filteredBarangayReportsGraph}>
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
            <div style={styles.rowTwo}>

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
                        transform: 'translateY(-50%)',
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
                  onClick={() => setMapModalVisible(true)}
                >
                  <MapContainer 
                    center={[13.6215, 123.1811]}
                    zoom={13} 
                    style={{ width: '100%', height: '100%' }}
                    dragging={false}
                    scrollWheelZoom={false}
                    doubleClickZoom={false}
                    attributionControl={false}
                    zoomControl={false}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {filteredPins.map((pin, index) => (
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

                    <FitBounds pins={filteredPins} />
                  </MapContainer>
                </div>
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

          {filteredPins.map((pin, index) => (
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
          <FitBounds pins={filteredPins} />

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

const dropdownStyles = {
  control: (base, state) => ({
    ...base,
    borderRadius: 8,
    boxShadow: state.isFocused ? '0 0 0 2px rgba(0,111,253,0.2)' : 'none',
    padding: '4px 3px',
    paddingLeft: '10px',
    marginTop: 3,
    marginBottom: 15,
    fontSize: 14,
    fontWeight: 500,
    minHeight: '38px',
    border: '1px solid #ccc',
    alignSelf: 'flex-start',
    textAlign: 'left',
  }),
  option: (base, { isFocused, isSelected }) => ({
    ...base,
    backgroundColor: isSelected
      ? '#8696BB'
      : isFocused
      ? '#f3f4f6'
      : '#ffffff',
    color: isSelected ? '#ffffff' : '#111827',
    cursor: 'pointer',
    fontSize: 14,
    textAlign: 'left',
  }),
  singleValue: (base) => ({
    ...base,
    color: '#111827',
    textAlign: 'left',
  }),
  menu: (base) => ({
  ...base,
  borderRadius: 8,
  boxShadow: '0 0 0 2px rgba(0,111,253,0.2)',
  zIndex: 20,
  }),
};
