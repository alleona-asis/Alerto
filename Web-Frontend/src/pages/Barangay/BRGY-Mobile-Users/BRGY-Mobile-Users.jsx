import { useState, useEffect, useMemo } from 'react';
import axios from '../../../axios/axiosInstance';
import { useNavigate } from 'react-router-dom';
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


  const navigate = useNavigate();
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [username, setUsername] = useState('');
  const [viewInformationModal , setViewInformationModal ] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingSortOption, setPendingSortOption] = useState('default');
  const [approvedSortOption, setApprovedSortOption] = useState('default');

  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
const [activeTab, setActiveTab] = useState('id'); // 'id' or 'selfie'
const [idSide, setIdSide] = useState('front'); // 'front' or 'back'
  const [selectedDocumentUser , setSelectedDocumentUser ] = useState(null);
const [rotation, setRotation] = useState(0); // rotation in degrees
const [scale, setScale] = useState(1);

const [showApproveConfirm, setShowApproveConfirm] = useState(false);
const [userToApprove, setUserToApprove] = useState(null);


  // =================================================
  //  SOCKET CONNECTION AND LISTENER
  // =================================================
  /*
  const socket = useMemo(() => io('http://localhost:5000'), []);
  useEffect(() => {
    socket.on('mobileUserRegistered', (newUser) => {
      console.log('[SOCKET] New mobile user received:', newUser);

      setMobileUsers((prevUsers) => {
        if (prevUsers.some(u => u.id === newUser.id)) return prevUsers;
        return [...prevUsers, newUser];
      });
    });

    // Handle new verification request from mobile user
    socket.on('newVerificationRequest', (data) => {
      console.log('[SOCKET] New verification request received:', data);

      // Optional: you could filter by barangay or region if needed
      setMobileUsers((prevUsers) => {
        if (prevUsers.some(u => u.id === data.userId)) return prevUsers;
        return [...prevUsers, { ...data, status: 'pending' }];
      });

      // Optional: toast notification for real-time alert
      toast.info(`📩 New verification request from User ID: ${data.userId}`);
    });

    return () => {
    socket.off('mobileUserRegistered');
    socket.off('newVerificationRequest');
    };
  }, [socket]);

// =================================================
// SOCKET CONNECTION AND LISTENER
// =================================================
const socket = useMemo(() => io('http://localhost:5000'), []);

useEffect(() => {
  if (!BRGYProfile?.barangay) return;

  const handleIncomingUser = (incomingUser) => {
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

      return [{ 
        id, 
        ...incomingUser, 
        status: incomingUser.status || 'unverified'  // not pending yet
      }, ...prevUsers];
    });
  };


  socket.on('mobileUserRegistered', handleIncomingUser);
  socket.on('newVerificationRequest', (data) => {
    handleIncomingUser(data);
    toast.info(`New verification request from User ID: ${data.userId}`);
  });

  return () => {
    socket.off('mobileUserRegistered', handleIncomingUser);
    socket.off('newVerificationRequest');
  };
}, [socket, BRGYProfile]);
*/
const socket = useMemo(() => io('http://localhost:5000'), []);

useEffect(() => {
  if (!BRGYProfile?.barangay) return;

  const handleIncomingUser = (incomingUser) => {
    let isNewUser = false;

    setMobileUsers((prevUsers) => {
      const id = incomingUser.id || incomingUser.userId;
      const index = prevUsers.findIndex(u => u.id === id);

      if (index !== -1) {
        // Existing user — just update
        const updatedUsers = [...prevUsers];
        updatedUsers[index] = { 
          ...updatedUsers[index], 
          ...incomingUser, 
          status: incomingUser.status || updatedUsers[index].status || 'unverified' 
        };
        return updatedUsers;
      }

      // New user
      isNewUser = true;
      return [{ 
        id, 
        ...incomingUser, 
        status: incomingUser.status || 'unverified' 
      }, ...prevUsers];
    });

    // Show toast only for genuinely new users
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
  //  SORT FUNCTION (define first)
  // =================================================
  const [sortOption, setSortOption] = useState('first-name-asc');
  const sortOptions = [
    { value: 'first-name-asc', label: 'Sort by First Name' },
    { value: 'last-name-asc', label: 'Sort by Last Name' },
    { value: 'date-desc', label: 'Sort by Date' },
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

  // =================================================
  //  SEARCH FUNCTION
  // =================================================
  const filterMobileUsers = (users) => {
    const query = searchQuery.toLowerCase();
    return users.filter((user) =>
      (user.first_name?.toLowerCase().includes(query) ||
      user.last_name?.toLowerCase().includes(query) ||
      user.region?.toLowerCase().includes(query) ||
      user.province?.toLowerCase().includes(query) ||
      user.city?.toLowerCase().includes(query) ||
      user.barangay?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.phone_number?.toLowerCase().includes(query))
    );
  };

  const displayMobileUsers = useMemo(() => {
    const filtered = filterMobileUsers(mobileUsers);
    return sortMobileUsers(filtered, sortOption);
  }, [mobileUsers, searchQuery, sortOption]);

  // =================================================
  //  APPLY FILTER, THEN SORT
  // =================================================
  const filteredMobileUsers = filterMobileUsers(mobileUsers);
  const sortedMobileUsers = sortMobileUsers(filteredMobileUsers, sortOption);

  const pendingUsers = sortedMobileUsers.filter(u => u.status === 'pending');
  const allMobileUsers = sortedMobileUsers.filter(
    u => u.status === 'verified' || u.status === 'unverified'
  );



// =================================================
//  UPDATE MOBILE USER STATUS
// =================================================

const [showReasonModal, setShowReasonModal] = useState(false);
const [selectedUser, setSelectedUser] = useState(null);
const [reason, setReason] = useState('');
const [customReason, setCustomReason] = useState('');


const statusOptions = [
  { value: 'pending', label: 'PENDING' },
  { value: 'verified', label: 'VERIFIED' },
  { value: 'unverified', label: 'UNVERIFIED' },
];

// ✅ Handle status change from dropdown
const handleStatusChange = (userId, newStatus) => {
  const user = mobileUsers.find(u => u.id === userId);
  if (!user) return;

  if (newStatus.toLowerCase() === 'unverified') {
    // Open modal for rejection reason
    setSelectedUser(user);
    setReason('');
    setShowReasonModal(true);
    return;
  }

  // For pending/verified, update immediately
  updateUserStatus(userId, newStatus);
};

// Define options for the rejection reasons
const rejectionOptions = [
  { value: 'Invalid ID / Documents', label: 'Invalid ID / Documents' },
  { value: 'Duplicate Account', label: 'Duplicate Account' },
  { value: 'Incorrect Information', label: 'Incorrect Information' },
];


// ✅ API call helper
const updateUserStatus = async (userId, newStatus, rejectionReason = null) => {
  try {
    // Send status and reason_for_rejection to backend
    await axios.patch(`/api/brgy/update-mobile-user-status/${userId}`, {
      status: newStatus.toLowerCase(),
      reason_for_rejection: rejectionReason || null,
    });

    // Update local state
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
                <th className="table-header" style={{ paddingLeft: 100 }}>Actions</th>
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
{/*
                  <td className="table-cell">
                    {user.date_of_birth
                      ? Math.floor(
                          (new Date() - new Date(user.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000)
                        )
                      : '—'}
                  </td>
*/}



<td className="table-cell">
  {user.selfie_url || user.id_front_url ? (
    <img
      src="/icons/view.png"
      alt="View Documents"
      className="icon-button icon-hover-effect"
      style={{ cursor: 'pointer', marginLeft: 28 }}
      onClick={(e) => {
        e.stopPropagation(); // <-- ADD THIS LINE to prevent the row click

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

        // Only open documents modal
        setSelectedDocumentUser(user);
        setShowDocumentsModal(true);
      }}
    />
  ) : (
    <span style={{ color: '#ccc' }}>—</span>
  )}
</td>



                  <td className="table-cell" style={{ minWidth: 130 }}>

                    {/*
                    <Select
                      value={statusOptions.find(opt => opt.value === (user.status || 'pending'))}
                      onChange={(selected) => handleStatusChange(user.id, selected.value)}
                      options={statusOptions}
                      styles={updateStatusStyles(user.status || 'pending')}
                      isSearchable={false}
                    />
                    */}
                    <span
                      style={{
                        width: "110px",                // fixed width
                        height: "25px",                // optional fixed height
                        display: "inline-flex",        // flex for centering
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
                        overflow: "hidden",            // prevent overflow
                        textOverflow: "ellipsis",      // truncate if too long
                        whiteSpace: "nowrap",          // single line only
                      }}
                    >
                      {user.status || "pending"}
                    </span>

                  </td>

                  <td className="table-cell" style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: 100 }}>
                    {isPending ? (
                      <>
                        <img
                          src="/icons/approve.png"
                          alt="Approve"
                          className="icon-button icon-hover-effect"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUserToApprove(user);   // store the user you want to approve
                            setShowApproveConfirm(true);
                          }}
                          style={{
                            marginTop: 2
                          }}
                        />
                        <img
                          src="/icons/reject.png"
                          alt="Reject"
                          className="icon-button icon-hover-effect"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUser(user);
                            setReason('');
                            setShowReasonModal(true);
                          }}
                          style={{
                            marginTop: 2
                          }}
                        />
                      </>
                    ) : (
                      <img
                        src="/icons/delete.png"
                        alt="Delete"
                        className="icon-button icon-hover-effect"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUserToDelete(user);
                          setShowDeleteConfirm(true);
                        }}
                        style={{
                          marginTop: 2
                        }}
                      />
                    )}
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

              {pendingUsers.length > 0 ? (
                renderTable(pendingUsers, true)
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

              {allMobileUsers.length > 0 ? (
                renderTable(allMobileUsers, false)
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

            {/* React Creatable Select for reasons */}
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

            {/* Show textarea if "Other" is selected */}
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
                  if (!finalReason) return; // prevent empty reason
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
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <button onClick={() => setRotation((prev) => prev - 90)}>⟲ Rotate Left</button>
        <button onClick={() => setRotation((prev) => prev + 90)}>⟳ Rotate Right</button>
        <button onClick={() => setScale((prev) => prev + 0.2)}>＋ Zoom In</button>
        <button onClick={() => setScale((prev) => Math.max(0.2, prev - 0.2))}>－ Zoom Out</button>
        <button onClick={() => { setRotation(0); setScale(1); }}>Reset</button>
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
              width: '100%',        // scales with screen
              maxWidth: '600px',   // fixed width for large screens
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

const updateStatusStyles = (status) => {
  const color = getStatusColor(status);
  return {
    control: (provided, state) => ({
      ...provided,
      minWidth: 40,
      borderRadius: 7,          // more rounded for modern pill shape
      borderColor: color,
      boxShadow: state.isFocused ? `0 0 0 1.5px ${color}` : 'none',
      cursor: 'pointer',
      backgroundColor: state.isFocused
        ? color + '40'             // slightly stronger background on focus (25% opacity)
        : color + '20',            // subtle background (12% opacity)
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