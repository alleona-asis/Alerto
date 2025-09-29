import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import BRGYNavbar from '../../../components/NavBar/BRGY-Navbar';
import BRGYSidebar from '../../../components/SideBar/BRGY-Sidebar';
import '../../../components/SideBar/styles.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from "../../../axios/axiosInstance";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

import dayjs from "dayjs";
import { io } from 'socket.io-client';
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


const monthOptions = [
  { value: "All", label: "All Months" },
  { value: "January", label: "January" },
  { value: "February", label: "February" },
  { value: "March", label: "March" },
  { value: "April", label: "April" },
  { value: "May", label: "May" },
  { value: "June", label: "June" },
  { value: "July", label: "July" },
  { value: "August", label: "August" },
  { value: "September", label: "September" },
  { value: "October", label: "October" },
  { value: "November", label: "November" },
  { value: "December", label: "December" },
];


export default function BRGYDashboard() {


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

  const socket = useMemo(() => 
  io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000", {
    transports: ["websocket", "polling"],
    withCredentials: true,
  }), 
    []
  );

  const navigate = useNavigate();
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [BRGYProfile, setBRGYProfile] = useState(null);
  const [incidentReports, setIncidentReports] = useState([]);
  const [documentRequest, setDocumentRequest] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const userId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');

  const stats = [
    { 
      title: "Pending Requests", 
      count: documentRequest.filter(req => req.status !== "resolved" && req.status !== "invalid").length 
    },
    { 
      title: "Unresolved Reports", 
      count: incidentReports.filter(rep => rep.status !== "resolved" && rep.status !== "invalid").length 
    },
  ];



  // Fetch Barangay Profile
  useEffect(() => {
    if (!userId || !token) {
      setError('User not logged in.');
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await axios.get(`/api/auth/barangay-staff-profile/${userId}`);
        if (Array.isArray(response.data) && response.data.length > 0) {
          setBRGYProfile(response.data[0]);
        } else {
          setError('No profile found');
        }
      } catch (error) {
        setError('Failed to load profile.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId, token]);

// Fetch Incident Reports based on profile
const fetchBarangayIncidentReports = async () => {
  if (!BRGYProfile) return;
  const { region, province, city, barangay } = BRGYProfile;

  if (!region || !province || !city || !barangay) return;

  setLoading(true);
  try {
    const response = await axios.get("api/brgy/barangay-incident-reports", {
      params: { region, province, city, barangay },
    });

    console.log("Full Incident Reports Response:", response.data);

    // Check if response.data is an array and log IDs one by one
    if (Array.isArray(response.data)) {
      response.data.forEach((report, index) => {
        console.log(`Report ${index + 1} ID:`, report.id || report.report_id);
      });
    } else {
      console.warn("⚠️ Expected array but got:", typeof response.data);
    }

    setIncidentReports(response.data);
    setError(null);
  } catch (err) {
    console.error("Error fetching reports:", err);
    setError("Failed to load mobile users.");
    setIncidentReports([]);
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  if (token && BRGYProfile) {
    fetchBarangayIncidentReports();
  }
}, [token, BRGYProfile]);


  // Fetch Document Requests based on profile
  const fetchBarangayDocumentRequests = async () => {
    if (!BRGYProfile) return;
    const { region, province, city, barangay } = BRGYProfile;

    if (!region || !province || !city || !barangay) return;

    setLoading(true);
    try {
      const response = await axios.get('api/brgy/barangay-document-requests', {
        params: { region, province, city, barangay },
      });
      setDocumentRequest(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load document requests.');
      setDocumentRequest([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && BRGYProfile) {
      fetchBarangayDocumentRequests();
    }
  }, [token, BRGYProfile]);


useEffect(() => {
  if (!BRGYProfile) return;

  // ----- Document Requests -----
  const handleNewRequest = (newRequest) => {
    if (
      newRequest.region === BRGYProfile.region &&
      newRequest.province === BRGYProfile.province &&
      newRequest.city === BRGYProfile.city &&
      newRequest.barangay === BRGYProfile.barangay
    ) {
      setDocumentRequest((prev) => {
        if (prev.some(r => r.id === newRequest.id)) return prev;
        return [newRequest, ...prev];
      });
    }
  };

  const handleStatusUpdate = (update) => {
    setDocumentRequest((prev) =>
      prev.map((r) =>
        r.id === update.requestId
          ? { ...r, status: update.status, status_history: update.status_history }
          : r
      )
    );
  };

  socket.on("newDocumentRequest", handleNewRequest);
  socket.on("documentRequestUpdate", handleStatusUpdate);

  // ----- Incident Reports -----
  const handleNewReport = (newReport) => {
    if (
      newReport.region === BRGYProfile.region &&
      newReport.province === BRGYProfile.province &&
      newReport.city === BRGYProfile.city &&
      newReport.barangay === BRGYProfile.barangay
    ) {
      setIncidentReports((prev) => {
        if (prev.some((r) => r.id === newReport.id)) return prev;
        return [newReport, ...prev];
      });
    }
  };

  socket.on("newBarangayReport", handleNewReport);

  // Cleanup on unmount or BRGYProfile change
  return () => {
    socket.off("newDocumentRequest", handleNewRequest);
    socket.off("documentRequestUpdate", handleStatusUpdate);
    socket.off("newBarangayReport", handleNewReport);
  };
}, [socket, BRGYProfile]);



  // Naga City
  const position = [13.6218, 123.1948];


  const [selectedMonth, setSelectedMonth] = useState("All");

  // Get all months from data
  const months = Array.from(
    new Set(
      incidentReports.map((r) => dayjs(r.created_at).format("MMM YYYY"))
    )
  ).sort((a, b) => dayjs(a, "MMM YYYY") - dayjs(b, "MMM YYYY"));

  // Filter data by selected month
const filteredReports = selectedMonth === "All"
  ? incidentReports
  : incidentReports.filter((report) => {
      const reportMonth = dayjs(report.created_at).format("MMMM"); // full month name
      return reportMonth === selectedMonth;
    });

  // Group incidents by type
  const groupedData = (() => {
    const grouped = {};
    filteredReports.forEach((report) => {
      const type = report.incident_type || "Unknown";
      if (!grouped[type]) grouped[type] = { type };
      grouped[type].count = (grouped[type].count || 0) + 1;
    });
    return Object.values(grouped);
  })();

  const incidentTypes = [...new Set(incidentReports.map((r) => r.incident_type || "Unknown"))];


  return (
    <div className="wrapper">
      <div className="navbar">
        <BRGYNavbar />
      </div>
      <div className="layout">
        <BRGYSidebar 
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
            <h2 className="page-title">Barangay Dashboard</h2>
          </div>

          {/* 🔲 Dashboard Grid */}
          <div 
            style={{
              display: 'grid',
              gridTemplateColumns: "1fr 1fr",
              gap: '20px',
              height: 'calc(100vh - 150px)',
            }}
          >

  {/* Left Column */}
  <div
    style={{
      display: "grid",
      gridTemplateRows: "auto 1fr 1fr",
      gap: "20px",
      height: "100%",
      overflow: "hidden",
    }}
  >
    {/* Row 1 - 20% */}
    <div style={{ display: "flex", gap: "20px" }}>
      {stats.map((item, index) => (
        <div
          key={index}
          style={{ ...styles.box, background: "#ffffffff", flex: 1 }}
        >
          <h3>{item.title}</h3>
          <p>{item.count}</p>
        </div>
      ))}
    </div>

    {/* Row 2 - 40% */}
<div style={styles.container}
>

                  <h3
                    style={{
                      textAlign: "left",
                      marginBottom: "10px",
                      fontSize: "16px",
                      fontWeight: "600",
                      color: "#374856",
                    }}
                  >
                    Document Requests
                  </h3>

  {documentRequest.length === 0 ? (
    <p>No document requests</p>
  ) : (
    <div style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Document Type</th>
            <th style={styles.th}>Date/Time</th>
            <th style={styles.th}>Requested By</th>
            <th style={styles.th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {documentRequest
            .slice()
            .sort((a, b) => {
              const getTimestamp = (req) => {
                if (!req.date) return 0;
                const dateObj = new Date(req.date);
                const [hour = 0, minute = 0] = (req.time || "00:00")
                  .split(":")
                  .map(Number);
                return dateObj.getTime() + hour * 3600000 + minute * 60000;
              };
              return getTimestamp(b) - getTimestamp(a); // latest first
            })
            .slice(0, 15)
            .map((doc) => {
              let formattedDateTime = "N/A";
              if (doc.date) {
                const dateObj = new Date(doc.date);
                if (!isNaN(dateObj.getTime())) {
                  const [hourStr = "0", minuteStr = "00"] = (doc.time || "00:00").split(":");
                  let hour = parseInt(hourStr, 10);
                  const minute = minuteStr;
                  const ampm = hour >= 12 ? "PM" : "AM";
                  hour = hour % 12 || 12;

                  const formattedDate = `${(dateObj.getMonth() + 1)
                    .toString()
                    .padStart(2, "0")}/${dateObj.getDate().toString().padStart(2, "0")}/${dateObj.getFullYear()}`;

                  formattedDateTime = `${formattedDate} ${hour}:${minute} ${ampm}`;
                }
              }

              const getRequestsStatusColor = (status) => {
                switch ((status || "").toLowerCase()) {
                  case "submitted": return "#FFB300";
                  case "processing": return "#2196F3";
                  case "accepted": return "#4CAF50";
                  case "rejected": return "#F44336";
                  case "reschedule": return "#FF5722";
                  case "ready for pick-up": return "#9C27B0";
                  case "claimed": return "#795548";
                  case "unclaimed": return "#607D8B";
                  default: return "#374856";
                }
              };
              const dotColor = getRequestsStatusColor(doc.status);

              return (
                <tr key={doc.id || doc.request_id}>
                  <td style={styles.td}>{doc.document_type || "Unknown"}</td>
                  <td style={styles.td}>{formattedDateTime}</td>
                  <td style={styles.td}>{doc.requested_by || "Unknown"}</td>
                  <td style={{ ...styles.td, display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: dotColor,
                        display: "inline-block",
                        marginTop: 1
                      }}
                    />
                    <span>{doc.status || "Unknown"}</span>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  )}
</div>





    {/* Row 3 - 40% */}
{/* Row 3 - 40% */}
<div style={styles.container}>
                  <h3
                    style={{
                      textAlign: "left",
                      marginBottom: "10px",
                      fontSize: "16px",
                      fontWeight: "600",
                      color: "#374856",
                    }}
                  >
                    Latest Incident Reports
                  </h3>

  {loading && <p>Loading incident reports...</p>}
  {error && <p style={{ color: "red" }}>{error}</p>}
  {!loading && !error && incidentReports.length === 0 && <p>No incident reports found.</p>}

  {!loading && !error && incidentReports.length > 0 && (
    <div style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Incident/Issue</th>
            <th style={styles.th}>Date/Time</th>
            <th style={styles.th}>Reported By</th>
            <th style={styles.th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {incidentReports
            .slice()
            .sort((a, b) => {
              const getTimestamp = (report) => {
                const time = new Date(report.created_at).getTime();
                return isNaN(time) ? 0 : time;
              };
              return getTimestamp(b) - getTimestamp(a);
            })
            .slice(0, 15)
            .map((report) => {
              // Format date/time
              let formattedDateTime = "N/A";
              if (report.incident_date) {
                const dateObj = new Date(report.incident_date);
                if (!isNaN(dateObj.getTime())) {
                  const [hourStr = "0", minuteStr = "00"] = (report.incident_time || "00:00").split(":");
                  let hour = parseInt(hourStr, 10);
                  const minute = minuteStr;
                  const ampm = hour >= 12 ? "PM" : "AM";
                  hour = hour % 12 || 12;
                  const formattedDate = `${(dateObj.getMonth() + 1)
                    .toString()
                    .padStart(2, "0")}/${dateObj.getDate().toString().padStart(2, "0")}/${dateObj.getFullYear()}`;
                  formattedDateTime = `${formattedDate} ${hour}:${minute} ${ampm}`;
                }
              }

              // Status dot color mapping (match document request style)
              const getStatusColor = (status) => {
                switch ((status || "").toLowerCase()) {
                  case "pending": return "#FFB300";
                  case "under review": return "#2196F3";
                  case "in progress": return "#4CAF50";
                  case "resolved": return "#4CAF50";
                  case "invalid": return "#F44336";
                  case "escalated": return "#FF5722";
                  case "transferred": return "#9C27B0";
                  case "verified": return "#795548";
                  case "unverified": return "#607D8B";
                  default: return "#374856";
                }
              };
              const dotColor = getStatusColor(report.status);

              return (
                <tr key={report.id || report.report_id}>
                  <td style={styles.td}>{report.incident_type || "Unknown"}</td>
                  <td style={styles.td}>{formattedDateTime}</td>
                  <td style={styles.td}>{report.reported_by || "Unknown"}</td>
                  <td style={{ ...styles.td, display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: dotColor,
                        display: "inline-block",
                        marginTop: 1
                      }}
                    />
                    <span>{report.status || "Unknown"}</span>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  )}
</div>





    
  </div>


{/* Right Column */}
<div
  style={{ 
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    height: "100%",
  }}
>
  {/* Box 5 - Map */}
<div
  style={{
    ...styles.box,
    flex: 1,
    background: "#ffffffff",
    borderRadius: "12px",
    overflow: "hidden",
    padding: 15,
    display: "flex",
    flexDirection: "column",
  }}
>
                  <h3
                    style={{
                      textAlign: "left",
                      marginBottom: "10px",
                      fontSize: "16px",
                      fontWeight: "600",
                      color: "#374856",
                    }}
                  >
                    Pin Dropping
                  </h3>

  <div style={{ flex: 1 }}>
    <MapContainer
      center={position}
      zoom={13}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
      />
      {incidentReports.map((report) => (
        <Marker
          key={report.id || report.report_id}
          position={[report.latitude, report.longitude]}
          icon={getPinIcon(report.incident_type)}
        >
          <Popup>
            <strong>Incident:</strong> {report.incident_type || "Unknown"} <br />
            <strong>Barangay:</strong> {report.barangay} <br />
            <strong>City:</strong> {report.city}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  </div>
</div>


  {/* Box 6 - Chart */}
    <div
      style={{
        ...styles.box,
        flex: 1,
        background: "#ffffffff",
        borderRadius: "12px",
        overflow: "hidden",
        padding: 15,
        display: "flex",
        flexDirection: "column",
      }}
    >
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
                    Barangay Report Trends
                  </h3>

      {/* Month Dropdown */}
<Select
  value={monthOptions.find((o) => o.value === selectedMonth)}
  onChange={(option) => setSelectedMonth(option.value)}
  options={monthOptions}  // <-- Make sure to pass options
  placeholder="Select Month"
  styles={dropdownStyles}
/>
</div>
<ResponsiveContainer width="100%" height="100%">
  <LineChart
    data={groupedData}
    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
  >
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="type" />
    <YAxis allowDecimals={false} />
    <Tooltip />
    {incidentTypes.map((type, idx) => (
      <Line
        key={type}
        type="monotone"
        dataKey="count"
        stroke={["#2196f3"][idx % 1]}
        strokeWidth={2}
        dot={{ r: 3 }}
      />
    ))}
  </LineChart>
</ResponsiveContainer>
    </div>

</div>


</div>

        </div>
      </div>
    </div>
  );
}

const styles = {
  box: {
    borderRadius: "16px",
    padding: "20px",
    background: "#ffffff",
    boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
    transition: "all 0.2s ease-in-out",
  },

container: {
  background: "#ffffffff",
  borderRadius: "12px",
  padding: "20px",
  boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
  display: "flex",
  flexDirection: "column",
  height: "100%",
  overflow: "auto",          // allow scroll
  scrollbarWidth: "none",    // Firefox
  msOverflowStyle: "none",   // IE 10+
},


  title: {
    fontSize: "20px",
    position: "sticky",
    top: 0,
    backgroundColor: "#fff", // important: sticky elements need a background
    zIndex: 2,               // make sure it’s above table headers
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
    backgroundColor: "#ffffffff",
  },
th: {
  textAlign: "left",
  borderBottom: "1px solid #ddd",
  backgroundColor: "#ffffffff",
  position: "sticky",
  top: 0,
  zIndex: 1,
  color: '#4894FE',
  padding: "12px 8px", // 12px vertical, 8px horizontal
},

td: {
  padding: "12px 8px", // 12px vertical, 8px horizontal
  borderBottom: "1px solid #eee",
},
};


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