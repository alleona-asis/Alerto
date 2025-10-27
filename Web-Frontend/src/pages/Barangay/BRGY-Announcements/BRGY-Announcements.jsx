import { useState, useEffect } from 'react';
import BRGYNavbar from '../../../components/NavBar/BRGY-Navbar';
import BRGYSidebar from '../../../components/SideBar/BRGY-Sidebar';
import '../../../components/SideBar/styles.css';
import axios from '../../../axios/axiosInstance';
import defaultProfile from '@/assets/icons/default.png';
import { ToastContainer, toast } from 'react-toastify';

export default function BRGYProfile() {
  const [BRGYProfile, setBRGYProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const userId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');

  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('Announcement');
  const [hovered, setHovered] = useState(null);

  const [isAnnouncementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementImage, setAnnouncementImage] = useState(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isViewAnnouncementModalOpen, setViewAnnouncementModalOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [isSendAlertModalOpen, setIsSendAlertModalOpen] = useState(false);


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
  //  CREATE ANNOUNCEMENT
  // =================================================
  const handlePostAnnouncement = async (e) => {
    e.preventDefault();

    if (!announcementTitle && !announcementText && !announcementImage) {
      alert('Please add a title, text, or image for the announcement.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('title', announcementTitle);
      formData.append('text', announcementText);

      const userId = localStorage.getItem('userId');
      const userName = `${BRGYProfile.first_name || ''} ${BRGYProfile.last_name || ''}`.trim();
      formData.append('posted_by_id', userId);
      formData.append('posted_by_name', userName);

      formData.append('region', BRGYProfile?.region || '');
      formData.append('province', BRGYProfile?.province || '');
      formData.append('city', BRGYProfile?.city || '');
      formData.append('barangay', BRGYProfile?.barangay || '');

      if (announcementImage) {
        Array.from(announcementImage).forEach(file => {
          formData.append('images', file);
        });
      }

      const token = localStorage.getItem('token');

      const response = await axios.post('/api/brgy/create-announcements', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('Announcement posted successfully!');

      const newAnnouncement = response.data.announcement || response.data;
      setAnnouncements(prev => [newAnnouncement, ...prev]);

      setIsClosing(true);
      setTimeout(() => {
        setAnnouncementModalOpen(false);
        setIsClosing(false);
        setAnnouncementText('');
        setAnnouncementTitle('');
        setAnnouncementImage(null);
      }, 300);

    } catch (error) {
      console.error('Error posting announcement:', error);
      alert(error.response?.data?.message || error.message);
    }
  };

  // =================================================
  //  FETCH ANNOUNEMENTS
  // =================================================
  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [announcementError, setAnnouncementError] = useState(null);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      setLoadingAnnouncements(true);
      setAnnouncementError(null);
      try {
        const response = await axios.get('/api/brgy/get-announcements', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        let allAnnouncements = response.data;
        if (BRGYProfile) {
          allAnnouncements = allAnnouncements.filter(
            ann =>
              ann.region === BRGYProfile.region &&
              ann.province === BRGYProfile.province &&
              ann.city === BRGYProfile.city &&
              ann.barangay === BRGYProfile.barangay
          );
        }

        setAnnouncements(allAnnouncements);
      } catch (error) {
        console.error('Failed to fetch announcements:', error);
        setAnnouncementError('Failed to load announcements.');
      } finally {
        setLoadingAnnouncements(false);
      }
    };
    if (BRGYProfile) {
      fetchAnnouncements();
    }
  }, [token, BRGYProfile]);


  // =================================================
  //  BARANGAY OFFICIALS
  // =================================================
  const [isAddOfficialsModalOpen, setAddOfficialsModalOpen] = useState(false);
  const [officialName, setOfficialName] = useState("");
  const [officialPosition, setOfficialPosition] = useState("");
  const [officialContact, setOfficialContact] = useState("");
  const [officialImage, setOfficialImage] = useState(null);
  const [selectedOfficial, setSelectedOfficial] = useState(null);
  const [isEditOfficialModalOpen, setEditOfficialModalOpen] = useState(false);

  const handleAddOfficial = async (e) => {
    e.preventDefault();

    if (!officialName || !officialPosition || !officialContact || !officialImage) {
      alert("Please fill out all required fields.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("name", officialName);
      formData.append("position", officialPosition);
      formData.append("contact_number", officialContact);

      if (officialImage) {
        formData.append("officialImage", officialImage);
      }

      formData.append("region", BRGYProfile?.region || "");
      formData.append("province", BRGYProfile?.province || "");
      formData.append("city", BRGYProfile?.city || "");
      formData.append("barangay", BRGYProfile?.barangay || "");

      const userId = localStorage.getItem("userId");
      formData.append("created_by", userId);

      const token = localStorage.getItem("token");

      const response = await axios.post("/api/brgy/create-official", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      console.log("Official created:", response.data);
      toast.success('Official added successfully!');

      const officialData = response.data.official;

      const imageUrl =
        officialData?.profile_picture?.url ||
        (
          officialImage 
          ? URL.createObjectURL(officialImage) 
          : "/icons/default.png"
        );

      const newOfficial = {
        id: officialData.id,
        name: officialData.name || "",
        position: officialData.position || "",
        contact_number: officialData.contact_number || "",
        profile_picture: {
          url: imageUrl,
        },
        region: officialData.region || "",
        province: officialData.province || "",
        city: officialData.city || "",
        barangay: officialData.barangay || "",
        created_by: officialData.created_by || "",
      };
      setOfficials(prev => [newOfficial, ...prev]);

      setOfficialName("");
      setOfficialPosition("");
      setOfficialContact("");
      setOfficialImage(null);
      setAddOfficialsModalOpen(false);

    } catch (error) {
      console.error("Error adding official:", error);
      alert(error.response?.data?.message || error.message);
    }
  };

  const [officials, setOfficials] = useState([]);

  useEffect(() => {
    const fetchOfficials = async () => {
      if (!token) return;

      try {
        const response = await axios.get("/api/brgy/get-officials", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        let allOfficials = response.data;

        if (BRGYProfile) {
          allOfficials = allOfficials.filter(
            o =>
              o.barangay === BRGYProfile.barangay &&
              o.city === BRGYProfile.city &&
              o.province === BRGYProfile.province &&
              o.region === BRGYProfile.region
          );
        }

        setOfficials(allOfficials);
      } catch (err) {
        console.error("Error fetching officials:", err);
      }
    };

    fetchOfficials();
  }, [BRGYProfile, token]);


  // =================================================
  //  DELETE ANNOUNCEMENT
  // =================================================
  const [officialToDelete, setOfficialToDelete] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const deleteOfficial = async (officialId) => {
    if (!officialId) return;

    try {
      const token = localStorage.getItem("token");

      await axios.delete(`/api/brgy/delete-official/${officialId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOfficials((prev) => prev.filter((o) => o.id !== officialId));

      setShowDeleteConfirm(false);
      setOfficialToDelete(null);

      console.log("Official deleted successfully!");
      toast.success('Official deleted successfully!');
    } catch (error) {
      console.error("Failed to delete official:", error);
      alert(error.response?.data?.message || "Failed to delete official");
    }
  };


  // =================================================
  //  HANDLE COMMENTS
  // =================================================
  const [comments, setComments] = useState([]);

  useEffect(() => {
    const fetchComments = async () => {
      if (!selectedAnnouncement) return;
      try {
        const response = await axios.get(`/api/brgy/get-comments/${selectedAnnouncement.id}`);
        setComments(response.data);
      } catch (error) {
        console.error("Failed to fetch comments:", error);
      }
    };

    fetchComments();
  }, [selectedAnnouncement]);


  // =================================================
  //  DELETE ANNOUNCEMENT
  // =================================================
  const [announcementToDelete, setAnnouncementToDelete] = useState(null);
  const [showDeleteAnnouncementConfirm, setShowDeleteAnnouncementConfirm] = useState(false);

  const handleDeleteAnnouncement = async (id) => {
    try {
      const token = localStorage.getItem("token");

      const res = await axios.delete(`/api/brgy/delete-announcement/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("Delete response:", res.data);
      setAnnouncements((prev) => prev.filter((ann) => ann.id !== id));

      toast.success("Announcement deleted successfully!");
    } catch (err) {
      console.error("Failed to delete announcement:", err.response?.data || err.message);
      toast.error("Failed to delete announcement. Please try again.");
    }
  };

  // =================================================
  //  ALERT NOTIFICATIONS
  // =================================================
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  const handleSendAlert = async (e) => {
    e.preventDefault();

    if (!alertTitle && !alertMessage) {
      alert('Please add a title or message for the alert.');
      return;
    }

    try {
      const payload = {
        title: alertTitle,
        text: alertMessage,
        sent_by_id: localStorage.getItem('userId'),
        sent_by_name: `${BRGYProfile.first_name || ''} ${BRGYProfile.last_name || ''}`.trim(),
        region: BRGYProfile?.region || '',
        province: BRGYProfile?.province || '',
        city: BRGYProfile?.city || '',
        barangay: BRGYProfile?.barangay || ''
      };

      const token = localStorage.getItem('token');

      const response = await axios.post('/api/brgy/send-alert', payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('Alert sent:', response.data);
      toast.success('Alert sent successfully!');

      setIsClosing(true);
      setTimeout(() => {
        setIsSendAlertModalOpen(false);
        setIsClosing(false);
        setAlertTitle('');
        setAlertMessage('');
      }, 300);

    } catch (error) {
      console.error('Error sending alert:', error);
      alert(error.response?.data?.message || error.message);
    }
  };


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
            marginLeft: isSidebarCollapsed ? 80 : 300,
            width: isSidebarCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 300px)',
            transition: 'margin-left 0.3s, width 0.3s',
            overflow: 'hidden'
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
            <h2 className="page-title">Barangay Profile</h2>
          </div>

          {/* Top row: 30% */}
          <div
            style={{
              flex: 2,
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              {/* 1st row: Profile picture, posts, followers */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '40px', marginBottom: 10 }}>
                {/* Profile picture */}
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={defaultProfile}
                    alt="Profile"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>

                {/* Posts */}
                <div style={{ textAlign: 'center' }}>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: 16 }}>
                    {announcements.length}
                  </p>
                  <p style={{ margin: 0, fontSize: 14 }}>
                    {announcements.length === 1 ? 'Post' : 'Posts'}
                  </p>
                </div>
              </div>

              {/* 2nd row: Announcement button, Edit button */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setAnnouncementModalOpen(true)}
                  onMouseEnter={() => setHovered('announcement')}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '5px',
                    border: '1px solid #4894FE',
                    backgroundColor: hovered === 'announcement' ? '#4894FE' : '#4894FE',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    width: 150,
                    transform: hovered === 'announcement' ? 'scale(1.05)' : 'scale(1)',
                    transition: 'all 0.3s ease',
                  }}
                >
                  Announcement
                </button>

                <button
                  onClick={() => setIsSendAlertModalOpen(true)}
                  onMouseEnter={() => setHovered('alert')}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '5px',
                    border: '1px solid #4894FE',
                    backgroundColor: '#fff',
                    color: '#4894FE',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    width: 150,
                    transform: hovered === 'alert' ? 'scale(1.05)' : 'scale(1)',
                    transition: 'all 0.3s ease',
                  }}
                >
                  Send Alert
                </button>
              </div>
            </div>
          </div>


          {/* Bottom row: 70% */}
          <div style={{ flex: 7, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Mini-navbar */}
            <div 
              className="mini-navbar"
              style={{
                display: 'flex',
                justifyContent: 'space-around',
                borderBottom: '1px solid #eee',
              }}
            >
              {['Announcement', 'Barangay Officials'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: 'transparent',
                  color: activeTab === tab ? '#4894FE' : '#000',
                  border: 'none',
                  borderBottom: activeTab === tab ? '3px solid #4894FE' : '3px solid transparent',
                  padding: '10px 20px',
                  cursor: 'pointer',
                  fontWeight: activeTab === tab ? 'bold' : 'normal',
                  transition: 'border-bottom 0.3s'
                }}
              >
                {tab}
              </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {activeTab === 'Announcement' && (
                <div>
                  {loadingAnnouncements ? (
                    <p>Loading announcements...</p>
                  ) : announcementError ? (
                    <p style={{ color: 'red' }}>{announcementError}</p>
                  ) : announcements.length === 0 ? (
                    <p>No announcements yet.</p>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)', // 6 dapat
                        gap: '15px',
                      }}
                    >
                    {announcements.map((ann, index) => {
                      const images = ann.image_urls || [];
                      const imageUrl = images.length > 0 ? images[0] : '/icons/announcement.png'; // Correct path

                      return (
                        <div
                          key={index}
                          onClick={() => {
                            setSelectedAnnouncement(ann);
                            setViewAnnouncementModalOpen(true);
                          }}
                          style={{
                            borderRadius: '8px',
                            padding: '15px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            cursor: 'pointer',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
                          }}
                        >
                          {/* Image*/}
                          <img
                            src={imageUrl}
                            alt="announcement-image"
                            style={{
                              width: '100%',
                              height: '150px',
                              objectFit: 'cover',
                              borderRadius: '8px',
                              marginBottom: '10px',
                            }}
                          />

                          {/* Text content */}
                          <h4 style={{ margin: '0 0 10px 0' }}>{ann.title || 'No Title'}</h4>
                          <p
                            style={{
                              margin: '0 0 10px 0',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {ann.text}
                          </p>
                          <div
                            style={{
                              position: "relative",
                              marginTop: "8px",
                              width: "100%",
                            }}
                          >
                            <small style={{ color: "#888" }}>
                              Posted by {ann.posted_by_name}
                            </small>

                            <img
                              src="/icons/delete.png"
                              alt="Delete"
                              style={{
                                width: "20px",
                                height: "20px",
                                position: "absolute",
                                bottom: "0",
                                right: "0",
                                cursor: "pointer",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setAnnouncementToDelete(ann);
                                setShowDeleteAnnouncementConfirm(true);
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "Barangay Officials" && (
                <div style={{ padding: "10px" }}>
                  {/* Header with Add Button */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "15px",
                    }}
                  >
                    <h3 style={{ margin: 0 }}>Emergency Hotlines</h3>
                    <button
                      onClick={() => setAddOfficialsModalOpen(true)}
                      style={{
                        backgroundColor: "#4894FE",
                        border: "none",
                        borderRadius: "50%",
                        width: "40px",
                        height: "40px",
                        color: "#fff",
                        fontSize: "24px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
                      }}
                    >
                      +
                    </button>
                  </div>

                  {/* Officials List in Two Columns */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: "10px",
                    }}
                  >
                    {officials && officials.length > 0 ? (
                      officials.map((official, index) => (
                        <div
                          key={official.id || index}
                          style={{
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            padding: "10px",
                            borderRadius: "10px",
                            gap: "15px",
                            boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
                          }}
                        >
                          {/* 3-Dots Menu */}
                          <div style={{ position: "absolute", top: "10px", right: "10px" }}>
                            <button
                              onClick={() =>
                                setSelectedOfficial(
                                  selectedOfficial?.id === official.id ? null : official
                                )
                              }
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "18px",
                                fontWeight: "bold",
                                color: "#888",
                              }}
                            >
                              ⋮
                            </button>

                            {/* Dropdown */}
                            {selectedOfficial?.id === official.id && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "25px",
                                  right: "0",
                                  background: "#fff",
                                  border: "1px solid #ddd",
                                  borderRadius: "5px",
                                  boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                                  zIndex: 10,
                                  overflow: "hidden",
                                }}
                              >
                                <button
                                  onClick={() => {
                                    setEditOfficialModalOpen(true);
                                    // setSelectedOfficial(official); // if needed for edit
                                  }}
                                  style={{
                                    display: "block",
                                    padding: "8px 12px",
                                    width: "100%",
                                    background: "none",
                                    border: "none",
                                    textAlign: "left",
                                    cursor: "pointer",
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => {
                                    setOfficialToDelete(official);
                                    setShowDeleteConfirm(true);
                                  }}
                                  style={{
                                    display: "block",
                                    padding: "8px 12px",
                                    width: "100%",
                                    background: "none",
                                    border: "none",
                                    textAlign: "left",
                                    cursor: "pointer",
                                    color: "red",
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Profile Picture */}
                          <img
                            src={
                              official.profile_picture?.url || 
                              defaultProfile
                            }
                            alt={official.name}
                            style={{
                              width: "50px",
                              height: "50px",
                              borderRadius: "50%",
                              objectFit: "cover",
                            }}
                          />

                          {/* Info */}
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <p style={{ marginBottom: 0, fontWeight: "bold", fontSize: "18px" }}>{official.name}</p>
                            <p style={{ marginBottom: 4, fontSize: "14px", color: "#666" }}>
                              {official.position}
                            </p>
                            <p style={{ margin: 0, fontSize: "12px", color: "#888" }}>
                              {official.contact_number}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p style={{ color: "#555", fontStyle: "italic", gridColumn: "1 / -1" }}>
                        No officials added yet.
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {/*
              {activeTab === 'About' && (
                <p>Information about the barangay will appear here.</p>
              )}
              */}
            </div>
          </div>


          {/* SEND ALERT MODAL */}
          {isSendAlertModalOpen && (
            <div className={`modal-overlay ${isClosing ? '' : ''}`}>
              <div className={`modal-content ${isClosing ? 'pop-out' : 'pop-in'}`}>
                <img
                  src="/icons/close.png"
                  alt="Close"
                  className="modal-close-btn"
                  onClick={() => setIsSendAlertModalOpen(false)}
                />
                <h3 className="modal-title">Send Alert</h3>
                <p className="modal-subtitle">Write your alert below to notify the community immediately.</p>
                <form onSubmit={handleSendAlert}>
                  {/* Alert Title */}
                  <div className="input-group">
                    <label className="input-label">Title (Optional)</label>
                    <input
                      type="text"
                      placeholder="Enter alert title"
                      className="modal-input"
                      value={alertTitle}
                      onChange={(e) => setAlertTitle(e.target.value)}
                    />
                  </div>

                  {/* Alert Message */}
                  <div className="input-group">
                    <textarea
                      className="modal-input"
                      placeholder="Type your alert message here..."
                      value={alertMessage}
                      onChange={(e) => setAlertMessage(e.target.value)}
                      rows={5}
                    />
                  </div>

                  {/* Buttons */}
                  <div className="modal-button-row">
                    <button type="submit" className="modal-add-button">
                      Send
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSendAlertModalOpen(false);
                      }}
                      className="modal-cancel-button"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ANNOUNCEMENT MODAL */}
          {isAnnouncementModalOpen && (
            <div className={`modal-overlay ${isClosing ? '' : ''}`}>
              <div className={`modal-content ${isClosing ? 'pop-out' : 'pop-in'}`}>
                <img
                  src="/icons/close.png"
                  alt="Close"
                  className="modal-close-btn"
                  onClick={() => setAnnouncementModalOpen(false)}
                />
                <h3 className="modal-title">Post Announcement</h3>
                <p className="modal-subtitle">Write your announcement below to share with the community.</p>
                <form onSubmit={handlePostAnnouncement}>
                  {/* Title */}
                  <div className="input-group">
                    <label className="input-label">Title (Optional)</label>
                    <input
                      type="text"
                      placeholder="Enter title"
                      className="modal-input"
                      value={announcementTitle}
                      onChange={(e) => setAnnouncementTitle(e.target.value)}
                    />
                  </div>

                  {/* Announcement Text */}
                  <div className="input-group">
                    <textarea
                      className="modal-input"
                      placeholder="Type your announcement here..."
                      value={announcementText}
                      onChange={(e) => setAnnouncementText(e.target.value)}
                      rows={5}
                    />
                  </div>

                  {/* Image Upload */}
                  <div className="input-group">
                    <label className="input-label">Add Images (Optional, max 5)</label>
                    <div
                      onClick={() => document.getElementById('announcementImageInput').click()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        height: '100px',
                        border: '2px dashed #4894FE',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        color: '#4894FE',
                        fontWeight: 'bold',
                        backgroundColor: '#f5f7ff',
                        transition: 'all 0.3s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e6efff')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f5f7ff')}
                    >
                      {announcementImage && announcementImage.length > 0
                        ? `${announcementImage.length} file(s) selected`
                        : 'Click to Upload'}
                    </div>

                    <input
                      id="announcementImageInput"
                      type="file"
                      accept="image/*"
                      multiple
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files) {
                          const filesArray = Array.from(e.target.files).slice(0, 5); // limit to 5
                          setAnnouncementImage(filesArray);
                        }
                      }}
                    />
                  </div>

                  {/* Image Previews */}
                  {announcementImage && announcementImage.length > 0 && (
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                      {announcementImage.map((file, index) => (
                        <div key={index} style={{ width: '100px', height: '100px', position: 'relative' }}>
                          {file instanceof File ? (
                            <img
                              src={URL.createObjectURL(file)}
                              alt={`Preview ${index}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <p style={{ fontSize: '10px', color: 'red' }}>Invalid file</p>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setAnnouncementImage((prev) => prev.filter((_, i) => i !== index))
                            }
                            style={{
                              position: 'absolute',
                              top: 2,
                              right: 2,
                              background: 'rgba(255,0,0,0.8)',
                              border: 'none',
                              borderRadius: '50%',
                              width: 20,
                              height: 20,
                              color: '#fff',
                              cursor: 'pointer',
                              fontSize: 12,
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Buttons */}
                  <div className="modal-button-row">
                    <button type="submit" className="modal-add-button">
                      Post
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAnnouncementModalOpen(false);
                        setAnnouncementImage(null);
                      }}
                      className="modal-cancel-button"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ADD BARANGAY OFFICIALS MODAL */}
          {isAddOfficialsModalOpen && (
            <div className={`modal-overlay ${isClosing ? '' : ''}`}>
              <div className={`modal-content ${isClosing ? 'pop-out' : 'pop-in'}`}>
                <img
                  src="/icons/close.png"
                  alt="Close"
                  className="modal-close-btn"
                  onClick={() => setAddOfficialsModalOpen(false)}
                />
                <h3 className="modal-title">Add Barangay Official</h3>
                <p className="modal-subtitle">Fill in the details of the new official.</p>
                <form onSubmit={handleAddOfficial}>
                  
                  {/* Name */}
                  <div className="input-group">
                    <label className="input-label">Full Name</label>
                    <input
                      type="text"
                      placeholder="Enter name"
                      className="modal-input"
                      value={officialName}
                      onChange={(e) => setOfficialName(e.target.value)}
                      required
                    />
                  </div>

                  {/* Position */}
                  <div className="input-group">
                    <label className="input-label">Position</label>
                    <input
                      type="text"
                      placeholder="Enter position"
                      className="modal-input"
                      value={officialPosition}
                      onChange={(e) => setOfficialPosition(e.target.value)}
                      required
                    />
                  </div>

                  {/* Contact Number */}
                  <div className="input-group">
                    <label className="input-label">Contact Number</label>
                    <input
                      type="text"
                      placeholder="Enter contact number"
                      className="modal-input"
                      value={officialContact}
                      onChange={(e) => {
                        let value = e.target.value;
                        if (value.includes(' ')) return;

                        // Format and sanitize input
                        if (!value.startsWith('+639')) {
                          value = '+639' + value.replace(/\D/g, '').slice(0, 9);
                        } else {
                          value = '+639' + value.slice(4).replace(/\D/g, '').slice(0, 9);
                        }

                        setOfficialContact(value);
                      }}
                      required
                    />
                  </div>

                  {/* Profile Picture */}
                  <div className="input-group">
                    <label className="input-label">Upload a Photo</label>
                    <div
                      onClick={() => document.getElementById('officialImageInput').click()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '30%',
                        height: '100px',
                        border: '2px dashed #4894FE',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        color: '#4894FE',
                        fontWeight: 'bold',
                        backgroundColor: '#f5f7ff',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      {officialImage ? (
                        <img
                          src={URL.createObjectURL(officialImage)}
                          alt="Preview"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: '10px',
                          }}
                        />
                      ) : (
                        ''
                      )}
                    </div>

                    <input
                      id="officialImageInput"
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setOfficialImage(e.target.files[0]);
                        }
                      }}
                    />
                  </div>

                  {/* Buttons */}
                  <div className="modal-button-row">
                    <button type="submit" className="modal-add-button">
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddOfficialsModalOpen(false);
                        setOfficialImage(null);
                      }}
                      className="modal-cancel-button"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* DELETE CONFIRMATION MODAL FOR OFFICIALS */}
          {showDeleteConfirm && officialToDelete && (
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
                style={{ maxWidth: '400px' }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
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

                {/* Icon */}
                <div className="icon-container">
                  <img src="/icons/delete.png" alt="Delete" className="icon-delete" />
                </div>

                {/* Title */}
                <h3 className="modal-title" style={{ textAlign: 'center' }}>Delete</h3>
                <p className="sub-title" style={{ textAlign: 'center' }}>
                  Are you sure you want to delete this official?
                </p>

                {/* Official Name */}
                <div className="location-text" style={{ textAlign: 'center', marginBottom: "12px" }}>
                  {officialToDelete?.name || 'N/A'}
                </div>

                {/* Buttons */}
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
                    onClick={() => deleteOfficial(officialToDelete.id)}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW ANNOUNCEMENT MODAL */}
          {isViewAnnouncementModalOpen && selectedAnnouncement && (
            <div
              className="modal-overlay"
              onClick={() => setViewAnnouncementModalOpen(false)}
              style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            >
              <div
                className="modal-content pop-in"
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '90%',
                  maxWidth: '600px',
                  maxHeight: '80vh',
                  backgroundColor: '#fff',
                  borderRadius: '10px',
                  padding: '20px',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Close Button */}
                <img
                  src="/icons/close.png"
                  alt="Close"
                  className="modal-close-btn"
                  onClick={() => setViewAnnouncementModalOpen(false)}
                  style={{
                    cursor: 'pointer',
                    position: 'absolute',
                    top: '15px',
                    right: '15px',
                    width: '12px',
                    height: '12px',
                  }}
                />

                {/* Announcement */}
                <h3 className="modal-title">{selectedAnnouncement.title || 'No Title'}</h3>
                <p style={{ color: '#888', marginBottom: '10px' }}>
                  Posted by {selectedAnnouncement.posted_by_name}
                </p>
                {selectedAnnouncement.image_urls?.length > 0 && (
                  <img
                    src={selectedAnnouncement.image_urls[0]}
                    alt="Announcement"
                    style={{
                      width: '100%',
                      maxHeight: '250px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      marginBottom: '15px',
                    }}
                  />
                )}
                <p>{selectedAnnouncement.text}</p>

                {/* Comments Section */}
                <div
                  style={{
                    marginTop: '20px',
                    flex: 1,
                    overflowY: 'auto',
                    borderTop: '1px solid #eee',
                    paddingTop: '10px',
                  }}
                >
                  <h4 style={{ marginBottom: '10px' }}>Comments</h4>
                  {comments.length === 0 && <p>No comments yet.</p>}
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      style={{
                        padding: '8px',
                        borderRadius: '6px',
                      }}
                    >
                      <strong>
                        {comment.first_name} {comment.last_name}
                      </strong>{' '}
                      <small style={{ color: '#666', fontSize: '12px' }}>
                        {new Date(comment.created_at).toLocaleString()}
                      </small>
                      <p style={{ marginTop: '4px' }}>{comment.comment_text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* DELETE CONFIRMATION MODAL */}
          {showDeleteAnnouncementConfirm && announcementToDelete && (
            <div
              className="modal-overlay"
              onClick={() => {
                setIsClosing(true);
                setTimeout(() => {
                  setShowDeleteAnnouncementConfirm(false);
                  setIsClosing(false);
                  setAnnouncementToDelete(null);
                }, 200);
              }}
            >
              <div
                className={`modal-content ${isClosing ? "pop-out" : "pop-in"}`}
                style={{ maxWidth: "400px" }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                <img
                  src="/icons/close.png"
                  alt="Close"
                  className="modal-close-btn"
                  onClick={() => {
                    setIsClosing(true);
                    setTimeout(() => {
                      setShowDeleteAnnouncementConfirm(false);
                      setIsClosing(false);
                      setAnnouncementToDelete(null);
                    }, 200);
                  }}
                />

                {/* Icon */}
                <div className="icon-container">
                  <img src="/icons/delete.png" alt="Delete" className="icon-delete" />
                </div>

                {/* Title */}
                <h3 className="modal-title" style={{ textAlign: "center" }}>
                  Delete Announcement
                </h3>
                <p className="sub-title" style={{ textAlign: "center" }}>
                  Are you sure you want to delete this announcement?
                </p>

                {/* Announcement Title */}
                <div
                  className="location-text"
                  style={{ textAlign: "center", marginBottom: "12px" }}
                >
                  {announcementToDelete?.title || "Untitled"}
                </div>

                {/* Buttons */}
                <div className="button-container">
                  <button
                    className="cancel-button"
                    onClick={() => {
                      setIsClosing(true);
                      setTimeout(() => {
                        setShowDeleteAnnouncementConfirm(false);
                        setIsClosing(false);
                        setAnnouncementToDelete(null);
                      }, 200);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="confirm-button"
                    onClick={() => {
                      handleDeleteAnnouncement(announcementToDelete.id);
                      setShowDeleteAnnouncementConfirm(false);
                      setAnnouncementToDelete(null);
                    }}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}