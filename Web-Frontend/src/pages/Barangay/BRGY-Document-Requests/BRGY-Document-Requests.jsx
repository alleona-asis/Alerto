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


const getStatusColor = (status) => {
  switch (status.toLowerCase()) {
    case 'submitted': return '#FFB300';
    case 'processing': return '#2196F3';
    case 'accepted': return '#4CAF50';
    case 'rejected': return '#F44336';
    case 'reschedule': return '#FF5722';
    case 'ready for pick-up': return '#9C27B0';
    case 'claimed': return '#795548';
    case 'unclaimed': return '#607D8B';
    default: return '#374856';
  }
};


export default function BRGYDocumentRequest() {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDevelopmentOngoing, setIsDevelopmentOngoing] = useState(true);

  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');

  // State hooks
  const [BRGYProfile, setBRGYProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [documentRequest, setDocumentRequest] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('first-name-asc');

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isClosing, setIsClosing] = useState(false);




  // Create socket connection once, memoized
  const socket = useMemo(() => io('http://localhost:5000'), []);

  // Helper to capitalize words
  const capitalizeWords = (str) =>
    str?.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()) || '';

  // Status options
  const statusOptions = [
    { value: 'Submitted', label: 'Submitted' },
    { value: 'Processing', label: 'Processing' },
    { value: 'Accepted', label: 'Accepted' },
    { value: 'Rejected', label: 'Rejected' },
    { value: 'Reschedule', label: 'Reschedule' },
    { value: 'Ready for Pick-up', label: 'Ready for Pick-up' },
    { value: 'Claimed', label: 'Claimed' },
    { value: 'Unclaimed', label: 'Unclaimed' },
  ];

const getNextStatusOptions = (currentStatus) => {
  switch (currentStatus.toLowerCase()) {
    case 'submitted':
      return statusOptions.filter((opt) =>
        ['Accepted', 'Rejected'].map(s => s.toLowerCase()).includes(opt.value.toLowerCase())
      );
    case 'accepted':
      return statusOptions.filter((opt) => opt.value.toLowerCase() === 'processing');
    case 'processing':
      return statusOptions.filter((opt) => opt.value.toLowerCase() === 'ready for pick-up');
    case 'ready for pick-up':
      return statusOptions.filter((opt) =>
        ['Claimed', 'Unclaimed'].map(s => s.toLowerCase()).includes(opt.value.toLowerCase())
      );
    case 'reschedule':
      return statusOptions.filter((opt) =>
        ['Claimed', 'Unclaimed'].map(s => s.toLowerCase()).includes(opt.value.toLowerCase())
      );
    case 'unclaimed':
      return statusOptions.filter((opt) => opt.value.toLowerCase() === 'claimed');
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
  const sortDocumentRequests = (users, option) => {
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

  // Filtering function
  const filterDocumentRequests = (users) => {
    const query = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        (user.first_name?.toLowerCase().includes(query) ||
          user.last_name?.toLowerCase().includes(query) ||
          user.province?.toLowerCase().includes(query) ||
          user.city?.toLowerCase().includes(query) ||
          user.barangay?.toLowerCase().includes(query) ||
          user.email?.toLowerCase().includes(query) ||
          user.phone_number?.toLowerCase().includes(query))
    );
  };

  // Memoized filtered and sorted users
  const displayDocumentRequests = useMemo(() => {
    const filtered = filterDocumentRequests(documentRequest);
    return sortDocumentRequests(filtered, sortOption);
  }, [documentRequest, searchQuery, sortOption]);


  // =================================================
  //  SOCKET LISTENER
  // =================================================
  /*
useEffect(() => {
  const handleNewRequest = (newRequest) => {
    if (
      newRequest.region === BRGYProfile?.region &&
      newRequest.province === BRGYProfile?.province &&
      newRequest.city === BRGYProfile?.city &&
      newRequest.barangay === BRGYProfile?.barangay
    ) {
      setDocumentRequest(prev => {
        if (prev.some(r => r.id === newRequest.id)) return prev;
        return [newRequest, ...prev];
      });
    }
  };

  socket.on("newDocumentRequest", handleNewRequest);
  return () => socket.off("newDocumentRequest", handleNewRequest);
}, [socket, BRGYProfile]);


useEffect(() => {
  socket.on("documentRequestUpdate", (update) => {
    setDocumentRequest(prev =>
      prev.map(r =>
        r.id === update.requestId
          ? { ...r, status: update.status, status_history: update.status_history }
          : r
      )
    );
  });

  return () => socket.off("documentRequestUpdate");
}, [socket]);


useEffect(() => {
  const socket = io();

  socket.on("documentRequestUpdate", (update) => {
    setRequests(prev =>
      prev.map(req =>
        req.id === update.requestId ? { ...req, ...update } : req
      )
    );
  });

  return () => socket.disconnect();
}, []);
*/


useEffect(() => {
  if (!BRGYProfile) return;

  const handleNewRequest = (newRequest) => {
    if (
      newRequest.region === BRGYProfile.region &&
      newRequest.province === BRGYProfile.province &&
      newRequest.city === BRGYProfile.city &&
      newRequest.barangay === BRGYProfile.barangay
    ) {
      setDocumentRequest(prev => {
        if (prev.some(r => r.id === newRequest.id)) return prev;
        return [newRequest, ...prev];
      });
    }
  };

  const handleStatusUpdate = (update) => {
    setDocumentRequest(prev =>
      prev.map(r =>
        r.id === update.requestId
          ? { ...r, status: update.status, status_history: update.status_history }
          : r
      )
    );
  };

  socket.on("newDocumentRequest", handleNewRequest);
  socket.on("documentRequestUpdate", handleStatusUpdate);

  return () => {
    socket.off("newDocumentRequest", handleNewRequest);
    socket.off("documentRequestUpdate", handleStatusUpdate);
  };
}, [socket, BRGYProfile]);


  // =================================================
  //  FETCH PROFILE
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
  //  FETCH DOCUMENT REQUESTS
  // =================================================
  const fetchBarangayDocumentRequests = async () => {
    if (!BRGYProfile) return;
    const { region, province, city, barangay } = BRGYProfile;

    if (!region || !province || !city || !barangay) return;

    setLoading(true);
    try {
      const response = await axios.get('api/brgy/barangay-document-requests', {
        params: { region, province, city, barangay },
      });
      
      //console.log("API Response Data:", response.data);
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


// Status Change
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [reportToReject, setReportToReject] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");



const handleStatusChange = async (requestId, newStatus) => {
  try {
    const user = JSON.parse(localStorage.getItem("user"));
    const first_name = user?.firstName || "";
    const last_name = user?.lastName || "";


    // If status is rejection, open rejection modal instead of updating directly
    if (newStatus.toLowerCase() === "rejected") {
      const report = documentRequest.find(r => r.id === requestId);
      if (!report) {
        toast.error("Report not found");
        return;
      }
      setReportToReject({ ...report, nextStatus: newStatus });
      setShowRejectionModal(true);
      return;
    }

    const payload = { status: newStatus.toLowerCase(), first_name, last_name };
    console.log("Sending status update payload:", payload);

    const { data } = await axios.patch(
      `/api/brgy/update-document-request-status/${requestId}`,
      payload
    );

    console.log("Updated document request:", data.report);

    // Update local state with the returned object from backend
    setDocumentRequest(prev =>
      prev.map(r => (r.id === requestId ? data.report : r))
    );

    toast.success(`Status updated to '${data.report.status}'`);
  } catch (error) {
    console.error("Failed to update status:", error);
    toast.error("Failed to update status.");
  }
};

const handleRejectSubmit = async (requestId) => {
  try {
    const user = JSON.parse(localStorage.getItem("user"));
    const first_name = user?.firstName || "";
    const last_name = user?.lastName || "";

    const payload = { first_name, last_name, reason: rejectionReason };
    const { data } = await axios.patch(
      `/api/brgy/reject-document-request/${requestId}`,
      payload
    );

    // Update local state
    setDocumentRequest(prev =>
      prev.map(r => (r.id === requestId ? data.report : r))
    );

    toast.success("Document request rejected successfully");
    setShowRejectionModal(false);
    setReportToReject(null);
    setRejectionReason("");
  } catch (err) {
    console.error(err);
    toast.error("Failed to reject request");
  }
};






  // Render table or no-data animation
  const renderTable = (documentRequest = []) => {
    if (documentRequest.length === 0) {
      return (
        <div className="no-barangay-wrapper">
          <div className="no-barangay-content">
            <Player
              autoplay
              loop
              src={noBarangayAnim}
              style={{ height: '240px', width: '240px' }}
            />
            <h2 className="no-barangay-title">No Barangay Requests</h2>
            <p className="no-barangay-subtext">
              There are currently no barangay reports available. Please add one to get started.
            </p>
          </div>
        </div>
      );
    }

    return (
      <>
      <div className="table-wrapper">
        <table className="scroll" role="table" aria-label="Document Requests">
          <thead className="table-head">
            <tr>
              <th className="table-header" style={{ width: '150px' }}>Document ID</th>
              <th className="table-header" style={{ width: '400px' }}>Document Type</th>
              <th className="table-header" style={{ width: '300px' }}>Preferred Date & Time</th>
              <th className="table-header" style={{ width: '300px' }}>Requested By</th>
              <th className="table-header" style={{ width: '100px' }}>Status</th>
              <th className="table-header" style={{ paddingLeft: '100px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {documentRequest.map((user) => (
              <tr
                key={user.id}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setSelectedRequest(user);
                  setShowDetailsModal(true);
                }}
              >
                <td className="table-cell">{`DOC-${String(user.id).padStart(5, '0')}`}</td>
                <td className="table-cell">{user.document_type}</td>




<td className="table-cell">
  {user.date && user.time
    ? format(
        new Date(`${user.date.split('T')[0]}T${user.time}`),
        'MM/dd/yyyy | hh:mm a'
      )
    : 'N/A'}
</td>


                <td className="table-cell">{user.requested_by}</td>


          <td className="table-cell" style={{ minWidth: 180 }}>
            <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
              <Select
                value={statusOptions.find(
                  (opt) => opt.value.toLowerCase() === (user.status || 'submitted').toLowerCase()
                )}
                onChange={(selected) => handleStatusChange(user.id, selected.value)}
                options={getNextStatusOptions(user.status || 'submitted')}
                styles={updateStatusStyles(user.status || 'submitted')}
                isSearchable={false}
                isDisabled={getNextStatusOptions(user.status || 'submitted').length === 0}
                menuPortalTarget={document.body}
                menuPosition="fixed"
              />
            </div>
          </td>
      <td className="table-cell">
        <img
          src="/icons/archive.png"
          alt="Archive"
          className="table-icon-button"
          onClick={(e) => {
            e.stopPropagation();
            // TODO: Add delete logic
          }}
        />
      </td>
    </tr>
  ))}
</tbody>

        </table>
      </div>

{/* SHOW DETAILS MODAL */}
{showDetailsModal && selectedRequest && (
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

      <h3 className="modal-title" style={{ textAlign: 'center' }}>Document Request Details</h3>
      
<div
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
  <span className="modal-value"><b>{selectedRequest.requested_by}</b></span>
</div>

<div style={{ display: 'flex', justifyContent: 'space-between' }}>
  <span className="modal-label">Home Address:</span>
  <span className="modal-value"><b>{selectedRequest.home_address}</b></span>
</div>

<div style={{ display: 'flex', justifyContent: 'space-between' }}>
  <span className="modal-label">Document Type:</span>
  <span className="modal-value"><b>{selectedRequest.document_type}</b></span>
</div>

<div style={{ display: 'flex', justifyContent: 'space-between' }}>
  <span className="modal-label">Purpose:</span>
  <span className="modal-value"><b>{selectedRequest.purpose}</b></span>
</div>

<div style={{ display: 'flex', justifyContent: 'space-between' }}>
  <span className="modal-label">Date of Birth:</span>
  <span className="modal-value">
    <b>
      {selectedRequest.date_of_birth
        ? new Date(selectedRequest.date_of_birth).toLocaleDateString('en-US')
        : ''}
    </b>
  </span>
</div>

<div style={{ display: 'flex', justifyContent: 'space-between' }}>
  <span className="modal-label">Age:</span>
  <span className="modal-value">
    <b>
      {selectedRequest.date_of_birth
        ? Math.floor(
            (new Date() - new Date(selectedRequest.date_of_birth)) / 
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
      {selectedRequest.sex
        ? selectedRequest.sex.charAt(0).toUpperCase() + selectedRequest.sex.slice(1)
        : ''}
    </b>
  </span>
</div>

<div style={{ display: 'flex', justifyContent: 'space-between' }}>
  <span className="modal-label">Civil Status:</span>
  <span className="modal-value"><b>{selectedRequest.civil_status}</b></span>
</div>

<div style={{ display: 'flex', justifyContent: 'space-between' }}>
  <span className="modal-label">Additional Notes:</span>
  <span className="modal-value"><b>{selectedRequest.additional_notes || 'N/A'}</b></span>
</div>

<div style={{ display: 'flex', justifyContent: 'space-between' }}>
  <span className="modal-label">Date Requested:</span>
  <span className="modal-value"><b>{format(new Date(selectedRequest.created_at), 'MM/dd/yyyy')}</b></span>
</div>

</div>

    </div>
  </div>
)}

      </>
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
            <h2 className="page-title">Document Request Management</h2>
            <input
              type="text"
              placeholder="Search..."
              className="search-box"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="section-wrapper">
            <div className="table-section">
              <div className="header-table">
                <h3 className="section-title">Request Directory</h3>
                <Select
                  options={sortOptions}
                  value={sortOptions.find((option) => option.value === sortOption)}
                  styles={sortDropdownStyles}
                  isSearchable={false}
                  onChange={(option) => setSortOption(option.value)}
                />
              </div>
              {renderTable(displayDocumentRequests)}
            </div>
          </div>
        </div>
      </div>
    </div>

{/* REJECTION CONFIRMATION MODAL */}
{showRejectionModal && reportToReject && (
    <div
      className="modal-overlay"
      onClick={() => {
        setShowRejectionModal(false);
        setReportToReject(null);
        setRejectionReason("");
      }}
    >
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
    <img
      src="/icons/close.png"
      alt="Close"
      className="modal-close-btn"
      onClick={(() => {
        setShowRejectionModal(false);
        setReportToReject(null);
        setRejectionReason("");
      })}
    />



      <h3 className="modal-title" style={{ textAlign: 'center' }}>Reject Document Request</h3>
        <p className="sub-title" style={{ textAlign: 'center' }}>
          Please provide a reason for rejection
        </p>

      <textarea
        value={rejectionReason}
        onChange={(e) => setRejectionReason(e.target.value)}
        placeholder="Enter reason here..."
        style={{ 
          width: "100%", 
          minHeight: "100px", 
          marginBottom: "15px",
          borderRadius: '8px',
          borderColor: '#eee',
          padding: '10px'
        }}
      />

      <div className="button-container">
        <button
        className="cancel-button"
        onClick={(() => {
          setShowRejectionModal(false);
          setReportToReject(null);
          setRejectionReason("");
        })}
        >
          Cancel
        </button>
        <button
          className="confirm-button"
          onClick={() => handleRejectSubmit(reportToReject.id)}
          disabled={!rejectionReason.trim()}
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


// Styles for sort dropdown
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