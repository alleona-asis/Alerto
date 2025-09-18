import { useState, useEffect, useMemo } from 'react';
import axios from '../../../axios/axiosInstance';
import { useNavigate } from 'react-router-dom';
import BRGYNavbar from '../../../components/NavBar/BRGY-Navbar';
import BRGYSidebar from '../../../components/SideBar/BRGY-Sidebar';
import { ToastContainer, toast } from 'react-toastify';
import { Player } from '@lottiefiles/react-lottie-player';
import noBarangayAnim from '@/assets/animations/non data found.json';
import Select from 'react-select';
import { io } from 'socket.io-client';
import '../../Barangay/BRGY-Mobile-Users/BRGY-Mobile-Users.css';
import { format } from "date-fns";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});
import {
  regions,
  getProvincesByRegion,
  getCityMunByProvince,
  getBarangayByMun,
} from 'phil-reg-prov-mun-brgy';

const getStatusColor = (status) => {
  switch (status.toLowerCase()) {
    case 'pending': return '#FF9800';
    case 'under review': return '#2196F3';
    case 'in progress': return '#9C27B0';
    case 'resolved': return '#4CAF50';
    case 'invalid': return '#F44336';
    case 'escalated': return '#E91E63';
    case 'transferred': return '#795548';
    case 'verified': return '#2E7D32';
    case 'unverified': return '#D32F2F';
    default: return '#000000';
  }
};


export default function ADMINDashboard() {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  const [profile, setProfile] = useState(null);
  const navigate = useNavigate();
  const socket = useMemo(() => io('http://localhost:5000'), []);

  // State hooks
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [incidentReports, setIncidentReports] = useState([]);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('first-name-asc');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reportToDelete, setReportToDelete] = useState(null);
  const [isClosing, setIsClosing] = useState(false);

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showImagesModal, setShowImagesModal] = useState(false);
  const [modalUser, setModalUser] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const [showProofModal, setShowProofModal] = useState(false);
  const [reportToUpload, setReportToUpload] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState(null);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [selectedReportToTransfer, setSelectedReportToTransfer] = useState(null);
  const [barangayDirectory, setBarangayDirectory] = useState([]);


  // Helper to capitalize words
  const capitalizeWords = (str) =>
    str?.toLowerCase().replace(/\b\w/g, char => char.toUpperCase()) || '';

  // Status options
  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'under review', label: 'Under Review' },
    { value: 'in progress', label: 'In Progress' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'invalid', label: 'Invalid' },
    { value: 'escalated', label: 'Escalated' },
    { value: 'transferred', label: 'Transferred' },
  ];

  // Next status options depending on current
  const getNextStatusOptions = (currentStatus) => {
    switch (currentStatus.toLowerCase()) {
      case 'pending':
        return statusOptions.filter(opt => opt.value === 'under review');
      case 'under review':
        return statusOptions.filter(opt =>
          ['in progress', 'invalid', 'escalated', 'transferred'].includes(opt.value)
        );
      case 'in progress':
        return statusOptions.filter(opt => opt.value === 'resolved');
      case 'transferred':
        return statusOptions.filter(opt =>
          ['in progress', 'invalid', 'escalated'].includes(opt.value)
        );
      case 'escalated':
        return statusOptions.filter(opt =>
          ['in progress', 'invalid'].includes(opt.value)
        );
      default:
        return [];
    }
  };

  // Sort options
  const sortOptions = [
    { value: 'first-name-asc', label: 'Sort by First Name' },
    { value: 'last-name-asc', label: 'Sort by Last Name' },
    { value: 'date-desc', label: 'Sort by Date' },
    { value: 'status-asc', label: 'Sort by Status' },
    { value: 'id-asc', label: 'Sort by ID' },
  ];

  // Sorting function
  const sortIncidentReports = (users, option) => {
    const sorted = [...users];
    switch (option) {
      case 'incident-type-asc':
        return sorted.sort((a, b) => (a.incident_type || '').localeCompare(b.incident_type || ''));
      case 'date-desc':
        return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      case 'status-asc':
        return sorted.sort((a, b) => (a.status || '').localeCompare(b.status || ''));
      case 'id-asc':
        return sorted.sort((a, b) => (a.id || 0) - (b.id || 0));
      default:
        return sorted;
    }
  };

  // Filtering function
  const filterIncidentReports = (users) => {
    const query = searchQuery.toLowerCase();
    return users.filter((user) =>
      [
        user.id?.toString(),
        user.incident_type,
        user.status,
        user.province,
        user.city,
        user.barangay,
        user.first_name,
        user.last_name,
      ]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(query))
    );
  };

  // Memoized filtered + sorted reports
  const displayIncidentReports = useMemo(() => {
    const filtered = filterIncidentReports(incidentReports);
    return sortIncidentReports(filtered, sortOption);
  }, [incidentReports, searchQuery, sortOption]);

  // =================================================
  //  FETCH BARANGAY STAFF PROFILE
  // =================================================
  /*
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
        const response = await axios.get('api/brgy/barangay-incident-reports', {
          params: { region, province, city, barangay },
        });
        setIncidentReports(response.data);
        setError(null);
      } catch (err) {
        setError('Failed to load mobile users.');
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
  */

  // =================================================
  //  FETCH USER PROFILE
  // =================================================
  useEffect(() => {
    if (!userId || !token) {
      console.warn("Missing userId or token. Cannot fetch profile.");
      return;
    }

    const fetchProfile = async () => {
      try {
        const res = await axios.get(`/api/auth/barangay-staff-profile/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // Assuming API returns an array, take the first element
        const data = Array.isArray(res.data) ? res.data[0] : res.data;

        setProfile({
          region: data?.region || "",
          province: data?.province || "",
          city: data?.city || "",
          barangay: data?.barangay || "",
        });

      } catch (error) {
        console.error(
          "Failed to fetch profile location:",
          error?.response?.data || error.message
        );
        setProfile({ region: "", province: "", city: "", barangay: "" });
      }
    };

    fetchProfile();
  }, [userId, token]);


  // =================================================
  //  BARANGAY LIST
  // =================================================
  const barangayList = useMemo(() => {
    if (!profile?.region || !profile?.province || !profile?.city) {
      console.warn("Profile incomplete:", profile);
      return [];
    }

    // Map region name to code
    const regionLabelToCode = regions.reduce((map, region) => {
      map[region.name.toLowerCase()] = region.reg_code;
      return map;
    }, {});

    const regCode = regionLabelToCode[profile.region.toLowerCase()];
    if (!regCode) {
      console.warn("Region code not found for:", profile.region);
      return [];
    }

    const provinces = getProvincesByRegion(regCode);
    const matchedProvince = provinces.find(
      (prov) =>
        prov.name.toLowerCase().includes(profile.province.toLowerCase().trim()) ||
        profile.province.toLowerCase().includes(prov.name.toLowerCase().trim())
    );
    if (!matchedProvince) {
      console.warn("Province not matched:", profile.province);
      console.log("Available provinces:", provinces.map(p => p.name));
      return [];
    }

    const cities = getCityMunByProvince(matchedProvince.prov_code);
    const normalize = (str) => str.toLowerCase().replace(/ city| municipality/g, '').trim();

    const matchedCity = cities.find(
      (c) => normalize(c.name) === normalize(profile.city)
    );
    if (!matchedCity) {
      console.warn("City not matched:", profile.city);
      console.log("Available cities:", cities.map(c => c.name));
      return [];
    }

    const barangays = getBarangayByMun(matchedCity.mun_code);
    console.log("Barangays fetched:", barangays.map(b => b.name));
    return barangays;
  }, [profile]);


  // =================================================
  //  FETCH ALL REPORTS BY LOCATION
  // =================================================
  useEffect(() => {
    if (!profile) {
      console.log("Profile not set.");
      return;
    }

    const { region, province, city, barangay } = profile;

    if (region && province && city) {
      const fetchReports = async () => {
        const token = localStorage.getItem("token");
        if (!token) return;

        setLoading(true);
        try {
          const res = await axios.get("/api/brgy/barangay-get-all-reports", {
            headers: { Authorization: `Bearer ${token}` },
            params: { region, province, city, barangay },
          });

          setIncidentReports(res.data || []);
        } catch (error) {
          console.error(
            "Failed to fetch reports:",
            error?.response?.data?.message || error.message
          );
          setIncidentReports([]);
        } finally {
          setLoading(false);
        }
      };

      fetchReports();
    } else {
      console.warn("Profile missing location. Skipping fetch.", profile);
    }
  }, [profile]);


  // =================================================
  //  SOCKET LISTENER
  // =================================================
  useEffect(() => {
    const handleNewReport = (newReport) => {
      if (
        newReport.region === profile.region &&
        newReport.province === profile.province &&
        newReport.city === profile.city &&
        newReport.barangay === profile.barangay
      ) {
        setIncidentReports((prev) => {
          if (prev.some((r) => r.id === newReport.id)) return prev;
          return [newReport, ...prev];
        });
      } else {
        console.log("Report ignored due to different location:", newReport.barangay);
      }
    };

    socket.on("newBarangayReport", handleNewReport);
    return () => socket.off("newBarangayReport", handleNewReport);
  }, [socket, profile]);


  // =================================================
  //  DELETE REPORT
  // =================================================
  const deleteIncidentReport = async (id) => {
    try {
      const response = await axios.delete(`/api/brgy/barangay-delete-incident-report/${id}`);

      setIncidentReports(prev => prev.filter(user => user.id !== id));
      setShowDeleteConfirm(false);
      setReportToDelete(null);

      toast.success(response.data?.message || 'Report successfully deleted.');
    } catch (error) {
      console.error('Failed to delete user:', error);

      const status = error.response?.status;
      const data = error.response?.data;

      if (status) {
        console.error(`Status: ${status}`);
        console.error('Response:', data);
      } else if (error.request) {
        console.error('No server response. Request details:', error.request);
      } else {
        console.error('Request setup error:', error.message);
      }

      toast.error(data?.message || 'Failed to delete barangay report. Please try again.');
    }
  };

  // =================================================
  //  CHANGE STATUS
  // =================================================
  const handleStatusChange = async (userId, newStatus) => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      const first_name = user?.firstName || "";
      const last_name = user?.lastName || "";

      if (["invalid", "resolved"].includes(newStatus.toLowerCase())) {
        const report = incidentReports.find(r => r.id === userId);
        setReportToUpload({ ...report, nextStatus: newStatus });
        setShowProofModal(true);
        return;
      }

      if (newStatus.toLowerCase() === "transferred") {
        const report = incidentReports.find(r => r.id === userId);
        if (!report) {
          toast.error("Report not found");
          return;
        }
        setSelectedReportToTransfer({ ...report, nextStatus: newStatus });
        setShowTransferModal(true);
        return;
      }


      const payload = { status: newStatus.toLowerCase(), first_name, last_name };
      await axios.patch(`/api/brgy/update-barangay-report-status/${userId}`, payload);

      setIncidentReports(prev =>
        prev.map(r => (r.id === userId ? { ...r, status: newStatus } : r))
      );
    } catch (error) {
      console.error(error);
      toast.error("Failed to update status.");
    }
  };

  // =================================================
  //  UPLOAD PROOF
  // =================================================
  const handleUploadProof = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      toast.error("Please select at least one file to upload.");
      return;
    }

    try {
      const formData = new FormData();
      Array.from(selectedFiles).forEach(file => formData.append("proof", file));

      await axios.post(
        `/api/brgy/upload-proof/${reportToUpload.id}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      const user = JSON.parse(localStorage.getItem("user"));
      const payload = {
        status: reportToUpload.nextStatus.toLowerCase(),
        first_name: user?.firstName || "",
        last_name: user?.lastName || "",
      };

      await axios.patch(
        `/api/brgy/update-barangay-report-status/${reportToUpload.id}`,
        payload
      );

      setIncidentReports(prev =>
        prev.map(r =>
          r.id === reportToUpload.id
            ? { ...r, status: reportToUpload.nextStatus, proofUploaded: true }
            : r
        )
      );

      toast.success("Proof uploaded and status updated!");
      setShowProofModal(false);
      setSelectedFiles(null);
      setReportToUpload(null);
    } catch (error) {
      console.error("Failed to upload proof:", error);
      toast.error("Failed to upload proof. Please try again.");
    }
  };

  // =================================================
  //  TRANSFER REPORT
  // =================================================
  const handleConfirmTransfer = async () => {
    if (!selectedBarangay || !selectedReportToTransfer) {
      toast.error("Please select a barangay to transfer.");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("User not authenticated.");

      const payload = {
        newBarangay: selectedBarangay,
      };

      const { data } = await axios.patch(
        `/api/brgy/transfer-report/${selectedReportToTransfer.id}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const updatedReport = data.report;

      setIncidentReports(prev =>
        prev
          .filter(r => r.id !== selectedReportToTransfer.id)
      );

      toast.success(`Report successfully transferred to ${selectedBarangay}!`);
      setShowTransferModal(false);
      setSelectedReportToTransfer(null);
      setSelectedBarangay("");

    } catch (error) {
      console.error(
        "Failed to transfer report:",
        error.response?.data || error.message
      );
      toast.error("Failed to transfer report. Please try again.");
    }
  };

/*
  const handleStatusChange = async (userId, newStatus) => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      console.log("Logged-in user from localStorage:", user);

      const first_name = user?.firstName || "";
      const last_name = user?.lastName || "";
      console.log("Sending first_name:", first_name, "last_name:", last_name);

      const payload = {
        status: newStatus.toLowerCase(),
        first_name,
        last_name
      };
      console.log("PATCH payload:", payload);

      // Send request to backend
      const response = await axios.patch(
        `/api/brgy/update-barangay-report-status/${userId}`,
        payload
      );

      console.log("Backend response:", response.data);

      // Update state immediately so UI reflects new status
      setIncidentReports(prev =>
        prev.map(user =>
          user.id === userId ? { ...user, status: newStatus } : user
        )
      );
      console.log("Updated local state for user:", userId, "to status:", newStatus);

    } catch (error) {
      if (error.response) {
        console.error(
          `Update failed: ${error.response.status} - ${JSON.stringify(error.response.data)}`
        );
      } else if (error.request) {
        console.error("No response received:", error.request);
      } else {
        console.error("Error:", error.message);
      }
    }
  };
*/


  const openImagesModal = (user) => {
    setModalUser(user);
    setShowImagesModal(true);
  };

  const openLocationModal = (user) => {
    setModalUser(user);
    setShowLocationModal(true);
  };

  const closeModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowImagesModal(false);
      setShowLocationModal(false);
      setModalUser(null);
      setIsClosing(false);
    }, 200);
  };



  // Renders the table or no-data animation
  const renderTable = (incidentReports = []) => {
    if (incidentReports.length === 0) {
      return (
        <div className="no-barangay-wrapper">
          <div className="no-barangay-content">
            <Player
              autoplay
              loop
              src={noBarangayAnim}
              style={{ height: '240px', width: '240px' }}
            />
            <h2 className="no-barangay-title">No Barangay Reports</h2>
            <p className="no-barangay-subtext">
              There are currently no barangay reports available. Please add one to get started.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="table-wrapper">
        <div className="table-scroll"></div>
        <table className="scroll" role="table" aria-label="Incident Reports">
          <thead className="table-head">
            <tr>
                <th className="table-header" style={{ width: '150px' }}>Report ID</th>
                <th className="table-header" style={{ width: '350px' }}>Incident Type</th>
                <th className="table-header" style={{ width: '300px' }}>Date</th>
                <th className="table-header" style={{ width: '150px' }}>Time</th>
                <th className="table-header" style={{ width: '100px' }}>Status</th>
                <th className="table-header" style={{ paddingLeft: '100px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {incidentReports.map((user) => (
              <tr key={user.id} style={{ cursor: 'pointer' }}>
                <td className="table-cell">{`Report-${String(user.id).padStart(5, '0')}`}</td>
                <td className="table-cell">{user.incident_type}</td>

                <td className="table-cell">
                {user.incident_date
                    ? format(new Date(user.incident_date), "EEEE, MMMM dd, yyyy")
                    : ""}
                </td>

                <td className="table-cell">
                  {user.incident_time ? format(new Date(`1970-01-01T${user.incident_time}`), "hh:mm a") : ""}
                </td>

                <td className="table-cell" style={{ minWidth: 160 }}>
                    <Select
                    value={statusOptions.find(opt => opt.value === (user.status || 'pending'))}
                    onChange={(selected) => handleStatusChange(user.id, selected.value)}
                    options={getNextStatusOptions(user.status || 'pending')}
                    styles={updateStatusStyles(user.status || 'pending')}
                    isSearchable={false}
                    isDisabled={getNextStatusOptions(user.status || 'pending').length === 0}
                    />
                </td>

                <td className="table-cell" style={styles.cell}>
                  <div style={styles.row}>
                    {[
                      /*
                        {
                          src: "/icons/delete-row.png",
                          alt: "Delete",
                          action: () => {
                          setReportToDelete(user);
                          setShowDeleteConfirm(true);
                        },
                      },
                      */
                      { src: "/icons/images.png", alt: "View Images", action: () => openImagesModal(user) },
                      { src: "/icons/location.png", alt: "View Location", action: () => openLocationModal(user) },
                        ].map((icon, idx) => (
                          <img
                            key={idx}
                            src={icon.src}
                            alt={icon.alt}
                            style={styles.icon}
                            onClick={(e) => {
                              e.stopPropagation();
                              icon.action();
                            }}
                          onMouseEnter={(e) => bounceEffect(e.currentTarget)}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
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
            className="main-content mainContent-slide-right"
            style={{
              marginLeft: isSidebarCollapsed ? 80 : 270,
              width: isSidebarCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 270px)',
            }}
          >
            <ToastContainer
              position="top-right"
              autoClose={4000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="colored"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: '12px',
                borderRadius: '8px',
              }}
              toastStyle={{
                borderRadius: '8px',
                boxShadow: '0 4px 10px rgba(0, 0, 0, 0.08)',
              }}
            />

            <div className="header-row">
              <h2 className="page-title">Barangay Report Management</h2>
              <div>
                <input
                  type="text"
                  placeholder="Search..."
                  className="search-box"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="section-wrapper">
              <div className="table-section">
                <div className="header-table">
                  <h3 className="section-title">Report Directory</h3>
                  <Select
                    options={sortOptions}
                    value={sortOptions.find((option) => option.value === sortOption)}
                    styles={sortDropdownStyles}
                    isSearchable={false}
                    onChange={(option) => setSortOption(option.value)}
                  />
                </div>
                {renderTable(displayIncidentReports)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteConfirm && reportToDelete && (
        <div
          className="modal-overlay"
          onClick={() => {
            setIsClosing(true);
            setTimeout(() => {
              setShowDeleteConfirm(false);
              setIsClosing(false);
            }, 200);
          }}
        >
          <div
            className={`modal-content ${isClosing ? 'pop-out' : 'pop-in'}`}
            style={{ maxWidth: '350px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src="/icons/close.png"
              alt="Close"
              className="modal-close-btn"
              onClick={() => {
                setIsClosing(true);
                setTimeout(() => {
                  setShowDeleteConfirm(false);
                  setIsClosing(false);
                }, 200);
              }}
            />

            <div className="icon-container">
              <img
                src="/icons/delete.png"
                alt="Delete"
                className="icon-delete"
              />
            </div>

            <h3 className="modal-title" style={{ textAlign: 'center' }}>Delete</h3>
            <p className="sub-title" style={{ textAlign: 'center' }}>Are you sure you want to delete this user account?</p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: '20px',
                paddingLeft: '18px',
                paddingRight: '18px',
                textAlign: 'center'
              }}
            >
              <span className="location-text">
                {reportToDelete?.incident_type
                  ? capitalizeWords(reportToDelete.incident_type)
                  : 'N/A'}
              </span>
            </div>

            <div className="button-container">
              <button
                className="cancel-button"
                onClick={() => {
                  setIsClosing(true);
                  setTimeout(() => {
                    setShowDeleteConfirm(false);
                    setIsClosing(false);
                  }, 200);
                }}
              >
                Cancel
              </button>
              <button
                className="confirm-button"
                onClick={() => deleteIncidentReport(reportToDelete.id)}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW LOCATION MODAL */}
      {showLocationModal && modalUser && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className={`modal-content ${isClosing ? "pop-out" : "pop-in"}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#fff",
              padding: "20px",
              borderRadius: "8px",
              maxWidth: "50%",
              maxHeight: "90%",
              overflow: "auto",
              textAlign: "center",
            }}
          >
            <h2 className="modal-title">
              {`${modalUser.incident_type}`}
            </h2>

            {/* OpenStreetMap section */}
            {modalUser.latitude && modalUser.longitude && (
              <div style={{ height: "300px", marginTop: "20px", borderRadius: "8px", overflow: "hidden", marginBottom: "20px" }}>
                <MapContainer
                  center={[modalUser.latitude, modalUser.longitude]}
                  zoom={15}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={[modalUser.latitude, modalUser.longitude]}>
                    <Popup>{`${modalUser.first_name} ${modalUser.last_name}'s Report Location`}</Popup>
                  </Marker>
                </MapContainer>
              </div>
            )}

            <button onClick={closeModal} className="modal-cancel-button">
              Close
            </button>
          </div>
        </div>
      )}

      {/* VIEW IMAGES MODAL */}
      {showImagesModal && modalUser && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className={`modal-content ${isClosing ? "pop-out" : "pop-in"}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#fff",
              padding: "20px",
              borderRadius: "8px",
              width: "500px",
              height: "600px",
              overflow: "hidden",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              position: "relative",
            }}
          >
            <h2 className="modal-title">{modalUser.incident_type}</h2>
            <div
              style={{
                width: "100%",
                height: "400px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                position: "relative",
                margin: "20px 0",
                overflow: "hidden",
              }}
            >
            {modalUser.media_urls && modalUser.media_urls.length > 0 ? (
              <>
                {modalUser.media_urls[currentImageIndex].match(/\.(jpg|jpeg|png|gif)$/i) ? (
                  <img
                    src={modalUser.media_urls[currentImageIndex]}
                    alt={`Report-${String(modalUser.id).padStart(5, "0")}`}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      borderRadius: "12px",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.15)",
                      objectFit: "contain",
                      cursor: "zoom-in",
                      transition: "transform 0.3s ease",
                    }}
                    onClick={() =>
                      window.open(modalUser.media_urls[currentImageIndex], "_blank")
                    }
                  />
                ) : modalUser.media_urls[currentImageIndex].match(/\.(mp4|webm|ogg)$/i) ? (
                  <video
                    controls
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      borderRadius: "12px",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.15)",
                      objectFit: "contain",
                    }}
                  >
                    <source
                      src={modalUser.media_urls[currentImageIndex]}
                      type="video/mp4"
                    />
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <p style={{ fontStyle: "italic", color: "#999" }}>Unsupported file type</p>
                )}

                {/* Left arrow */}
                {currentImageIndex > 0 && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex(currentImageIndex - 1);
                    }}
                    style={{
                      position: "absolute",
                      left: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: "24px",
                      cursor: "pointer",
                      userSelect: "none",
                      backgroundColor: "rgba(0,0,0,0.3)",
                      color: "#fff",
                      borderRadius: "50%",
                      padding: "5px",
                    }}
                  >
                    &#8592;
                  </div>
                )}

                {/* Right arrow */}
                {currentImageIndex < modalUser.media_urls.length - 1 && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex(currentImageIndex + 1);
                    }}
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: "24px",
                      cursor: "pointer",
                      userSelect: "none",
                      backgroundColor: "rgba(0,0,0,0.3)",
                      color: "#fff",
                      borderRadius: "50%",
                      padding: "5px",
                    }}
                  >
                    &#8594;
                  </div>
                )}
              </>
            ) : (
              <p style={{ fontStyle: "italic", color: "#999" }}>No media available.</p>
            )}
            </div>
            <button
              onClick={closeModal}
              className="modal-cancel-button"
              style={{ marginBottom: "10px" }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* PROOF UPLOAD MODAL */}
      {showProofModal && reportToUpload && (
        <div
          className="modal-overlay"
          onClick={() => {
            setIsClosing(true);
            setTimeout(() => {
              setShowProofModal(false);
              setIsClosing(false);
            }, 200);
          }}
        >
          <div
            className={`modal-content ${isClosing ? 'pop-out' : 'pop-in'}`}
            style={{ maxWidth: '500px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <img
              src="/icons/close.png"
              alt="Close"
              className="modal-close-btn"
              onClick={() => {
                setIsClosing(true);
                setTimeout(() => {
                  setShowProofModal(false);
                  setIsClosing(false);
                }, 200);
              }}
            />

            <h3 className="modal-title" style={{ textAlign: 'center' }}>Upload Proof</h3>
            <p className="sub-title" style={{ textAlign: 'center' }}>
                Please upload images as evidence to support this report.
            </p>

            {/* FILE UPLOAD SECTION */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '15px',
                width: '100%',
              }}
            >
              <span
                style={{
                  fontWeight: 900,
                  fontSize: '1.1rem',
                  color: '#333',
                }}
              >
                {reportToUpload?.incident_type
                  ? capitalizeWords(reportToUpload.incident_type)
                  : 'N/A'}
              </span>

              <label
                style={{
                  width: '100%',
                  padding: '25px',
                  border: '2px dashed #3498db',
                  borderRadius: '12px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.2s, border-color 0.2s',
                  marginBottom: '15px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => setSelectedFiles(e.target.files)}
                  style={{ display: 'none' }}
                />
                <p style={{ margin: 0, color: '#555', fontSize: '0.95rem' }}>
                  Drag & drop files here, or click to select
                </p>

                {/* Preview selected files INSIDE the upload box */}
                {selectedFiles && selectedFiles.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '10px',
                      justifyContent: 'center',
                      maxHeight: '150px',
                      overflowY: 'auto',
                    }}
                  >
                    {Array.from(selectedFiles).map((file, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: 'relative',
                          width: '80px',
                          height: '80px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          background: '#f0f0f0',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        {file.type.startsWith('image') ? (
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <video
                            src={URL.createObjectURL(file)}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation(); // prevent triggering the file input
                            const newFiles = Array.from(selectedFiles).filter((_, i) => i !== idx);
                            setSelectedFiles(newFiles.length ? newFiles : null);
                          }}
                          style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            background: 'rgba(0,0,0,0.6)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            lineHeight: '18px',
                            textAlign: 'center',
                            padding: 0,
                          }}
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </label>
            </div>
            <div className="button-container">
              <button
                className="cancel-button"
                onClick={() => {
                  setIsClosing(true);
                  setTimeout(() => {
                    setShowProofModal(false);
                    setSelectedFiles(null);
                    setIsClosing(false);
                  }, 200);
                }}
              >
                Cancel
              </button>
              <button
                className="confirm-button"
                onClick={handleUploadProof}
              >
                Upload & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHOW TRANSFER MODAL */}
      {showTransferModal && selectedReportToTransfer && (
        <div
          className="modal-overlay"
          onClick={() => {
            setIsClosing(true);
            setTimeout(() => {
              setShowTransferModal(false);
              setIsClosing(false);
              setSelectedReportToTransfer(null);
            }, 200);
          }}
        >
          <div
            className={`modal-content ${isClosing ? 'pop-out' : 'pop-in'}`}
            style={{ maxWidth: '350px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src="/icons/close.png"
              alt="Close"
              className="modal-close-btn"
              onClick={() => {
                setIsClosing(true);
                setTimeout(() => {
                  setShowTransferModal(false);
                  setIsClosing(false);
                  setSelectedReportToTransfer(null);
                }, 200);
              }}
            />
            <h3 className="modal-title" style={{ textAlign: 'center' }}>Transfer Report</h3>
            <p className="sub-title" style={{ textAlign: 'center' }}>
              Select a barangay to transfer this report
            </p>
            <div className="input-group">
              <Select
                options={barangayList
                  .filter(
                    (b) =>
                      !barangayDirectory.some((existing) => {
                        const barangayInDB = existing.barangay_name?.toLowerCase().trim();
                        const barangayFromList = b.name.toLowerCase().trim();
                        return barangayInDB === barangayFromList;
                      })
                  )
                  .map((b) => ({ value: b.name, label: b.name }))}
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
                isSearchable
              />
            </div>
            <div className="button-container">
              <button
                className="cancel-button"
                onClick={() => {
                  setIsClosing(true);
                  setTimeout(() => {
                    setShowTransferModal(false);
                    setIsClosing(false);
                    setSelectedReportToTransfer(null);
                  }, 200);
                }}
              >
                Cancel
              </button>
              <button
                className="confirm-button"
                onClick={handleConfirmTransfer}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const sortDropdownStyles = {
  control: (base) => ({
    ...base,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 0,
    boxShadow: 'none',
    minHeight: '28px',
    height: '28px',
    fontSize: '12px',
    fontWeight: 600,
    width: '150px',
    cursor: 'pointer',
    paddingBottom: '35px',
    marginLeft: 0,
  }),
  singleValue: (base) => ({
    ...base,
    color: '#374856',
  }),
  input: (base) => ({
    ...base,
    color: '#374856',
  }),
  valueContainer: (base) => ({
    ...base,
    height: '28px',
    padding: '0 8px',
  }),
  indicatorsContainer: (base) => ({
    ...base,
    height: '28px',
  }),
  indicatorSeparator: () => ({
    display: 'none',
  }),
  dropdownIndicator: (base) => ({
    ...base,
    color: '#374856',
  }),
  menu: (base) => ({
    ...base,
    fontSize: '12px',
    zIndex: 99,
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? '#e7f0fa' : 'white',
    color: '#374856',
    cursor: 'pointer',
    fontSize: '12px',
  }),
};

const updateStatusStyles = (status) => {
  const color = getStatusColor(status);
  return {
    control: (provided, state) => ({
      ...provided,
      minWidth: 40,
      borderRadius: 7,
      borderColor: color,
      boxShadow: state.isFocused ? `0 0 0 1.5px ${color}` : 'none',
      cursor: 'pointer',
      backgroundColor: state.isFocused
        ? color + '40'
        : color + '20',
      transition: 'border-color 0.3s ease, background-color 0.3s ease',
      fontSize: '12px',
      textAlign: 'center',
      minHeight: 25,
      height: 24,
      padding: '0 10px',
      color: color,
    }),
    singleValue: (provided) => ({
      ...provided,
      color: color,
      fontWeight: 600,
      textTransform: 'capitalize',
      fontSize: '12px',
    }),
    menu: (provided) => ({
      ...provided,
      borderRadius: 6,
      fontSize: '12px',
    }),
    indicatorsContainer: () => ({
      display: 'none',
    }),
    option: (provided, state) => ({
      ...provided,
      textTransform: 'capitalize',
      backgroundColor: state.isFocused ? color + '30' : 'white',  // slightly lighter on hover
      color: state.isFocused ? color : 'black',
      cursor: 'pointer',
      fontSize: '12px',
      padding: '6px 10px',
    }),
  };
};

const styles = {
  cell: { padding: "4px", paddingLeft: "100px", paddingRight: "30px" },
  row: { display: "flex", alignItems: "center", gap: "15px" },
  icon: {
    width: "20px",
    height: "20px",
    cursor: "pointer",
    transition: "transform 0.15s ease",
  },
};

const bounceEffect = (el) => {
  el.style.transform = "translateY(-6px)";
  setTimeout(() => (el.style.transform = "translateY(2px)"), 150);
  setTimeout(() => (el.style.transform = "translateY(-2px)"), 300);
  setTimeout(() => (el.style.transform = "translateY(0)"), 450);
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

