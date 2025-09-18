import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import LGUNavbar from '../../../components/NavBar/LGU-Navbar';
import LGUSidebar from '../../../components/SideBar/LGU-Sidebar';
import axios from '../../../axios/axiosInstance';
import './LGU-Support-Tickets.css';
import { ToastContainer } from 'react-toastify';
import { Player } from '@lottiefiles/react-lottie-player';
import noDataAnim from '@/assets/animations/non data found.json';
import Select from 'react-select';

export default function LGUManageFeedback() {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  const [LGUProfile, setLGUProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedbacks, setFeedbacks] = useState([]);
  const [sortOption, setSortOption] = useState('date-desc');
  const [searchQuery, setSearchQuery] = useState('');

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
// Fetch Feedbacks by LGU Location
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

    // Filter by city to ensure LGU sees only their city
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
  let result = list.filter(fb =>
    fb.feedback_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    fb.messages?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    fb.concerned_barangay?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                <th className="table-header">Type</th>
                <th className="table-header">Messages</th>
                <th className="table-header">Barangay</th>
                <th className="table-header">Submitted At</th>
                <th className="table-header">Images / Video</th>
              </tr>
            </thead>
            <tbody>
              {filteredFeedbacks.map(fb => (
                <tr key={fb.id}>
                  <td className="table-cell">{`FB-${String(fb.id).padStart(5, '0')}`}</td>
                  <td className="table-cell">{fb.feedback_type}</td>
                  <td className="table-cell">{fb.messages}</td>
                  <td className="table-cell">{fb.concerned_barangay}</td>
                  <td className="table-cell">{new Date(fb.submitted_at).toLocaleString()}</td>
                  <td className="table-cell">
                    {fb.images?.length > 0 && fb.images.map((img, i) => (
                      <img
                        key={i}
                        src={img.url}
                        alt="feedback"
                        style={{ width: 50, height: 50, marginRight: 4, borderRadius: 4 }}
                      />
                    ))}
                    {fb.video && (
                      <video width="80" height="50" controls>
                        <source src={fb.video.url} type="video/mp4" />
                      </video>
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
      <LGUNavbar userId={userId} />
      <div className="layout">
        <LGUSidebar
          isCollapsed={isSidebarCollapsed}
          toggleSidebar={() => setSidebarCollapsed(!isSidebarCollapsed)}
        />
        <div
          className="main-content mainContent-slide-right"
          style={{
            marginLeft: isSidebarCollapsed ? 80 : 270,
            width: isSidebarCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 270px)'
          }}
        >
          <ToastContainer />
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
              {/* Optional button for future actions */}
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
  );
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