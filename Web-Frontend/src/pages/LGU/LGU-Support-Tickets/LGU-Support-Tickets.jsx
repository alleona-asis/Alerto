import { useState, useEffect, useMemo } from 'react';
import LGUNavbar from '../../../components/NavBar/LGU-Navbar';
import LGUSidebar from '../../../components/SideBar/LGU-Sidebar';
import axios from '../../../axios/axiosInstance';
import { ToastContainer, toast } from 'react-toastify';
import { Player } from '@lottiefiles/react-lottie-player';
import noDataAnim from '@/assets/animations/non data found.json';
import Select from 'react-select';

export default function LGUManageFeedback() {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  const [LGUProfile, setLGUProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedbacks, setFeedbacks] = useState([]);
  const [sortOption, setSortOption] = useState('date-desc');
  const [searchQuery, setSearchQuery] = useState('');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reportToDelete, setReportToDelete] = useState(null);
  const [isClosing, setIsClosing] = useState(false);

  const [showImagesModal, setShowImagesModal] = useState(false);
  const [modalUser, setModalUser] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);


  // Helper to capitalize words
  const capitalizeWords = (str) =>
    str?.toLowerCase().replace(/\b\w/g, char => char.toUpperCase()) || '';


  // Fetch LGU Profile
  useEffect(() => {
    if (!userId || !token) return;

    const fetchProfile = async () => {
      try {
        const res = await axios.get(`/api/auth/lgu-admin-profile/${userId}`);
        setLGUProfile(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId, token]);

  // Fetch Feedbacks by LGU Location
  const fetchFeedbacks = async () => {
    if (!LGUProfile) return;
    try {
      const res = await axios.get('/api/lgu/all-feedback', {
        params: {
          region: LGUProfile.region,
          province: LGUProfile.province,
          city: LGUProfile.city,
        },
      });

      console.log('Raw response data:', res.data);

      const cityFiltered = Array.isArray(res.data.feedbacks)
        ? res.data.feedbacks.filter(f => f.city === LGUProfile.city)
        : [];

      console.log('Processed feedback array (filtered by city):', cityFiltered);
      setFeedbacks(cityFiltered);
    } catch (err) {
      console.error('Error fetching feedbacks:', err);
      setFeedbacks([]);
    }
  };
  useEffect(() => {
    if (LGUProfile) fetchFeedbacks();
  }, [LGUProfile]);

  // Search & Sort
  const filteredFeedbacks = useMemo(() => {
    const list = Array.isArray(feedbacks) ? feedbacks : [];
    const q = (searchQuery || '').toLowerCase();

    let result = list.filter((fb) => {
      const idStr = fb?.id != null ? `FB-${String(fb.id).padStart(5, '0')}` : '';
      return (
        idStr.toLowerCase().includes(q) ||
        (fb?.feedback_type || '').toLowerCase().includes(q) ||
        (fb?.messages || '').toLowerCase().includes(q) ||
        (fb?.concerned_barangay || '').toLowerCase().includes(q) ||
        (fb?.first_name || '').toLowerCase().includes(q) ||
        (fb?.middle_name || '').toLowerCase().includes(q) ||
        (fb?.last_name || '').toLowerCase().includes(q)
      );
    });

    switch (sortOption) {
      case 'date-desc':
        result.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
        break;
      case 'date-asc':
        result.sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
        break;
      case 'barangay-asc':
        result.sort((a, b) => a.concerned_barangay?.localeCompare(b.concerned_barangay));
        break;
      case 'barangay-desc':
        result.sort((a, b) => b.concerned_barangay?.localeCompare(a.concerned_barangay));
        break;
    }
    return result;
  }, [feedbacks, searchQuery, sortOption]);

  const deleteIncidentReport = async (id) => {
    if (!id) return;

    try {
      const res = await axios.delete(`/api/lgu/feedback/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('Deleted feedback:', res.data);
      setFeedbacks(prev => prev.filter(fb => fb.id !== id));
      setShowDeleteConfirm(false);
      setReportToDelete(null);

      toast.success('Feedback deleted successfully!');
    } catch (err) {
      console.error('Failed to delete feedback:', err);
      toast.error('Failed to delete feedback.');
    }
  };

  const closeModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowImagesModal(false);
      setIsClosing(false);
      setModalUser(null);
      setCurrentImageIndex(0);
    }, 200);
  };


  // Render Table
  const renderTable = () => {
    if (filteredFeedbacks.length === 0) {
      return (
        <div className="no-barangay-wrapper">
          <div className="no-barangay-content">
            <Player
              autoplay
              loop
              src={noDataAnim}
              style={{ height: '240px', width: '240px' }}
            />
            <h2 className="no-barangay-title">No Support Tickets</h2>
            <p className="no-barangay-subtext">
              No support tickets found for your LGU region.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="table-wrapper">
        <div className="table-scroll">
          <table className="scroll">
            <thead className="table-head">
              <tr>
                <th className="table-header">ID</th>
                <th className="table-header">Name</th>
                <th className="table-header">Type</th>
                <th className="table-header">Messages</th>
                <th className="table-header">Barangay</th>
                <th className="table-header" style={{ paddingLeft: '100px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredFeedbacks.map((fb, idx) => {
                const rowKey = fb?.id ?? fb?.feedback_id ?? fb?._id ?? `row-${idx}`;
                const displayName = [fb?.first_name, fb?.middle_name, fb?.last_name].filter(Boolean).join(' ');

                const mediaUrls = [
                  ...(Array.isArray(fb?.images) ? fb.images.map(i => i?.url).filter(Boolean) : []),
                  ...(fb?.video?.url ? [fb.video.url] : []),
                ];

                return (
                  <tr
                    key={rowKey}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setModalUser({ ...fb, media_urls: mediaUrls });
                      setCurrentImageIndex(0);
                      setShowImagesModal(true);
                    }}
                  >
                    <td className="table-cell">{`FB-${String(fb.id ?? '').padStart(5, '0')}`}</td>
                    <td className="table-cell">{displayName}</td>
                    <td className="table-cell">{fb.feedback_type}</td>
                    <td className="table-cell">{fb.messages}</td>
                    <td className="table-cell">{fb.concerned_barangay}</td>

                    <td className="table-cell" style={styles.cell}>
                      <div style={styles.row}>
                        <img
                          src="/icons/delete-row.png"
                          alt="Delete"
                          style={{ width: 18, height: 20, cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setReportToDelete(fb);
                            setShowDeleteConfirm(true);
                          }}
                          onMouseEnter={(e) => bounceEffect(e.currentTarget)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="wrapper">
        <LGUNavbar userId={userId} />
        <div className="layout">
          <LGUSidebar
            isCollapsed={isSidebarCollapsed}
            toggleSidebar={() => setSidebarCollapsed(!isSidebarCollapsed)}
          />
          <div
            className="main-content mainContent-slide-right"
            style={{
              marginLeft: isSidebarCollapsed ? 80 : 300,
              width: isSidebarCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 300px)'
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
              <h2 className="page-title">Support Tickets</h2>
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
                  <h3 className="section-title">Support Tickets</h3>
                  <Select
                    options={[
                      { value: 'date-desc', label: 'Sort by Date (Newest)' },
                      { value: 'date-asc', label: 'Sort by Date (Oldest)' },
                      { value: 'barangay-asc', label: 'Sort by Barangay A-Z' },
                      { value: 'barangay-desc', label: 'Sort by Barangay Z-A' },
                    ]}
                    value={{
                      value: sortOption,
                      label: sortOption.includes('date')
                        ? sortOption === 'date-desc' ? 'Sort by Date (Newest)' : 'Sort by Date (Oldest)'
                        : sortOption === 'barangay-asc' ? 'Sort by Barangay A-Z' : 'Sort by Barangay Z-A'
                    }}
                    onChange={(option) => setSortOption(option.value)}
                    isSearchable={false}
                    styles={sortDropdownStyles}
                  />
                </div>
                {renderTable()}
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
              <img src="/icons/delete.png" alt="Delete" className="icon-delete" />
            </div>

            <h3 className="modal-title" style={{ textAlign: 'center' }}>Delete</h3>
            <p className="sub-title" style={{ textAlign: 'center' }}>
              Are you sure you want to delete this feedback?
            </p>

            <div className="location-text" style={{ textAlign: 'center', marginBottom: "12px" }}>
              {reportToDelete?.feedback_type
                ? capitalizeWords(reportToDelete.feedback_type)
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
                onClick={() => deleteIncidentReport(reportToDelete.id)}
              >
                Confirm
              </button>
            </div>
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

    </>
  );
}

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
    display: 'none'
  }),
  dropdownIndicator: (base) => ({
    ...base,
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