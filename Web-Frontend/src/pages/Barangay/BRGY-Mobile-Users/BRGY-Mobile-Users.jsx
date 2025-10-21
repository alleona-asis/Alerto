import { useState, useEffect, useMemo } from 'react';
import axios from '../../../axios/axiosInstance';
import BRGYNavbar from '../../../components/NavBar/BRGY-Navbar';
import BRGYSidebar from '../../../components/SideBar/BRGY-Sidebar';
import { ToastContainer, toast } from 'react-toastify';
import { Player } from '@lottiefiles/react-lottie-player';
import noData from '@/assets/animations/non data found.json';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable'
import { io } from 'socket.io-client';
import '../../Barangay/BRGY-Mobile-Users/BRGY-Mobile-Users.css';


const getStatusColor = (status) => {
  switch (status.toLowerCase()) {
    case 'pending': return '#FEBE8C';
    case 'verified': return '#BCE29E';
    case 'unverified': return '#FF8787';
    default: return '#52575D';
  }
};

export default function BRGY_MobileUsers() {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  const [BRGYProfile, setBRGYProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mobileUsers, setMobileUsers] = useState([]);

  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [username, setUsername] = useState('');
  const [viewInformationModal , setViewInformationModal ] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingSortOption, setPendingSortOption] = useState('default');
  const [approvedSortOption, setApprovedSortOption] = useState('default');

  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [activeTab, setActiveTab] = useState('id');
  const [idSide, setIdSide] = useState('front');
  const [selectedDocumentUser , setSelectedDocumentUser ] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);

  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [userToApprove, setUserToApprove] = useState(null);
  const s = (v) => String(v ?? '').toLowerCase();

  // =================================================
  //  SOCKET CONNECTION AND LISTENER
  // =================================================
  const socket = useMemo(
    () => io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000", {
      transports: ["websocket", "polling"],
      withCredentials: true,
    }), 
    []
  );

  useEffect(() => {
    if (!BRGYProfile?.barangay) return;

    const handleIncomingUser = (incomingUser) => {
      let isNewUser = false;

      setMobileUsers((prevUsers) => {
        const id = incomingUser.id || incomingUser.userId;
        const index = prevUsers.findIndex(u => u.id === id);

        if (index !== -1) {
          const updatedUsers = [...prevUsers];
          updatedUsers[index] = { 
            ...updatedUsers[index], 
            ...incomingUser, 
            status: incomingUser.status || updatedUsers[index].status || 'unverified' 
          };
          return updatedUsers;
        }

        isNewUser = true;
        return [{ 
          id, 
          ...incomingUser, 
          status: incomingUser.status || 'unverified' 
        }, ...prevUsers];
      });

      if (isNewUser) {
        toast.info(`New mobile user registered`, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      }
    };

    socket.on('mobileUserRegistered', handleIncomingUser);

    socket.on('newVerificationRequest', (data) => {
      handleIncomingUser(data);
      toast.info(`New verification request`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    });

    return () => {
      socket.off('mobileUserRegistered', handleIncomingUser);
      socket.off('newVerificationRequest');
    };
  }, [socket, BRGYProfile]);


  // =================================================
  //  FETCH BARANGAY PROFILE
  // =================================================
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

  // =================================================
  //  FETCH MOBILE USERS BASED ON PROFILE
  // =================================================
  const fetchMobileUsers = async () => {
    if (!BRGYProfile) return;
    const { region, province, city, barangay } = BRGYProfile;

    if (!region || !province || !city || !barangay) return;

    setLoading(true);
    try {
      const response = await axios.get('api/brgy/mobile-user-registry', {
        params: { region, province, city, barangay },
      });
      setMobileUsers(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load mobile users.');
      setMobileUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && BRGYProfile) {
      fetchMobileUsers();
    }
  }, [token, BRGYProfile]);

  // =================================================
  //  SORT FUNCTION
  // =================================================
  const [sortOption, setSortOption] = useState('first-name-asc');
  const sortOptions = [
    { value: 'first-name-asc', label: 'Sort by First Name' },
    { value: 'last-name-asc', label: 'Sort by Last Name' },
    { value: 'middle-name-asc', label: 'Sort by Middle Name' },
    { value: 'status-asc', label: 'Sort by Status' },
    { value: 'id-asc', label: 'Sort by ID' },
  ];

  const sortMobileUsers = (users, option) => {
    const sorted = [...users];
    switch (option) {
      case 'first-name-asc':
        return sorted.sort((a, b) => (a.first_name || '').localeCompare(b.first_name || ''));
      case 'last-name-asc':
        return sorted.sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''));
      case 'middle-name-asc':
        return sorted.sort((a, b) => (a.middle_name || '').localeCompare(b.middle_name || ''));
      case 'status-asc':
        return sorted.sort((a, b) => (a.status || '').localeCompare(b.status || ''));
      case 'id-asc':
        return sorted.sort((a, b) => (a.id || 0) - (b.id || 0));
      default:
        return sorted;
    }
  };

  // =================================================
  //  SEARCH, APPLY FILTER, THEN SORT
  // =================================================
  const filterMobileUsers = (users) => {
    const query = s(searchQuery).trim();
    if (!query) return users;
    return users.filter((user) =>
      s(user.first_name).includes(query) ||
      s(user.middle_name).includes(query) ||
      s(user.last_name).includes(query) ||
      s(user.phone_number).includes(query) ||
      s(user.status).includes(query) ||
      s(`USER-${String(user.id).padStart(5, '0')}`).includes(query)
    );
  };


  const displayMobileUsers = useMemo(() => {
    const filtered = filterMobileUsers(mobileUsers);
    return sortMobileUsers(filtered, sortOption);
  }, [mobileUsers, searchQuery, sortOption]);

  const displayPendingUsers = useMemo(
    () => sortMobileUsers(displayMobileUsers.filter(u => s(u.status) === 'pending'), pendingSortOption),
    [displayMobileUsers, pendingSortOption]
  );

  const displayDirectoryUsers = useMemo(
    () => sortMobileUsers(
      displayMobileUsers.filter(u => {
        const st = s(u.status);
        return st === 'verified' || st === 'unverified';
      }),
      approvedSortOption
    ),
    [displayMobileUsers, approvedSortOption]
  );

  const filteredMobileUsers = filterMobileUsers(mobileUsers);
  const sortedMobileUsers = sortMobileUsers(filteredMobileUsers, sortOption);

  // =================================================
  //  UPDATE MOBILE USER STATUS
  // =================================================
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const handleStatusChange = (userId, newStatus) => {
    const user = mobileUsers.find(u => u.id === userId);
    if (!user) return;

    if (newStatus.toLowerCase() === 'unverified') {
      setSelectedUser(user);
      setReason('');
      setShowReasonModal(true);
      return;
    }

    updateUserStatus(userId, newStatus);
  };

  const rejectionOptions = [
    { value: 'Invalid ID / Documents', label: 'Invalid ID / Documents' },
    { value: 'Duplicate Account', label: 'Duplicate Account' },
    { value: 'Incorrect Information', label: 'Incorrect Information' },
  ];

  const updateUserStatus = async (userId, newStatus, rejectionReason = null) => {
    try {
      await axios.patch(`/api/brgy/update-mobile-user-status/${userId}`, {
        status: newStatus.toLowerCase(),
        reason_for_rejection: rejectionReason || null,
      });

      setMobileUsers(prev =>
        prev.map(user =>
          user.id === userId
            ? { ...user, status: newStatus, reason: rejectionReason }
            : user
        )
      );

      toast.success(`User ${newStatus.toLowerCase()} successfully.`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to update status.');
    }
  };

  // =================================================
  //  DELETE ACCOUNT
  // =================================================
  const [userToDelete, setUserToDelete] = useState(null);
  const deleteMobileUser = async (id) => {
    try {
      const response = await axios.delete(`/api/brgy/delete-mobile-user/${id}`);

      setMobileUsers(prev => prev.filter(user => user.id !== id));
      setShowDeleteConfirm(false);
      setUserToDelete(null);

      toast.success(response.data?.message || 'User successfully deleted.');
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
      toast.error(data?.message || 'Failed to delete user. Please try again.');
    }
  };

  // =================================================
  //  RENDER THE TABLE
  // =================================================
  const renderTable = (mobileUsers, isPending = false) => {
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
              There are currently no mobile user records available.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="table-wrapper">
        <div className="table-scroll">
          <table className="table" role="table" aria-label="Mobile Users">
            <thead className="table-head">
              <tr>
                <th className="table-header" style={{ width: '180px' }}>User ID</th>
                <th className="table-header" style={{ width: '200px' }}>Last Name</th>
                <th className="table-header" style={{ width: '200px' }}>First Name</th>
                <th className="table-header" style={{ width: '200px' }}>Middle Name</th>
                <th className="table-header" style={{ width: '250px' }}>Contact Number</th>
                <th className="table-header"style={{ width: '200px' }}>Documents</th>
                <th className="table-header" style={{ width: '100px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {mobileUsers.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => {
                    setSelectedAccount(user);
                    setViewInformationModal(true);
                  }}
                  style={{ cursor: 'pointer' }}
                  className="hoverable-row"
                >
                  <td className="table-cell">{`USER-${String(user.id).padStart(5, '0')}`}</td>
                  <td className="table-cell">{user.last_name}</td>
                  <td className="table-cell">{user.first_name}</td>
                  <td className="table-cell">{user.middle_name}</td>
                  <td className="table-cell">{user.phone_number}</td>
                  <td className="table-cell">
                    <img
                      src="/icons/view.png"
                      alt="View Documents"
                      className="icon-button icon-hover-effect"
                      style={{ cursor: "pointer", marginLeft: 28 }}
                      onClick={(e) => {
                        e.stopPropagation();

                        if (user.status === "unverified") {
                          toast.info("This user is not verified.", {
                            position: "top-right",
                            autoClose: 5000,
                            hideProgressBar: false,
                            closeOnClick: true,
                            pauseOnHover: true,
                            draggable: true,
                          });
                          return;
                        }
                        setSelectedDocumentUser(user);
                        setShowDocumentsModal(true);
                      }}
                    />
                  </td>
                  <td className="table-cell" style={{ minWidth: 130 }}>
                    <span
                      style={{
                        width: "110px",
                        height: "25px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "7px",
                        fontSize: "12px",
                        fontWeight: 600,
                        textTransform: "capitalize",
                        backgroundColor: getStatusColor(user.status || "pending") + "20",
                        color: getStatusColor(user.status || "pending"),
                        border: `1px solid ${getStatusColor(user.status || "pending")}`,
                        textAlign: "center",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {user.status || "pending"}
                    </span>

                  </td>
                  <td
                    className="table-cell"
                    style={{ display: "flex", alignItems: "center", gap: "8px", paddingLeft: 100 }}
                  >
                    {isPending ? (
                      <>
                        <img
                          src="/icons/approve.png"
                          alt="Approve"
                          className="icon-button icon-hover-effect"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUserToApprove(user);
                            setShowApproveConfirm(true);
                          }}
                          style={{
                            marginTop: 2,
                          }}
                        />
                        <img
                          src="/icons/reject.png"
                          alt="Reject"
                          className="icon-button icon-hover-effect"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUser(user);
                            setReason("");
                            setShowReasonModal(true);
                          }}
                          style={{
                            marginTop: 2,
                          }}
                        />
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };


  return (
    <div className="wrapper">
      <div className="navbar">
        <BRGYNavbar />
      </div>
      <div className="layout">
        <BRGYSidebar 
          username={username}
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
            <h2 className="page-title">Mobile User Management</h2>
            <input
              type="text"
              placeholder="Search..."
              className="search-box"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="section-wrapper">
            {/* Pending Section */}
            <div className="pending-section">
              <div className="header-table">
                <h3 className="section-title">Verification Requests</h3>
                <Select
                  options={sortOptions}
                  defaultValue={sortOptions[0]}
                  styles={dropdownStyles}
                  isSearchable={false}
                  onChange={(option) => setPendingSortOption(option.value)}
                />
              </div>

              {displayPendingUsers.length > 0 ? (
                renderTable(displayPendingUsers, true)
              ) : (
                <div style={{ textAlign: 'center', padding: '1rem' }}>
                  <div style={{ maxWidth: '100%', width: '220px', margin: '0 auto' }}>
                    <Player autoplay loop src={noData} style={{ width: '100%', height: 'auto' }} />
                  </div>
                  <h2 style={{ fontSize: '16px', color: '#374856', margin: 0 }}>
                    No Pending Tasks
                  </h2>
                  <p style={{ fontSize: '14px', color: '#8696BB' }}>
                    You're all caught up. There are no pending accounts to review.
                  </p>
                </div>
              )}
            </div>

            {/* Directory Section */}
            <div className="approved-section">
              <div className="header-table">
                <h3 className="section-title">Mobile User Directory</h3>

                <Select
                  options={sortOptions}
                  value={sortOptions.find((opt) => opt.value === approvedSortOption)}
                  styles={dropdownStyles}
                  isSearchable={false}
                  onChange={(option) => setApprovedSortOption(option.value)}
                />
              </div>

              {displayDirectoryUsers.length > 0 ? (
                renderTable(displayDirectoryUsers, false)
              ) : (
                <div style={{ textAlign: 'center', marginTop: '40px' }}>
                  <Player
                    autoplay
                    loop
                    src={noData}
                    style={{ height: '220px', width: '220px', margin: '0 auto' }}
                  />
                  <h2 style={{ fontSize: '16px', color: '#374856', margin: 0 }}>
                    No Mobile Users Found
                  </h2>
                  <p style={{ fontSize: '14px', color: '#8696BB' }}>
                    There are currently no mobile user records available.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showDeleteConfirm && userToDelete && (
        <div className="overlay modal-fade" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowDeleteConfirm(false)}>×</button>

            <div className="icon-container">
              <img
                src="/icons/delete.png"
                alt="Delete"
                className="icon-delete"
              />
            </div>

            <h3 className="modal-title">Delete</h3>
            <p className="sub-title">Are you sure you want to delete this account?</p>

            <div style={{ display: 'flex', marginBottom: '20px', paddingLeft: '18px', paddingRight: '18px' }}>
                <span className="location-text">
                  {(userToDelete.first_name)},&nbsp;
                  {(userToDelete.last_name)},&nbsp;
                </span>
            </div>

            <div className="button-container">
              <button
                className="cancel-button"
                onClick={() => setShowDeleteConfirm(false)}
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

      {showReasonModal && selectedUser && (
        <div className="overlay modal-fade" onClick={() => setShowReasonModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowReasonModal(false)}>×</button>

            <div className="icon-container">
              <img src="/icons/reject.png" alt="Reject" className="icon-reject" />
            </div>

            <h3 className="modal-title">Reject Verification</h3>
            <p className="sub-title">Please select a reason for rejecting this request</p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: '20px',
              }}
            >
              <span className="location-text">
                {selectedUser.first_name} {selectedUser.last_name}
              </span>
            </div>

            <CreatableSelect
              value={
                rejectionOptions.find(opt => opt.value === reason) ||
                (reason ? { value: reason, label: reason } : null)
              }
              onChange={(option) => setReason(option.value)}
              options={[...rejectionOptions, { value: 'Other', label: 'Other' }]}
              styles={reasondropdownStyles}
              placeholder="Select or type a reason..."
              isClearable
            />

            {reason === 'Other' && (
              <textarea
                placeholder="Enter custom reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '20px',
                  paddingTop: '10px',
                  fontSize: '14px',
                  borderRadius: '8px',
                  border: '1px solid #ccc',
                  resize: 'vertical',
                  fontFamily: 'Poppins, sans-serif',
                  marginBottom: '10px'
                }}
              />
            )}

            <div className="button-container">
              <button className="cancel-button" onClick={() => setShowReasonModal(false)}>
                Cancel
              </button>

              <button
                className="confirm-button"
                onClick={() => {
                  if (!selectedUser) return;
                  const finalReason = reason === 'Other' ? customReason : reason;
                  if (!finalReason) return;
                  updateUserStatus(selectedUser.id, 'unverified', finalReason);
                  setShowReasonModal(false);
                  setSelectedUser(null);
                  setReason('');
                  setCustomReason('');
                }}
                disabled={reason === 'Other' ? !customReason.trim() : !reason}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showDocumentsModal && selectedDocumentUser && (
        <div className="overlay modal-fade" onClick={() => setShowDocumentsModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowDocumentsModal(false)}>×</button>

            {/* Mini-navbar tabs */}
            <div style={{ display: 'flex', justifyContent: 'center', borderBottom: '1px solid #ccc', marginBottom: '15px' }}>
              <span
                onClick={() => setActiveTab('id')}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '10px',
                  cursor: 'pointer',
                  fontWeight: activeTab === 'id' ? 'bold' : 'normal',
                  borderBottom: activeTab === 'id' ? '3px solid #007bff' : 'none',
                }}
              >
                Submitted ID
              </span>
              <span
                onClick={() => setActiveTab('selfie')}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '10px',
                  cursor: 'pointer',
                  fontWeight: activeTab === 'selfie' ? 'bold' : 'normal',
                  borderBottom: activeTab === 'selfie' ? '3px solid #007bff' : 'none',
                }}
              >
                Selfie Taken
              </span>
            </div>

            {/* Controls */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                margin: '12px 0 16px',
                textAlign: 'center',
              }}
            >
              <button
                onClick={() => setRotation((prev) => prev - 90)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d0d7de',
                  background: '#f6f8fa',
                  color: '#374856',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                ⟲ Rotate Left
              </button>

              <button
                onClick={() => setRotation((prev) => prev + 90)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d0d7de',
                  background: '#f6f8fa',
                  color: '#374856',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                ⟳ Rotate Right
              </button>

              <button
                onClick={() => setScale((prev) => prev + 0.2)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d0d7de',
                  background: '#f6f8fa',
                  color: '#374856',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                ＋ Zoom In
              </button>

              <button
                onClick={() => setScale((prev) => Math.max(0.2, prev - 0.2))}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d0d7de',
                  background: '#f6f8fa',
                  color: '#374856',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                － Zoom Out
              </button>

              <button
                onClick={() => { setRotation(0); setScale(1); }}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d0d7de',
                  background: '#f6f8fa',
                  color: '#374856',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                Reset
              </button>
            </div>


            {/* Tab content */}
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              {activeTab === 'id' ? (
                selectedDocumentUser.id_front_url || selectedDocumentUser.id_back_url ? (
                  <img
                    src={idSide === 'front' ? selectedDocumentUser.id_front_url : selectedDocumentUser.id_back_url}
                    alt={`ID ${idSide}`}
                    style={{
                      width: '200px',
                      borderRadius: '8px',
                      border: '1px solid #ccc',
                      cursor: 'pointer',
                      transform: `rotate(${rotation}deg) scale(${scale})`,
                      transition: 'transform 0.3s ease',
                    }}
                    onClick={() => setIdSide(idSide === 'front' ? 'back' : 'front')}
                  />
                ) : (
                  <span style={{ color: '#ccc' }}>No ID uploaded</span>
                )
              ) : selectedDocumentUser.selfie_url ? (
                <img
                  src={selectedDocumentUser.selfie_url}
                  alt="Selfie"
                  style={{
                    width: '200px',
                    borderRadius: '8px',
                    border: '1px solid #ccc',
                    transform: `rotate(${rotation}deg) scale(${scale})`,
                    transition: 'transform 0.3s ease',
                  }}
                />
              ) : (
                <span style={{ color: '#ccc' }}>No selfie uploaded</span>
              )}
            </div>

            <div className="button-container" style={{ textAlign: 'right', marginTop: '20px' }}>
              <button className="cancel-button" onClick={() => setShowDocumentsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {viewInformationModal && selectedAccount && (
        <div className="overlay modal-fade" onClick={() => setViewInformationModal(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '600px',
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '30px',
              boxSizing: 'border-box',
            }}
          >
            <button className="close-btn" onClick={() => setViewInformationModal(false)}>×</button>
            <h3 className="modal-title">User Profile Details</h3>
            <p className="sub-title">See the details associated with this account</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>

              <div style={{ display: 'flex', flexDirection: 'row', gap: '10px'}}>
                {/* User ID */}
                <div className="input-group" style={{ flex: 1 }}>
                  <label htmlFor="userId" className="input-label">User ID</label>
                  <input
                    type="text"
                    id="userId"
                    value={`USER-${String(selectedAccount.id).padStart(5, '0')}`}
                    disabled
                    className="input-field"
                  />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  {/* Username */}
                  <label htmlFor="userId" className="input-label">Username</label>
                  <input
                    type="text"
                    id="userId"
                    value={selectedAccount.username}
                    disabled
                    className="input-field"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'row', gap: '10px'}}>
                {/* Last Name */}
                <div className="input-group" style={{ flex: 1 }}>
                  <label htmlFor="userId" className="input-label">Last Name</label>
                  <input
                    type="text"
                    id="userId"
                    value={selectedAccount.last_name}
                    disabled
                    className="input-field"
                  />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  {/* First Name */}
                  <label htmlFor="userId" className="input-label">First Name</label>
                  <input
                    type="text"
                    id="userId"
                    value={selectedAccount.first_name}
                    disabled
                    className="input-field"
                  />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  {/* Middle Name */}
                  <label htmlFor="userId" className="input-label">Middle Name</label>
                  <input
                    type="text"
                    id="userId"
                    value={selectedAccount.middle_name}
                    disabled
                    className="input-field"
                  />
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'row', gap: '10px'}}>
                {/* Contact Number */}
                <div className="input-group" style={{ flex: 2.6 }}>
                  <label htmlFor="userId" className="input-label">Contact Number</label>
                  <input
                    type="text"
                    id="userId"
                    value={selectedAccount.phone_number}
                    disabled
                    className="input-field"
                  />
                </div>
                {/* Civil Status */}
                <div className="input-group" style={{ flex: 1.6 }}>
                  <label htmlFor="civilStatus" className="input-label">Civil Status</label>
                  <input
                    type="text"
                    id="civilStatus"
                    value={selectedAccount.status === 'unverified' ? 'N/A' : selectedAccount.civil_status}
                    disabled
                    className="input-field"
                  />
                </div>
                {/* Sex */}
                <div className="input-group" style={{ flex: 1.6 }}>
                  <label htmlFor="sex" className="input-label">Sex</label>
                  <input
                    type="text"
                    id="sex"
                    value={
                      selectedAccount.status === 'unverified'
                        ? 'N/A'
                        : selectedAccount.sex
                          ? selectedAccount.sex.charAt(0).toUpperCase() + selectedAccount.sex.slice(1)
                          : ''
                    }
                    disabled
                    className="input-field"
                    style={{ textTransform: 'capitalize' }}
                  />
                </div>
                <div className="input-group" style={{ flex: 1.9 }}>
                  {/* Date of Birth */}
                  <label htmlFor="userId" className="input-label">Date of Birth</label>
                  <input
                    type="text"
                    id="userId"
                    value={selectedAccount.date_of_birth
                    ? new Date(selectedAccount.date_of_birth).toLocaleDateString('en-US', {
                        month: '2-digit',
                        day: '2-digit',
                        year: 'numeric',
                      })
                    : '—'}
                    disabled
                    className="input-field"
                  />
                </div>
                {/* Age */}
                <div className="input-group" style={{ flex: 1 }}>
                  <label htmlFor="userId" className="input-label">Age</label>
                  <input
                    type="text"
                    id="userId"
                    value={selectedAccount.date_of_birth
                    ? Math.floor(
                        (new Date() - new Date(selectedAccount.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000)
                      )
                    : '—'}
                    disabled
                    className="input-field"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'row', gap: '10px'}}>
                {/* Home Address */}
                <div className="input-group" style={{ flex: 1 }}>
                  <label htmlFor="homeAddress" className="input-label">Home Address</label>
                  <input
                    type="text"
                    id="homeAddress"
                    value={selectedAccount.status === 'unverified' ? 'N/A' : selectedAccount.home_address}
                    disabled
                    className="input-field"
                  />
                </div>
              </div>

            </div>

            <div className="button-container" style={{ marginTop: '20px' }}>
              <button className="cancel-button" onClick={() => setViewInformationModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showApproveConfirm && userToApprove && (
        <div className="overlay modal-fade" onClick={() => setShowApproveConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowApproveConfirm(false)}>×</button>

            <div className="icon-container">
              <img
                src="/icons/approve.png"
                alt="Approve"
                className="icon-approve"
              />
            </div>

            <h3 className="modal-title">Approve Verification</h3>
            <p className="sub-title">Are you sure you want to approve this account as verified?</p>

            <div style={{ display: 'flex', marginBottom: '20px', paddingLeft: '18px', paddingRight: '18px' }}>
              <span className="location-text">
                {userToApprove.first_name},&nbsp;
                {userToApprove.last_name}
              </span>
            </div>

            <div className="button-container">
              <button
                className="cancel-button"
                onClick={() => setShowApproveConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="confirm-button"
                onClick={() => {
                  handleStatusChange(userToApprove.id, "verified");
                  setShowApproveConfirm(false);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const dropdownStyles = {
  control: (base) => ({
    ...base,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 0,
    boxShadow: 'none',
    minHeight: '28px',
    height: '28px',
    fontSize: '12px',
    width: '150px',
    cursor: 'pointer',
    paddingBottom: '30px',
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
    display: 'none'
  }),
  dropdownIndicator: (base) => ({
    ...base,
    padding: 4,
    color: '#374856',
  }),
  menu: (base) => ({
    ...base,
    fontSize: '12px',
    zIndex: 99
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? '#e7f0fa' : 'white',
    color: '#374856',
    cursor: 'pointer',
    fontSize: '12px',
  }),
};

const reasondropdownStyles = {
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