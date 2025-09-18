import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import LGUNavbar from '../../../components/NavBar/LGU-Navbar';
import LGUSidebar from '../../../components/SideBar/LGU-Sidebar';
import axios from '../../../axios/axiosInstance';
import './LGU-Manage-Barangay.css';
import { ToastContainer, toast } from 'react-toastify';
import { Player } from '@lottiefiles/react-lottie-player';
import noBarangayAnim from '@/assets/animations/non data found.json';
import Select from 'react-select';
import {
  regions,
  getProvincesByRegion,
  getCityMunByProvince,
  getBarangayByMun,
} from 'phil-reg-prov-mun-brgy';

export default function LGUManageBarangay() {
    const navigate = useNavigate();
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    const [LGUProfile, setLGUProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // ADD BARANGAY
    const [barangayDirectory, setBarangayDirectory] = useState([]);
    const [isAddBarangayModalOpen, setIsAddBarangayModalOpen] = useState(false);
    const addBarangayButton = () => setIsAddBarangayModalOpen(true);
    const [selectedBarangay, setSelectedBarangay] = useState('');
    const [barangayCaptain, setBarangayCaptain] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [address, setAddress] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // DELETE BARANGAY
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [barangayToDelete, setBarangayToDelete] = useState(null);



    const [sortOption, setSortOption] = useState('default');
    const [searchQuery, setSearchQuery] = useState('');

    // ADD BARANGAY USER ACCOUNT
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [barangayAccounts, setBarangayAccounts] = useState([]);
  const [isViewAccountModalOpen, setIsViewAccountModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [activeTab, setActiveTab] = useState('details');


// Edit
const [isEditMode, setIsEditMode] = useState(false);
const [editingBarangayId, setEditingBarangayId] = useState(null);

// Error Handling
const [focusedInput, setFocusedInput] = useState(null);
const [phoneNumberError, setPhoneNumberError] = useState('');

  // =================================================
  //  CONVERT
  // =================================================
  const capitalizeWords = (str) =>
    str?.toLowerCase().replace(/\b\w/g, char => char.toUpperCase()) || '';

  // =================================================
  //  SORT FUNCTION (define first)
  // =================================================
  const sortOptions = [
    { value: 'barangay-name-asc', label: 'Sort by Barangay' },
    { value: 'date-asc', label: 'Sort by Date' },
  ];

  const sortBarangay = (barangay, option) => {
    const sorted = [...barangay];
    switch (option) {
      case 'barangay-name-asc':
        return sorted.sort((a, b) =>
          a.barangay_name?.localeCompare(b.barangay_name)
        );
      case 'date-asc':
        return sorted.sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
      default:
        return sorted;
    }
  };

  // =================================================
  //  SEARCH FUNCTION
  // =================================================
  const filterBarangays = (barangay) => {
    return barangay.filter((acc) => {
      const query = searchQuery.toLowerCase();
      return (
        acc.barangay_name?.toLowerCase().includes(query) ||
        acc.barangay_captain?.toLowerCase().includes(query) ||
        acc.phone_number?.toLowerCase().includes(query) ||
        acc.barangay_address?.toLowerCase().includes(query) ||
        acc.created_by?.toLowerCase().includes(query)
      );
    });
  };

    // =================================================
    //  APPLY FILTER, THEN SORT
    // =================================================
    const displayBarangays = useMemo(() => {
    const filtered = filterBarangays(barangayDirectory);
    return sortBarangay(filtered, sortOption);
    }, [barangayDirectory, searchQuery, sortOption]);



    useEffect(() => {
        if (!userId || !token) {
        setError('User not logged in.');
        setLoading(false);
        return;
        }

        const fetchProfile = async () => {
        try {
            const response = await axios.get(`/api/auth/lgu-admin-profile/${userId}`);
            setLGUProfile(response.data);
        } catch (error) {
            console.error('Failed to fetch profile:', error);
            setError('Failed to load profile.');
        } finally {
            setLoading(false);
        }
        };

        fetchProfile();
    }, [userId, token]);


    // =================================================
    //  BARANGAY LIST
    // =================================================
    const barangayList = useMemo(() => {
    if (!LGUProfile?.region || !LGUProfile?.province || !LGUProfile?.city) return [];

    const regionLabelToCode = regions.reduce((map, region) => {
        map[region.name] = region.reg_code;
        return map;
    }, {});
    
    const regCode = regionLabelToCode[LGUProfile.region];
    if (!regCode) {
        console.warn('Region code not found for:', LGUProfile.region);
        return [];
    }

    const provinces = getProvincesByRegion(regCode);
    console.log("Provinces for region:", LGUProfile.region, provinces.map(p => p.name));

    const matchedProvince = provinces.find(
        (prov) =>
        prov.name.toLowerCase().includes(LGUProfile.province.toLowerCase().trim()) ||
        LGUProfile.province.toLowerCase().includes(prov.name.toLowerCase().trim())
    );

    if (!matchedProvince) {
        console.warn('Province not matched:', LGUProfile.province);
        return [];
    }

    const cities = getCityMunByProvince(matchedProvince.prov_code);

    const normalize = (str) =>
    str.toLowerCase().replace(/ city| municipality/g, '').trim();

    const matchedCity = cities.find(
    (c) => normalize(c.name) === normalize(LGUProfile.city)
    );

    if (!matchedCity) {
    console.warn('City not matched:', LGUProfile.city);
    console.log('Available cities:', cities.map(c => c.name));
    return [];
    }

    return getBarangayByMun(matchedCity.mun_code);
    }, [LGUProfile]);











// GET BARANGAY BY LOCATION
const fetchBarangayDirectory = async () => {
  if (!LGUProfile || !LGUProfile.region || !LGUProfile.province || !LGUProfile.city) return;

  try {
    const response = await axios.get(`/api/lgu/all-barangays-by-location`, {
      params: {
        region: LGUProfile.region,
        province: LGUProfile.province,
        city: LGUProfile.city,
      },
    });
    setBarangayDirectory(response.data);
  } catch (error) {
    console.error('Error fetching barangays:', error);
  }
};

useEffect(() => {
  if (token && LGUProfile) {
    fetchBarangayDirectory();
  }
}, [token, LGUProfile]);





    // =================================================
    //  ADD BARANGAY
    // =================================================
    const handleAddBarangay = async (e) => {
      e.preventDefault();

      if (!selectedBarangay || !barangayCaptain || !phoneNumber || !address) {
        toast.error('Please fill in all fields');
        return;
      }

      const payload = {
        lgu_id: userId,
        region: LGUProfile?.region,
        province: LGUProfile?.province,
        city: LGUProfile?.city,
        created_by: `${LGUProfile?.first_name || ''} ${LGUProfile?.last_name || ''}`.trim(),
        barangay_name: selectedBarangay,
        barangay_captain: barangayCaptain,
        phone_number: phoneNumber,
        barangay_address: address,
      };

      try {
        if (isEditMode && editingBarangayId) {
          // EDIT MODE
          await axios.put(`/api/lgu/update-barangay/${editingBarangayId}`, payload);
          toast.success('Barangay updated successfully!');
        } else {
          // ADD MODE
          await axios.post('/api/lgu/add-barangay', payload);
          toast.success('Barangay added successfully!');
        }

        // Reset form
        setSelectedBarangay('');
        setBarangayCaptain('');
        setPhoneNumber('');
        setAddress('');
        setEditingBarangayId(null);
        setIsEditMode(false);
        fetchBarangayDirectory();
        handleClose();
      } catch (err) {
        console.error('Error submitting barangay:', err.response?.data || err.message);
        toast.error(`Error saving barangay: ${err.response?.data?.message || err.message}`);
      }
    };




const handleClose = () => {
  setIsClosing(true);
  setTimeout(() => {
    setIsAddBarangayModalOpen(false);
    setSelectedBarangay('');
    setBarangayCaptain('');
    setPhoneNumber('');
    setAddress('');
    setSuccessMessage('');
    setIsEditMode(false);
    setEditingBarangayId(null);
    setIsClosing(false);
  }, 200);
};


const closeAddBarangayUserModal = () => {
  setIsClosing(true); // trigger closing animation
  setTimeout(() => {
    setIsAddUserModalOpen(false);
    setUserForm({
      username: '',
      firstName: '',
      lastName: '',
      password: '',
      phoneNumber: '',
      position: '',
    });
    setSelectedBarangay('');
    setIsClosing(false); // reset animation state
  }, 200); // match your modal closing animation duration
};

const closeViewAccountModal = () => {
  setIsClosing(true); // Trigger the closing animation
  setTimeout(() => {
    setIsViewAccountModalOpen(false); // Actually close the modal
    setSelectedAccount(null); // Optional: clear selected account
    setIsClosing(false); // Reset closing state
  }, 200); // Match with your CSS animation duration
};



// =================================================
//  DELETE BARANGAY
// =================================================
const deleteBarangay = async (id) => {
  try {
    const response = await axios.delete(`/api/lgu/delete-barangay/${id}`);

    setBarangayDirectory(prev => prev.filter(acc => acc.id !== id));
    setShowDeleteConfirm(false);
    setBarangayToDelete(null);

    toast.success(response.data?.message || 'Barangay successfully deleted.');
  } catch (error) {
    console.error('Failed to delete Barangay:', error);

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

    toast.error(data?.error || 'Failed to delete Barangay. Please try again.');
  }
};

// =================================================
//  ADD BARANGAY USER ACCOUNT
// =================================================
const [userForm, setUserForm] = useState({
  username: '',
  firstName: '',
  lastName: '',
  password: '',
  phoneNumber: '',
  position: '',
});


const handleAddUserAccount = async (e) => {
  e.preventDefault();

  console.group('🛠️ handleAddUserAccount triggered');
  console.log('👤 Current userForm:', JSON.stringify(userForm, null, 2));
  console.log('🏘️ Selected Barangay:', selectedBarangay);
  console.log('📜 LGUProfile:', JSON.stringify(LGUProfile, null, 2));
  console.log('🆔 User ID:', userId);

  const payload = {
    username: userForm.username,
    firstName: userForm.firstName,
    lastName: userForm.lastName,
    password: userForm.password,
    phonenumber: userForm.phoneNumber,
    position: userForm.position,
    lguId: userId,
    region: LGUProfile.region,
    province: LGUProfile.province,
    city: LGUProfile.city,
    barangay: selectedBarangay,
    created_by: LGUProfile.last_name || LGUProfile.first_name,
  };

  console.log('📤 Constructed payload:', JSON.stringify(payload, null, 2));

  const missingFields = Object.entries(payload)
    .filter(([key, value]) => value === undefined || value === null || value === '')
    .map(([key]) => key);

  if (missingFields.length > 0) {
    console.warn(`⚠️ Missing fields: ${missingFields.join(', ')}`);
    toast.error(`Please fill in all fields: ${missingFields.join(', ')}`);
    console.groupEnd();
    return;
  }

  try {
    console.log('🚀 Sending POST request to /api/lgu/add-barangay-account...');
    const res = await axios.post('/api/lgu/add-barangay-account', payload);

    console.log('Account created:', res.data);
    toast.success(`Barangay User Account Created by ${LGUProfile.first_name} ${LGUProfile.last_name}`);


    setUserForm({
      username: '',
      firstName: '',
      lastName: '',
      password: '',
      phoneNumber: '',
      position: '',
    });
    setIsAddUserModalOpen(false);
  } catch (error) {
    console.error('❌ Error creating account:');

    if (error.response) {
      console.group('📨 Server error response');
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
      toast.error(`❌ ${error.response.data.message || 'Server error occurred.'}`);
      console.groupEnd();
    } else if (error.request) {
      console.group('📡 No response from server');
      console.error(error.request);
      toast.error('❌ No response from server. Check network or backend.');
      console.groupEnd();
    } else {
      console.group('🔧 Request setup error');
      console.error(error.message);
      toast.error('❌ Request error. See console.');
      console.groupEnd();
    }
  }

  console.groupEnd();
};




const fetchBarangayAccounts = async (lguId, barangay) => {
  try {
    const response = await axios.get(`/api/lgu/view-created-account/${lguId}/${barangay}`);
    console.log('[DEBUG] Accounts fetched:', response.data);
    setBarangayAccounts(response.data);
  } catch (err) {
    console.error('[ERROR] Fetch failed:', err);
  }
};

const handleRowClick = async (acc) => {
  if (!acc.barangay_name) {
    console.warn('[WARN] Missing barangay in:', acc);
    return;
  }

  setSelectedAccount(acc);
  await fetchBarangayAccounts(acc.lgu_id, acc.barangay_name);
  setIsViewAccountModalOpen(true);
};







  
const renderTable = (barangay = []) => {
  if (barangay.length === 0) {
    return (
      <div className="no-barangay-wrapper">
        <div className="no-barangay-content">
          <Player
            autoplay
            loop
            src={noBarangayAnim}
            style={{ height: '240px', width: '240px' }}
          />
          <h2 className="no-barangay-title">No Barangay Records</h2>
          <p className="no-barangay-subtext">
            There are currently no barangay records available. Please add one to get started.
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
              <th className="table-header" style={{ width: '200px' }}>Barangay ID</th>
              <th className="table-header">Barangay Name</th>
              <th className="table-header">Contact Number</th>
              <th className="table-header">Barangay Address</th>
              <th className="table-header">Action</th>
            </tr>
          </thead>
          <tbody>
            {barangay.map((acc) => (
              <tr key={acc.id} onClick={() => handleRowClick(acc)} style={{ cursor: 'pointer' }}>
                <td className="table-cell">{`BRGY-${String(acc.id).padStart(5, '0')}`}</td>
                <td className="table-cell">{acc.barangay_name}</td>
                <td className="table-cell">{acc.phone_number}</td>
                <td className="table-cell">{acc.barangay_address}</td>
                <td className="table-cell">
                  <img
                    src="/icons/add-user-row.png"
                    alt="Add"
                    className="table-icon-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBarangay(acc.barangay_name);
                      setIsAddUserModalOpen(true);
                    }}
                  />
                  <img
                    src="/icons/edit-row.png"
                    alt="Edit"
                    className="table-icon-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBarangay(acc.barangay_name);
                      setBarangayCaptain(acc.barangay_captain);
                      setPhoneNumber(acc.phone_number);
                      setAddress(acc.barangay_address);
                      setEditingBarangayId(acc.id);
                      setIsEditMode(true);
                      setIsAddBarangayModalOpen(true);
                    }}
                  />
                  <img
                    src="/icons/delete-row.png"
                    alt="Delete"
                    className="table-icon-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBarangayToDelete(acc);
                      setShowDeleteConfirm(true);
                    }}
                  />
                  <img
                    src="/icons/dashboard.png"
                    alt="Dashboard"
                    className="table-icon-button"
                    onClick={(e) => {
                      //e.stopPropagation();
                      //setBarangayToDelete(acc);
                      //setShowDeleteConfirm(true);
                    }}
                  />
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
        <>
    <div className="wrapper">
      <div>
          <LGUNavbar userId={userId} />
      </div>
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
            <h2 className="page-title">Barangay Management</h2>
            <div>
              <input
                type="text"
                placeholder="Search..."
                className="search-box"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                />
              <button className="add-barangay-button"
                onClick={addBarangayButton}
              >
                Add Barangay
              </button>
            </div>
          </div>


          <div className="section-wrapper">
            <div className="table-section">
                <div className="header-table">
                    <h3 className="section-title">Barangay Directory</h3>
                    <Select
                        options={sortOptions}
                        value={sortOptions.find((option) => option.value === sortOption)}
                        styles={sortDropdownStyles}
                        isSearchable={false}
                        onChange={(option) => setSortOption(option.value)}
                    />
                </div>
              {renderTable(displayBarangays)}
            </div>
          </div>
        </div>
      </div>

      {/* ADD BARANGAY MODAL */}
      {isAddBarangayModalOpen && (
          <div className={`modal-overlay ${isClosing ? '' : ''}`}>
          <div className={`modal-content ${isClosing ? 'pop-out' : 'pop-in'}`}>
            <img
              src="/icons/close.png"
              alt="Close"
              className="modal-close-btn"
              onClick={handleClose}
            />
            <h3 className="modal-title">
              {isEditMode ? 'Edit Barangay' : 'Add Barangay'}
            </h3>
              <p className="modal-subtitle">Complete the form below to add a new barangay to your jurisdiction.</p>
              <form onSubmit={handleAddBarangay}>

                {/* Barangay Name Input */}
                <div className="input-group">
                  {isEditMode ? (
                    <input
                      type="text"
                      className="modal-input"
                      value={selectedBarangay}
                      readOnly
                    />
                  ) : (
                    <Select
                      options={barangayList
                        .filter((b) =>
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
                        setSelectedBarangay(selectedOption?.value || '')
                      }
                      placeholder="Select Barangay"
                      styles={dropdownStyles}
                    />
                  )}
                </div>

                {/* Barangay Captain Input */}
                <div className="input-group">
                    <label className="input-label">
                        Barangay Captain
                    </label>
                    <input
                        id="barangayCaptain"
                        type="text"
                        placeholder="Enter Barangay Captain's name"
                        value={barangayCaptain}
                        onChange={(e) => setBarangayCaptain(e.target.value)}
                        className="modal-input"
                    />
                </div>

                {/* Barangay Phone Number Input */}
                <div className="input-group">
                  <label className="input-label">Phone Number</label>
                  <input
                    className={`modal-input ${focusedInput === 'phoneNumber' ? 'input-focus' : ''} ${phoneNumberError ? 'input-error' : ''}`}
                    onFocus={() => setFocusedInput('phoneNumber')}
                    onBlur={() => setFocusedInput(null)}
                    placeholder="+639XXXXXXXXX"
                    value={phoneNumber}
                    onChange={(e) => {
                      let value = e.target.value;
                      if (value.includes(' ')) return;

                      // Format and sanitize input
                      if (!value.startsWith('+639')) {
                        value = '+639' + value.replace(/\D/g, '').slice(0, 9);
                      } else {
                        value = '+639' + value.slice(4).replace(/\D/g, '').slice(0, 9);
                      }

                      setPhoneNumber(value);

                      // Validation
                      if (value.length !== 13) {
                        setPhoneNumberError('Phone number must be +639 followed by 9 digits');
                      } else {
                        setPhoneNumberError('');
                      }
                    }}
                  />
                  {phoneNumberError && <p className="input-error-message">{phoneNumberError}</p>}
                </div>

                {/* Barangay Address Input */}
                <div className="input-group">
                    <label className="input-label">
                        Barangay Address
                    </label>
                    <input
                        id="barangayAddress"
                        type="text"
                        placeholder="Enter the Barangay Address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="modal-input"
                    />
                </div>

                <div className="modal-button-row">
                  <button type="submit" className="modal-add-button">
                    {isEditMode ? 'Update Barangay' : 'Add Barangay'}
                  </button>
                  <button type="button" onClick={handleClose} className="modal-cancel-button">Cancel</button>
                </div>
              </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
{showDeleteConfirm && barangayToDelete && (
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
      <p className="sub-title" style={{ textAlign: 'center' }}>Are you sure you want to delete this account?</p>

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
          Barangay {barangayToDelete?.barangay_name ? capitalizeWords(barangayToDelete.barangay_name) : 'N/A'}
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
          onClick={() => deleteBarangay(barangayToDelete.id)}
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
)}


      {/* ADD BARANGAY USER MODAL */}
      {isAddUserModalOpen && (
        <div className="modal-overlay">
          <div className={`modal-content ${isClosing ? 'pop-out' : 'pop-in'}`}>
            <div className="add-user-content">
              <img
                src="/icons/close.png"
                alt="Close"
                className="modal-close-btn"
                onClick={closeAddBarangayUserModal}
              />

              <h3 className="modal-title">Add Barangay User Account</h3>

              <form onSubmit={handleAddUserAccount}>
                {/* Username */}
                <div className="input-group">
                  <label htmlFor="username" className="input-label">Username</label>
                  <input
                    id="username"
                    type="text"
                    placeholder="Enter the Username"
                    value={userForm.username}
                    onChange={(e) =>
                      setUserForm({ ...userForm, username: e.target.value })
                    }
                    className="modal-input"
                  />
                </div>

                {/* First Name */}
                <div className="input-group">
                  <label htmlFor="firstName" className="input-label">First Name</label>
                  <input
                    id="firstName"
                    type="text"
                    placeholder="Enter First Name"
                    value={userForm.firstName}
                    onChange={(e) =>
                      setUserForm({ ...userForm, firstName: e.target.value })
                    }
                    className="modal-input"
                  />
                </div>

                {/* Last Name */}
                <div className="input-group">
                  <label htmlFor="lastName" className="input-label">Last Name</label>
                  <input
                    id="lastName"
                    type="text"
                    placeholder="Enter Last Name"
                    value={userForm.lastName}
                    onChange={(e) =>
                      setUserForm({ ...userForm, lastName: e.target.value })
                    }
                    className="modal-input"
                  />
                </div>

                      {/* Phone Number */}
<div className="input-group">
  <label className="input-label">Phone Number</label>
  <input
    className={`modal-input ${focusedInput === 'phoneNumber' ? 'input-focus' : ''} ${phoneNumberError ? 'input-error' : ''}`}
    onFocus={() => setFocusedInput('phoneNumber')}
    onBlur={() => setFocusedInput(null)}
    placeholder="+639XXXXXXXXX"
    value={userForm.phoneNumber}
    onChange={(e) => {
      let value = e.target.value;

      // Prevent spaces
      if (value.includes(' ')) return;

      // Sanitize and format phone number
      if (!value.startsWith('+639')) {
        value = '+639' + value.replace(/\D/g, '').slice(0, 9);
      } else {
        value = '+639' + value.slice(4).replace(/\D/g, '').slice(0, 9);
      }

      // Update form state correctly
      setUserForm((prev) => ({
        ...prev,
        phoneNumber: value
      }));

      // Set validation error if needed
      if (value.length !== 13) {
        setPhoneNumberError('Phone number must be +639 followed by 9 digits');
      } else {
        setPhoneNumberError('');
      }
    }}
  />
  {phoneNumberError && <p className="input-error-message">{phoneNumberError}</p>}
</div>


                {/* Position */}
                <div className="input-group">
                  <label htmlFor="position" className="input-label">Position</label>
                  <input
                    id="position"
                    type="text"
                    placeholder="Enter Position"
                    value={userForm.position}
                    onChange={(e) =>
                      setUserForm({ ...userForm, position: e.target.value })
                    }
                    className="modal-input"
                  />
                </div>

                {/* Password */}
                <div className="input-group">
                  <label htmlFor="password" className="input-label">Password</label>
                  <input
                    id="password"
                    type="password"
                    placeholder="Enter Password"
                    value={userForm.password}
                    onChange={(e) =>
                      setUserForm({ ...userForm, password: e.target.value })
                    }
                    className="modal-input"
                  />
                </div>

                {/* Buttons */}
                <div className="modal-button-row">
                  <button type="submit" className="modal-add-button">Create User</button>
                  <button
                    type="button"
                    onClick={closeAddBarangayUserModal}
                    className="modal-cancel-button"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}



{isViewAccountModalOpen && selectedAccount && (
  <div className="modal-overlay">
    <div className={`modal-content ${isClosing ? 'pop-out' : 'pop-in'}`}>
      <img
        src="/icons/close.png"
        alt="Close"
        className="modal-close-btn"
        onClick={closeViewAccountModal}
      />

      {/* Mini Nav Bar */}
      <div className="modal-tabs">
        <button
          className={`tab-button ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Barangay Details
        </button>
        <button
          className={`tab-button ${activeTab === 'staff' ? 'active' : ''}`}
          onClick={() => setActiveTab('staff')}
        >
          Barangay Staff
        </button>
      </div>

      {/* Content Switch with Animation */}
      <div className={`modal-tab-content fade-slide ${activeTab}`}>
        {activeTab === 'details' ? (
          <div className="modern-details-card">
            <div className="detail-row">
              <span className="detail-label">Barangay Name</span>
              <span className="detail-value">{selectedAccount.barangay_name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Barangay Captain</span>
              <span className="detail-value">{selectedAccount.barangay_captain}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Phone Number</span>
              <span className="detail-value">{selectedAccount.phone_number}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Barangay Address</span>
              <span className="detail-value">{selectedAccount.barangay_address}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Added By</span>
              <span className="detail-value">{selectedAccount.created_by}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Date Added</span>
              <span className="detail-value">
                {selectedAccount.created_at
                  ? new Date(selectedAccount.created_at).toLocaleDateString()
                  : '—'}
              </span>
            </div>
          </div>
        ) : (
          <div className="barangay-staff">
            <h4>Created User Accounts:</h4>
            <div className="staff-card-grid">
              {barangayAccounts.length > 0 ? (
                barangayAccounts.map((user, index) => (
                  <div className="staff-card" key={index}>
                    <p><strong>Username:</strong> {user.username}</p>
                    <p><strong>Full Name:</strong> {user.first_name} {user.last_name}</p>
                    <p><strong>Position:</strong> {user.position}</p>
                    <p><strong>Phone:</strong> {user.phone_number}</p>
                  </div>
                ))
              ) : (
                <p style={{ textAlign: 'center', marginTop: '20px' }}>No accounts found.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="modal-button-row">
        <button onClick={closeViewAccountModal} className="modal-cancel-button">
          Close
        </button>
      </div>
    </div>
  </div>
)}






    </div>
    </>
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