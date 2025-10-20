import { useState, useEffect, useMemo } from 'react';
import axios from '../../../axios/axiosInstance';
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
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');

  const [BRGYProfile, setBRGYProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [documentRequest, setDocumentRequest] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('first-name-asc');

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isClosing, setIsClosing] = useState(false);

  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [reportToReject, setReportToReject] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showExportConfirm, setShowExportConfirm] = useState(false);

  // socket connection
  const socket = useMemo(() => 
  io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000", {
    transports: ["websocket", "polling"],
    withCredentials: true,
  }), 
[]
);

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
    { value: 'date-desc', label: 'Sort by Date' },
    { value: 'status-asc', label: 'Sort by Status' },
    { value: 'id-asc', label: 'Sort by ID' },
  ];

  // Sorting function
  const sortDocumentRequests = (users, option) => {
    const sorted = [...users];
    switch (option) {
      case 'date-desc':
        return sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
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
    const query = searchQuery.trim().toLowerCase();
    if (!query) return users;

    return users.filter((user) => {
      let formattedDate = "";
      if (user.date) {
        const [year, month, day] = user.date.split("-");
        if (year && month && day) {
          formattedDate = `${month}/${day}/${year}`;
        }
      }

      const pickupTime = user.time || "";

      const pickupCombined =
        formattedDate && pickupTime
          ? `${formattedDate} | ${pickupTime}`
          : formattedDate || pickupTime;

      const docId = user.id
        ? `DOC-${String(user.id).padStart(5, "0")}`.toLowerCase()
        : "";

      return [
        docId,
        user.document_type,
        pickupCombined,
        user.requested_by,
        user.barangay,
        user.status,
      ]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(query));
    });
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

  // =================================================
  //  CHANGE STATUS
  // =================================================
const handleStatusChange = async (requestOrId, newStatus) => {
  try {
    // Resolve to a full request object, if only an id was passed
    let reqObj = null;

    if (requestOrId && typeof requestOrId === "object") {
      reqObj = requestOrId;
    } else if (requestOrId != null) {
      reqObj = documentRequest.find(r => String(r.id) === String(requestOrId)) || null;
    }

    // Guard: if still not found, we can’t show modals that need details
    if (!reqObj) {
      toast.error("Request not found");
      return;
    }

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const first_name = user?.firstName || "";
    const last_name  = user?.lastName || "";
    const next = (newStatus || "").toLowerCase();

    if (!next) {
      toast.error("Invalid status");
      return;
    }

    // 1) Rejected → open rejection modal first (no PATCH yet)
    if (next === "rejected") {
      setReportToReject({ ...reqObj, nextStatus: newStatus });
      setShowRejectionModal(true);
      return;
    }

    // 2) Ready for Pick-up → open amount modal first (no PATCH yet)
    if (next === "ready for pick-up") {
      setAmountRequest(reqObj);
      setPriceAmount("");
      setPriceNote("");
      setShowAmountModal(true);
      return;
    }

    // 3) Others → PATCH immediately
    const payload = { status: next, first_name, last_name };
    const { data } = await axios.patch(
      `/api/brgy/update-document-request-status/${reqObj.id}`,
      payload
    );

    setDocumentRequest(prev => prev.map(r => (r.id === reqObj.id ? data.report : r)));
    toast.success(`Status updated to '${data.report.status}'`);
  } catch (error) {
    console.error("Failed to update status:", error);
    toast.error("Failed to update status.");
  }
};



  // =================================================
  //  REJECT REQUEST
  // =================================================
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

      // ⬇️ use data.request
      setDocumentRequest(prev =>
        prev.map(r => (String(r.id) === String(requestId) ? data.request : r))
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



  // =================================================
  //  EXPORT REPORTS AS CSV
  // =================================================
  const handleExport = () => {
    if (!displayDocumentRequests || displayDocumentRequests.length === 0) {
      toast.warning("No document requests available to export.");
      return;
    }

    const headers = [
      "ID",
      "Document Type",
      "Purpose",
      "Preferred Pickup Date",
      "Preferred Pickup Time",
      "Additional Notes",
      "Date Requested",
      "Region",
      "Province",
      "City",
      "Barangay",
      "Requested By",
      "Date of Birth",
      "Sex",
      "Home Address",
      "Civil Status",
      "Status",
      "Rejection Reason",
      "Pickup Deadline",
      "New Date"
    ];

    const rows = displayDocumentRequests.map((req) => [
      `Request-${String(req.id).padStart(5, "0")}`,
      req.document_type || "",
      req.purpose || "",
      req.date ? format(new Date(req.date), "yyyy-MM-dd") : "",
      req.time || "",
      req.additional_notes ? req.additional_notes.replace(/\n/g, " ") : "",
      req.created_at ? format(new Date(req.created_at), "yyyy-MM-dd HH:mm:ss") : "",
      req.region || "",
      req.province || "",
      req.city || "",
      req.barangay || "",
      req.requested_by || "",
      req.date_of_birth ? format(new Date(req.date_of_birth), "yyyy-MM-dd") : "",
      req.sex || "",
      req.home_address || "",
      req.civil_status || "",
      req.status || "",
      req.rejection_reason || "",
      req.pickup_deadline ? format(new Date(req.pickup_deadline), "yyyy-MM-dd") : "",
      req.new_date ? format(new Date(req.new_date), "yyyy-MM-dd") : ""
    ]);

    const csvContent =
      [headers, ...rows]
        .map((row) =>
          row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")
        )
        .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const fileName = `document_requests_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`;
    link.href = url;
    link.setAttribute("download", fileName);

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Document requests exported successfully!");
  };


  // =================================================
  //  HANDLE AMOUNT
  // =================================================
// --- Amount modal state ---
// --- Amount modal state (JS, no TS types) ---
const [showAmountModal, setShowAmountModal] = useState(false);
const [amountRequest, setAmountRequest] = useState(null);
const [priceAmount, setPriceAmount] = useState('');
const [priceNote, setPriceNote] = useState('');
const [isSavingPrice, setIsSavingPrice] = useState(false);


const handleReadyForPickupSubmit = async () => {
  if (!amountRequest) return;
  try {
    setIsSavingPrice(true);

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const first_name = user?.firstName || "";
    const last_name = user?.lastName || "";

    const payload = {
      status: "ready for pick-up",
      first_name,
      last_name,
      price_amount: Number(priceAmount),
      price_note: (priceNote || '').trim()
    };

    const { data } = await axios.patch(
      `/api/brgy/update-document-request-status/${amountRequest.id}`,
      payload
    );

    setDocumentRequest(prev => prev.map(r => (r.id === amountRequest.id ? data.report : r)));
    toast.success("Marked as Ready for Pick-up with amount set.");
  } catch (err) {
    console.error(err);
    toast.error("Failed to set amount / update status.");
  } finally {
    setIsSavingPrice(false);
    setShowAmountModal(false);
    setAmountRequest(null);
    setPriceAmount('');
    setPriceNote('');
  }
};




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
            <h2 className="no-barangay-title">No Document Requests Found</h2>
            <p className="no-barangay-subtext">
              There are no document requests to display at the moment.
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
                      onChange={(selected) => handleStatusChange(user, selected.value)}
                      options={getNextStatusOptions(user.status || 'submitted')}
                      styles={updateStatusStyles(user.status || 'submitted')}
                      isSearchable={false}
                      isDisabled={getNextStatusOptions(user.status || 'submitted').length === 0}
                      menuPortalTarget={document.body}
                      menuPosition="fixed"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
              <h2 className="page-title">Document Request Management</h2>
                <div>
                  <input
                    type="text"
                    placeholder="Search..."
                    className="search-box"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                <button className="add-barangay-button"
                  onClick={() => setShowExportConfirm(true)}
                  >
                  Export CSV
                </button>
              </div>
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

      {/* EXPORT CONFIRMATION MODAL */}
      {showExportConfirm && (
        <div
          className="modal-overlay"
          onClick={() => {
            setIsClosing(true);
            setTimeout(() => {
              setShowExportConfirm(false);
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
                  setShowExportConfirm(false);
                  setIsClosing(false);
                }, 200);
              }}
            />

            <h3 className="modal-title" style={{ textAlign: 'center' }}>Export Document Requests</h3>
            <p className="sub-title" style={{ textAlign: 'center' }}>
              Are you sure you want to export all requests as a CSV file?
            </p>

            <div className="button-container">
              <button
                className="cancel-button"
                onClick={() => {
                  setIsClosing(true);
                  setTimeout(() => {
                    setShowExportConfirm(false);
                    setIsClosing(false);
                  }, 200);
                }}
              >
                Cancel
              </button>
              <button
                className="confirm-button-export"
                onClick={() => {
                  handleExport();
                  setIsClosing(true);
                  setTimeout(() => {
                    setShowExportConfirm(false);
                    setIsClosing(false);
                  }, 200);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}


{/* READY FOR PICK-UP (SET PRICE) MODAL */}
{/* READY FOR PICK-UP (SET PRICE) MODAL */}
{showAmountModal && amountRequest && (
  <div
    className="modal-overlay"
    onClick={() => {
      if (isSavingPrice) return;
      setShowAmountModal(false);
      setAmountRequest(null);
      setPriceAmount('');
      setPriceNote('');
    }}
  >
    <div
      className="modal-content"
      onClick={(e) => e.stopPropagation()}
      style={{ maxWidth: '420px' }}
    >
      <img
        src="/icons/close.png"
        alt="Close"
        className="modal-close-btn"
        onClick={() => {
          if (isSavingPrice) return;
          setShowAmountModal(false);
          setAmountRequest(null);
          setPriceAmount('');
          setPriceNote('');
        }}
      />

      <h3 className="modal-title" style={{ textAlign: 'center' }}>
        Set Price for Pickup
      </h3>
      <p className="sub-title" style={{ textAlign: 'center' }}>
        {`DOC-${String(amountRequest.id).padStart(5, '0')} • ${amountRequest.document_type}`}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
        <label className="modal-label" htmlFor="priceAmount">Amount (₱)</label>
        <input
          id="priceAmount"
          type="number"
          step="0.01"
          min="0"
          value={priceAmount}
          onChange={(e) => setPriceAmount(e.target.value)}
          placeholder="Enter amount"
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #eee",
            fontFamily: 'Poppins, sans-serif'
          }}
          disabled={isSavingPrice}
        />

        <label className="modal-label" htmlFor="priceNote">Notes (optional)</label>
        <textarea
          id="priceNote"
          value={priceNote}
          onChange={(e) => setPriceNote(e.target.value)}
          placeholder="e.g., Includes certification fee"
          style={{
            width: "100%",
            minHeight: "90px",
            borderRadius: "8px",
            border: "1px solid #eee",
            padding: "10px",
            fontFamily: 'Poppins, sans-serif'
          }}
          disabled={isSavingPrice}
        />
      </div>

      <div className="button-container" style={{ marginTop: 16 }}>
        <button
          className="cancel-button"
          onClick={() => {
            if (isSavingPrice) return;
            setShowAmountModal(false);
            setAmountRequest(null);
            setPriceAmount('');
            setPriceNote('');
          }}
          disabled={isSavingPrice}
        >
          Cancel
        </button>
        <button
          className="confirm-button"
          onClick={handleReadyForPickupSubmit}
          disabled={isSavingPrice || priceAmount === '' || Number(priceAmount) < 0}
        >
          {isSavingPrice ? "Saving..." : "Confirm"}
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
      backgroundColor: state.isFocused ? color + '30' : 'white',
      color: state.isFocused ? color : 'black',
      cursor: 'pointer',
      fontSize: '12px',
      padding: '6px 10px',
    }),
  };
};