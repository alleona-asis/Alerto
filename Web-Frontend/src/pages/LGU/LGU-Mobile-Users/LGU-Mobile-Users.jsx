import { useState, useEffect, useMemo } from "react";
import LGUNavbar from '../../../components/NavBar/LGU-Navbar';
import LGUSidebar from '../../../components/SideBar/LGU-Sidebar';
import '../../../components/SideBar/styles.css';
import Select from 'react-select';
import { ToastContainer, toast } from 'react-toastify';
import { Player } from '@lottiefiles/react-lottie-player';
import noBarangayAnim from '@/assets/animations/non data found.json';
import axios from "../../../axios/axiosInstance";
import { io } from 'socket.io-client';
import L from "leaflet";
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});


const getStatusColor = (status) => {
  switch (status.toLowerCase()) {
    case 'verified': return '#2E7D32';
    case 'unverified': return '#D32F2F';
    default: return '#000000';
  }
};

const fetchUserDetails = async (id) => {
  const { data } = await axios.get(`/api/auth/mobile-user-profile/${id}`);
  return data;
};

export default function LGUMobileUsers() {
  const userId = localStorage.getItem("userId");
  const token = localStorage.getItem("token");
  const [profile, setProfile] = useState(null);

  const socket = useMemo(
    () => io(import.meta.env.VITE_SOCKET_URL),
    []
  );

  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mobileUsers, setMobileUsers] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState("last-name-asc");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  const [isClosing, setIsClosing] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [activeMiniTab, setActiveMiniTab] = useState("details");

  // Helpers
  const capitalizeWords = (str) =>
    str?.toLowerCase().replace(/\b\w/g, char => char.toUpperCase()) || '';

  const fileUrl = (u) => {
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    const BASE_URL = window.location.origin; 
    return `${BASE_URL}/${String(u).replace(/^\/+/, '')}`;
  };

  const statusOptions = [
    { value: "verified", label: "Verified" },
    { value: "unverified", label: "Unverified" },
  ];

  const sortOptions = [
    { value: 'last-name-asc', label: 'Sort by Last Name' },
    { value: 'date-desc', label: 'Sort by Date' },
    { value: 'status-asc', label: 'Sort by Status' },
    { value: 'id-asc', label: 'Sort by ID' },
    { value: 'barangay-asc', label: 'Sort by Barangay' },
  ];

  // Sorting function
  const sortMobileUsers = (users, option) => {
    const sorted = [...users];
    switch (option) {
      case 'last-name-asc':
        return sorted.sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''));
      case 'date-desc':
        return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      case 'status-asc':
        return sorted.sort((a, b) => (a.status || '').localeCompare(b.status || ''));
      case 'barangay-asc':
        return sorted.sort((a, b) => (a.barangay || '').localeCompare(b.barangay || ''));
      case 'id-asc':
        return sorted.sort((a, b) => (a.id || 0) - (b.id || 0));
      default:
        return sorted;
    }
  };

  // Filtering function
  const filterMobileUsers = (users) => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return users;

    return users.filter((user) => {
      const idStr =
        user.id != null ? `USER-${String(user.id).padStart(5, '0')}` : '';

      const haystack = [
        idStr,
        user.status,
        user.barangay,
        user.first_name,
        user.last_name,
      ]
        .filter((v) => v != null && v !== '')
        .map((v) => String(v).toLowerCase());

      return haystack.some((s) => s.includes(q));
    });
  };


  // Memoized filtered + sorted reports
  const displayMobileUsers = useMemo(() => {
    const filtered = filterMobileUsers(mobileUsers);
    return sortMobileUsers(filtered, sortOption);
  }, [mobileUsers, searchQuery, sortOption]);


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

  // =================================================
  //  FETCH ALL MOBILE USERS BY LOCATION
  // =================================================
  const fetchMobileUsers = async (region, province, city) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await axios.get("/api/lgu/get-lgu-mobile-users", {
        headers: { Authorization: `Bearer ${token}` },
        params: { region, province, city },
      });

      setMobileUsers(res.data || []);
    } catch (error) {
      console.error("Failed to fetch users:", error?.response?.data?.message || error.message);
      setMobileUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profile) {
      console.log("Profile not set.");
      return;
    }

    const { region, province, city } = profile;
    if (region && province && city) {
      fetchMobileUsers(region, province, city);
    } else {
      console.warn("Profile missing location. Skipping fetch.");
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
        newReport.city === profile.city
      ) {
        setMobileUsers((prev) => {
          if (prev.some((r) => r.id === newReport.id)) return prev;
          return [newReport, ...prev];
        });
      } else {
        console.log("Report ignored due to different location:", newReport.city);
      }
    };

    socket.on("newBarangayReport", handleNewReport);
    return () => socket.off("newBarangayReport", handleNewReport);
  }, [socket, profile]);



  // =================================================
  //  DELETE REPORT
  // =================================================
  const deleteMobileUser = async (id) => {
    try {
      const response = await axios.delete(
        `/api/lgu/delete-mobile-user/${id}`
      );
      setMobileUsers((prev) => prev.filter((r) => r.id !== id));
      setShowDeleteConfirm(false);
      setUserToDelete(null);
      toast.success(response.data?.message || "Report successfully deleted.");
    } catch (error) {
      toast.error("Failed to delete report. Please try again.");
    }
  };


  const renderTable = (mobileUsers = []) => {
    if (mobileUsers.length === 0) {
      return (
        <div className="no-barangay-wrapper">
          <div className="no-barangay-content">
            <Player
              autoplay
              loop
              src={noBarangayAnim}
              style={{ height: '240px', width: '240px' }}
            />
            <h2 className="no-barangay-title">No Mobile Users Found</h2>
            <p className="no-barangay-subtext">
              There are no mobile users to display at the moment.
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
                <th className="table-header" style={{ width: '150px' }}>User ID</th>
                <th className="table-header" style={{ width: '300px' }}>Full Name</th>
                <th className="table-header" style={{ width: '300px' }}>Barangay</th>
                <th className="table-header" style={{ width: '100px' }}>Status</th>
                <th className="table-header" style={{ paddingLeft: '100px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {mobileUsers.map((user) => (
              <tr
                key={user.id}
                style={{ cursor: 'pointer' }}
                onClick={async () => {
                    try {
                      const full = await fetchUserDetails(user.id);
                      setSelectedUser(full);    
                      setActiveMiniTab('details');
                      setShowDetailsModal(true);
                    } catch {
                      toast.error('Failed to load user details.');
                    }
                  }}
              >
                <td className="table-cell">
                  {`USER-${String(user.id).padStart(5, '0')}`}
                </td>
                <td className="table-cell">{user.last_name}, {user.first_name} {user.middle_name}</td>

                <td className="table-cell">{user.barangay}</td>


                {/* Status select */}
                <td className="table-cell" style={{ minWidth: 130 }}>
                  <Select
                    value={statusOptions.find(opt => opt.value === (user.status || 'pending'))}
                    options={(user.status || 'pending')}
                    styles={updateStatusStyles(user.status || 'pending')}
                    isSearchable={false}
                    isDisabled={true}
                  />
                </td>

                {/* Delete icon */}
                <td className="table-cell" style={styles.cell}>
                  <div style={styles.row}>
                    {[
                      {
                        src: "/icons/delete-row.png",
                        alt: "Delete",
                        action: () => {
                          setUserToDelete(user);
                          setShowDeleteConfirm(true);
                        },
                      },
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
          <LGUNavbar />
        </div>

        <div className="layout">
          <LGUSidebar
            isCollapsed={isSidebarCollapsed}
            toggleSidebar={() => setSidebarCollapsed(!isSidebarCollapsed)}
          />

          <div
            className="main-content mainContent-slide-right"
            style={{
              marginLeft: isSidebarCollapsed ? 80 : 300,
              width: isSidebarCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 300px)',
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
              <h2 className="page-title">Mobile Users</h2>
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
                  <h3 className="section-title">User Directory</h3>
                  <Select
                    options={sortOptions}
                    value={sortOptions.find((option) => option.value === sortOption)}
                    styles={sortDropdownStyles}
                    isSearchable={false}
                    onChange={(option) => setSortOption(option.value)}
                  />
                </div>
                {renderTable(displayMobileUsers)}
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteConfirm && userToDelete && (
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
              <img src="/icons/delete.png" alt="Delete" className="icon-delete" />
            </div>

            <h3 className="modal-title" style={{ textAlign: 'center' }}>Delete</h3>
            <p className="sub-title" style={{ textAlign: 'center' }}>
              Are you sure you want to delete this user?
            </p>

            <div className="location-text" style={{ textAlign: 'center', marginBottom: "12px" }}>
              {userToDelete
                ? `${userToDelete.first_name ? capitalizeWords(userToDelete.first_name) : ''} 
                  ${userToDelete.middle_name ? capitalizeWords(userToDelete.middle_name) : ''} 
                  ${userToDelete.last_name ? capitalizeWords(userToDelete.last_name) : ''}`.trim()
                : 'N/A'}
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
                onClick={() => deleteMobileUser(userToDelete.id)}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHOW DETAILS MODAL */}
      {showDetailsModal && selectedUser && (
        <div
          className="modal-overlay"
          onClick={() => {
            setIsClosing(true);
            setTimeout(() => {
              setShowDetailsModal(false);
              setIsClosing(false);
            }, 200);
          }}
        >
          <div
            className={`modal-content ${isClosing ? 'pop-out' : 'pop-in'}`}
            style={{ maxWidth: '500px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src="/icons/close.png"
              alt="Close"
              className="modal-close-btn"
              onClick={() => {
                setIsClosing(true);
                setTimeout(() => {
                  setShowDetailsModal(false);
                  setIsClosing(false);
                }, 200);
              }}
            />

            <h3 className="modal-title" style={{ textAlign: 'center' }}>
              Mobile User Details
            </h3>

            {/* MINI NAVBAR */}
            <div
              className="mini-navbar"
              role="tablist"
              aria-label="Mobile user details tabs"
              style={{
                display: 'flex',
                gap: 24,
                margin: '15px 0',
                borderBottom: '1px solid #eee',
                overflowX: 'auto',
                paddingBottom: 2,
              }}
            >
              {[
                { id: 'details', label: 'Details' },
                { id: 'id', label: 'Submitted ID' },
                { id: 'selfie', label: 'Selfie' },
              ].map((tab) => {
                const isActive = activeMiniTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`panel-${tab.id}`}
                    id={`tab-${tab.id}`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => setActiveMiniTab(tab.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '10px 4px',
                      cursor: 'pointer',
                      fontFamily: 'Poppins, sans-serif',
                      fontSize: 14,
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? '#0b63ff' : '#555',
                      borderBottom: isActive ? '2px solid #0b63ff' : '2px solid transparent',
                      transition: 'color .15s ease, border-bottom-color .15s ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* DETAILS PANEL */}
            {activeMiniTab === 'details' && (
              <div
                role="tabpanel"
                id="panel-details"
                aria-labelledby="tab-details"
                className="modal-body"
                style={{
                  padding: '20px 25px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '14px',
                  color: '#374856',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="modal-label">Full Name:</span>
                  <span className="modal-value">
                    <b>
                      {selectedUser.first_name} {selectedUser.middle_name} {selectedUser.last_name}
                    </b>
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="modal-label">Username:</span>
                  <span className="modal-value"><b>{selectedUser.username}</b></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="modal-label">Home Address:</span>
                  <span className="modal-value"><b>{selectedUser.home_address}</b></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="modal-label">Barangay:</span>
                  <span className="modal-value"><b>{selectedUser.barangay}</b></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="modal-label">Phone Number:</span>
                  <span className="modal-value"><b>{selectedUser.phone_number}</b></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="modal-label">Date of Birth:</span>
                  <span className="modal-value">
                    <b>
                      {selectedUser.date_of_birth
                        ? new Date(selectedUser.date_of_birth).toLocaleDateString('en-US')
                        : ''}
                    </b>
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="modal-label">Age:</span>
                  <span className="modal-value">
                    <b>
                      {selectedUser.date_of_birth
                        ? Math.floor(
                            (new Date() - new Date(selectedUser.date_of_birth)) /
                              (1000 * 60 * 60 * 24 * 365.25)
                          )
                        : ''}
                    </b>
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="modal-label">Sex:</span>
                  <span className="modal-value">
                    <b>
                      {selectedUser.sex
                        ? selectedUser.sex.charAt(0).toUpperCase() + selectedUser.sex.slice(1)
                        : ''}
                    </b>
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="modal-label">Civil Status:</span>
                  <span className="modal-value"><b>{selectedUser.civil_status}</b></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="modal-label">Account Created:</span>
                  <span className="modal-value">
                    <b>
                      {selectedUser.created_at
                        ? new Date(selectedUser.created_at).toLocaleDateString('en-US')
                        : ''}
                    </b>
                  </span>
                </div>
              </div>
            )}

            {/* SUBMITTED ID PANEL */}
            {activeMiniTab === 'id' && (
              <div
                role="tabpanel"
                id="panel-id"
                aria-labelledby="tab-id"
                className="modal-body"
                style={{ padding: '16px 20px' }}
              >
                {(!selectedUser.id_front_url && !selectedUser.id_back_url) ? (
                  <p style={{ margin: 0, color: '#6b7280' }}>No ID uploaded.</p>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 12,
                    }}
                  >
                    {selectedUser.id_front_url && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: 8,
                          padding: 8,
                          background: '#fafafa',
                        }}>
                          <img
                            src={fileUrl(selectedUser.id_front_url)}
                            alt="ID Front"
                            style={{
                              width: '100%',
                              height: 180,
                              objectFit: 'contain',
                              borderRadius: 6,
                              display: 'block',
                            }}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            onClick={() => window.open(fileUrl(selectedUser.id_front_url), '_blank')}
                          />
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: '#374151' }}>Front</div>
                      </div>
                    )}

                    {selectedUser.id_back_url && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: 8,
                          padding: 8,
                          background: '#fafafa',
                        }}>
                          <img
                            src={fileUrl(selectedUser.id_back_url)}
                            alt="ID Back"
                            style={{
                              width: '100%',
                              height: 180,
                              objectFit: 'contain',
                              borderRadius: 6,
                              display: 'block',
                            }}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            onClick={() => window.open(fileUrl(selectedUser.id_back_url), '_blank')}
                          />
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: '#374151' }}>Back</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SELFIE PANEL */}
            {activeMiniTab === 'selfie' && (
              <div
                role="tabpanel"
                id="panel-selfie"
                aria-labelledby="tab-selfie"
                className="modal-body"
                style={{ padding: '16px 20px' }}
              >
                {!selectedUser.selfie_url ? (
                  <p style={{ margin: 0, color: '#6b7280' }}>No selfie uploaded.</p>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        padding: 8,
                        background: '#fafafa',
                      }}
                    >
                      <img
                        src={fileUrl(selectedUser.selfie_url)}
                        alt="Selfie"
                        style={{
                          width: '100%',
                          height: 260,
                          objectFit: 'contain',
                          borderRadius: 6,
                          display: 'block',
                        }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        onClick={() => window.open(fileUrl(selectedUser.selfie_url), '_blank')}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
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
      backgroundColor: state.isFocused ? color + '30' : 'white',
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
    width: "25px",
    height: "25px",
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


