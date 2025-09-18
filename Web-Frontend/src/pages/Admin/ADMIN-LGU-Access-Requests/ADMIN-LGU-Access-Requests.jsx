import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../../axios/axiosInstance';
import ADMINNavbar from '../../../components/NavBar/ADMIN-Navbar';
import ADMINSidebar from '../../../components/SideBar/ADMIN-Sidebar';
import '../../Admin/ADMIN-LGU-Access-Requests/ADMIN-LGU-Access-Requests.css';
import Select from 'react-select';
import { ToastContainer, toast } from 'react-toastify';
import { Player } from '@lottiefiles/react-lottie-player';
import noData from '@/assets/animations/non data found.json';
import 'react-toastify/dist/ReactToastify.css';

export default function ADMIN_LGUAccessRequests() {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [pendingAccounts, setPendingAccounts] = useState([]);
  const [approvedAccounts, setApprovedAccounts] = useState([]);
  const [rejectedAccounts, setRejectedAccounts] = useState([]);
  const [accountView, setAccountView] = useState('active');

  const [selectedAccount, setSelectedAccount] = useState(null);
  const [username, setUsername] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [pendingSortOption, setPendingSortOption] = useState('default');
  const [approvedSortOption, setApprovedSortOption] = useState('default');
  const [rejectedSortOption, setRejectedSortOption] = useState('default');

  const [adminData, setAdminData] = useState(null);


  // =================================================
  //  CONVERT
  // =================================================
  const capitalizeWords = (str) =>
    str?.toLowerCase().replace(/\b\w/g, char => char.toUpperCase()) || '';

  const accountStatusOptions = [
    { value: 'active', label: 'Active Accounts' },
    { value: 'rejected', label: 'Rejected Accounts' },
    { value: 'all', label: 'All Accounts' },
  ];

  // =================================================
  //  SORT FUNCTION (define first)
  // =================================================
  const sortOptions = [
    { value: 'province-asc', label: 'Sort by Province' },
    { value: 'region-asc', label: 'Sort by Region' },
    { value: 'city-asc', label: 'Sort by City' },
  ];

  const sortAccounts = (accounts, sortOption) => {
    const sorted = [...accounts];
    switch (sortOption) {
      case 'province-asc':
        return sorted.sort((a, b) => a.province?.localeCompare(b.province));
      case 'region-asc':
        return sorted.sort((a, b) => a.region?.localeCompare(b.region));
      case 'city-asc':
        return sorted.sort((a, b) => a.city?.localeCompare(b.city));
      default:
        return sorted;
    }
  };

  // =================================================
  //  SEARCH FUNCTION
  // =================================================
  const filterAccounts = (accounts) => {
    return accounts.filter((acc) => {
      const name = `${acc.last_name || ''} ${acc.first_name || ''}`.toLowerCase().trim();
      const position = acc.position?.toLowerCase() || '';
      const city = acc.city?.toLowerCase() || '';
      const province = acc.province?.toLowerCase() || '';
      const region = acc.region?.toLowerCase() || '';
      const query = searchQuery.toLowerCase();

      return (
        name.includes(query) ||
        position.includes(query) ||
        city.includes(query) ||
        province.includes(query) ||
        region.includes(query)
      );
    });
  };

  // =================================================
  //  APPLY FILTER, THEN SORT
  // =================================================
  const filteredPendingAccounts = filterAccounts(pendingAccounts);
  const filteredApprovedAccounts = filterAccounts(approvedAccounts);
  const filteredRejectedAccounts = filterAccounts(rejectedAccounts);

  const sortedPendingAccounts = sortAccounts(filteredPendingAccounts, pendingSortOption);
  const sortedActiveAccounts = sortAccounts(filteredApprovedAccounts, approvedSortOption);
  const sortedRejectAccounts = sortAccounts(filteredRejectedAccounts, rejectedSortOption);

  // =================================================
  //  AUTH CHECK AND FETCHING DATA
  // =================================================
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/');

    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        setUsername(user.username || '');
      } catch (error) {
        console.error('Could not parse user data:', error);
      }
    }

    const fetchData = async () => {
      try {
        const [pending, lguAccounts] = await Promise.all([
          axios.get('/api/admin/pending-accounts'),
          axios.get('/api/admin/lgu-accounts') 
        ]);

        const approved = lguAccounts.data.filter(
          acc => acc.status.toLowerCase() === 'approved'
        );
        const rejected = lguAccounts.data.filter(
          acc => acc.status.toLowerCase() === 'rejected'
        );

        setPendingAccounts(pending.data);
        setApprovedAccounts(approved);
        setRejectedAccounts(rejected);
      } catch (err) {
        console.error('Failed to load accounts:', err.message);
        if (err.response?.status === 401) {
          handleLogout();
        }
      }
    };

    fetchData();
  }, [navigate]);

  // =================================================
  //  UPDATE ACCOUNT STATUS
  // =================================================
  const handleLGUAccountStatusChange = async (id, updateStatus) => {
    try {
      const account = pendingAccounts.find(acc => acc.id === id);

      if (!account) return;

    const first_name = adminData.first_name || adminData.firstName || '';
    const last_name = adminData.last_name || adminData.lastName || '';
    const adminName = `${first_name} ${last_name}`.trim();

      await axios.put(`/api/admin/status-account/${id}`, {
        status: updateStatus,
        action_by: `${first_name} ${last_name}`.trim(),
      });

      setPendingAccounts(prev => prev.filter(acc => acc.id !== id));

      const updatedAccount = { ...account, status: updateStatus, action_by: adminName };

      if (updateStatus === 'approved') {
        setApprovedAccounts(prev => [...prev, updatedAccount]);
      }

      if (updateStatus === 'rejected') {
        setRejectedAccounts(prev => [...prev, updatedAccount]);
      }

      toast.success(`Account successfully ${updateStatus} by ${adminName}.`);
    } catch (error) {
      console.error('Status update failed:', error);
      toast.error('Failed to update account status.');
    }
  };

  useEffect(() => {
    const adminDataRaw = localStorage.getItem('adminInfo');
    if (adminDataRaw) {
      try {
        const parsed = JSON.parse(adminDataRaw);
        setAdminData(parsed);
      } catch {
        console.error('Failed to parse adminInfo from localStorage');
      }
    }
  }, []);


  // =================================================
  //  DELETE LGU ACCOUNT
  // =================================================
  const deleteAccount = async (id) => {
    try {
      const response = await axios.delete(`/api/admin/delete-account/${id}`);

      setApprovedAccounts(prev => prev.filter(acc => acc.id !== id));
      setRejectedAccounts(prev => prev.filter(acc => acc.id !== id));

      setShowDeleteConfirm(false);
      setAccountToDelete(null);

      toast.success(response.data?.message || 'Account successfully deleted.');
    } catch (error) {
      console.error('Failed to delete account:', error);

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

      toast.error(data?.error || 'Failed to delete account. Please try again.');
    }
  };


const renderTable = (accounts, isPending = false) => {
  if (accounts.length === 0) {
    return (
      <div className="no-barangay-wrapper">
        <div className="no-barangay-content">
          <Player
            autoplay
            loop
            src={noBarangayAnim}
            style={{ height: '240px', width: '240px' }}
          />
          <h2 className="no-barangay-title">No Barangay Records Found</h2>
          <p className="no-barangay-subtext">
            You haven't added any barangay accounts yet. Click the <strong>"Add Barangay"</strong> button to create one and begin managing your records.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <div className="table-scroll">
        <table className="table">
          <thead className="table-head">
            <tr>
              <th className="table-header" style={{ width: '100px' }}>LGU ID</th>
              <th className="table-header">Representative Name</th>
              <th className="table-header">Position</th>
              <th className="table-header">Contact Number</th>
              <th className="table-header">Email</th>
              <th className="table-header">Region</th>
              <th className="table-header">Province</th>
              <th className="table-header">City/Municipality</th>
              <th className="table-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((acc) => (
              <tr
                key={acc.id}
                onClick={() => {
                  setSelectedAccount(acc);
                  setIsModalOpen(true);
                }}
                style={{ cursor: 'pointer' }}
                className="hoverable-row"
              >
                <td className="table-cell">{`LGU-${String(acc.id).padStart(5, '0')}`}</td>
                <td className="table-cell">{acc.first_name} {acc.last_name}</td>
                <td className="table-cell">{acc.position}</td>
                <td className="table-cell">{acc.phone_number}</td>
                <td className="table-cell">{acc.email}</td>
                <td className="table-cell">{capitalizeWords(acc.region)}</td>
                <td className="table-cell">{capitalizeWords(acc.province)}</td>
                <td className="table-cell">{capitalizeWords(acc.city)}</td>
                <td className="table-cell" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isPending ? (
                    <>
                      <img
                        src="/icons/approve.png"
                        alt="Approve"
                        className="icon-button icon-hover-effect"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLGUAccountStatusChange(acc.id, 'approved');
                        }}
                      />
                      <img
                        src="/icons/reject.png"
                        alt="Reject"
                        className="icon-button icon-hover-effect"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLGUAccountStatusChange(acc.id, 'rejected');
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
                        setAccountToDelete(acc);
                        setShowDeleteConfirm(true);
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
        <ADMINNavbar />
      </div>
      <div className="layout">
        <ADMINSidebar 
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
            <h2 className="page-title">Manage Local Government Unit</h2>
            <input
              type="text"
              placeholder="Search..."
              className="search-box"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="section-wrapper">
          <div className="pending-section">
            <div className="header-table">
              <h3 className="section-title">Access Requests</h3>
              <Select
                options={sortOptions}
                defaultValue={sortOptions[0]}
                styles={dropdownStyles}
                isSearchable={false}
                onChange={(option) => setPendingSortOption(option.value)}
              />
            </div>

            {sortedPendingAccounts.length > 0 ? (
              renderTable(sortedPendingAccounts, true)
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                <div
                  style={{
                    maxWidth: '100%',
                    width: '220px',
                    margin: '0 auto',
                  }}
                >
                  <Player
                    autoplay
                    loop
                    src={noData}
                    style={{
                      width: '100%',
                      height: 'auto',
                    }}
                  />
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


            <div className="approved-section">
              <div className="header-table header-flex">
                <div>
                  <Select
                    options={[
                      { value: 'active', label: 'Active Accounts' },
                      { value: 'rejected', label: 'Rejected Accounts' },
                    ]}
                    value={{
                      value: accountView,
                      label: accountView === 'active' ? 'Active Accounts' : 'Rejected Accounts',
                    }}
                    styles={accountViewDropdownStyles}
                    isSearchable={false}
                    onChange={(option) => setAccountView(option.value)}
                  />
                </div>
                <Select
                  options={sortOptions}
                  value={sortOptions.find((opt) => opt.value === approvedSortOption)}
                  styles={dropdownStyles}
                  isSearchable={false}
                  onChange={(option) => setApprovedSortOption(option.value)}
                />
              </div>

              {accountView === 'active' && sortedActiveAccounts.length > 0 ? (
                renderTable(sortedActiveAccounts, false)
              ) : accountView === 'rejected' && sortedRejectAccounts.length > 0 ? (
                renderTable(sortedRejectAccounts, false)
              ) : (
                <div style={{ textAlign: 'center', marginTop: '40px' }}>
                  <Player
                    autoplay
                    loop
                    src={noData}
                    style={{ height: '220px', width: '220px', margin: '0 auto' }}
                  />
                  <h2 style={{ fontSize: '16px', color: '#374856', margin: 0 }}>
                    No {accountView === 'active' ? 'Active' : 'Rejected'} Accounts
                  </h2>
                  <p style={{ fontSize: '14px', color: '#8696BB' }}>
                    There are currently no {accountView} accounts to show.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && selectedAccount && (
        <div
          className="overlay modal-fade"
          onClick={() => {
            setSelectedAccount(null);
            setIsModalOpen(false);
          }}
        >
          <div className="modal" style={{ width: '450px' }} onClick={(e) => e.stopPropagation()}
            >
              <button
                className="close-btn"
                onClick={() => {
                  setSelectedAccount(null);
                  setIsModalOpen(false);
                }}
              >
                ×
              </button>

            <h2 className="modal-title">Supporting Documents</h2>
            <p className="sub-title" style={{fontSize: '12px'}}>Access the applicant’s uploaded ID and letter of intent for verification.</p>

            <div className="document-container">
              <div
                className="document-box"
                onClick={() => window.open(selectedAccount.upload_id_url, "_blank")}
              >
                <img
                  src="/icons/uploaded-id.png"
                  alt="Uploaded ID"
                  className="icon-image"
                />
                <p className="doc-label">Uploaded ID</p>
              </div>

              <div
                className="document-box"
                onClick={() => window.open(selectedAccount.upload_letter_url, "_blank")}
              >
                <img
                  src="/icons/letter-of-intent.png"
                  alt="Letter of Intent"
                  className="icon-image"
                />
                <p className="doc-label">Letter of Intent</p>
              </div>
            </div>

            <div className="approver-info">
                <p><strong>Office Address:</strong> {selectedAccount.address}</p>
            </div>

            <div className="approver-info" style={{ marginTop: '15px', fontSize: '13px', color: '#333' }}>
              {selectedAccount.status === 'approved' && (
                <p><strong>Approved by:</strong> {selectedAccount.action_by}</p>
              )}
              {selectedAccount.status === 'rejected' && (
                <p><strong>Rejected by:</strong> {selectedAccount.action_by}</p>
              )}
            </div>

            
          </div>
        </div>
      )}

      {showDeleteConfirm && accountToDelete && (
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
                  {capitalizeWords(accountToDelete.city)},&nbsp;
                  {capitalizeWords(accountToDelete.province)},&nbsp;
                  {capitalizeWords(accountToDelete.region)}
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
                onClick={() => deleteAccount(accountToDelete.id)}
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


const accountViewDropdownStyles = {
  control: (base) => ({
    ...base,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 0,
    boxShadow: 'none',
    minHeight: '28px',
    height: '28px',
    fontSize: '16px',
    fontWeight: 600,
    width: 'px',
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
    fontSize: '16px',
  }),
};
