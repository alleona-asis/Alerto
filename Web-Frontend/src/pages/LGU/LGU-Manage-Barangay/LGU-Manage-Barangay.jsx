import { useState, useEffect, useMemo, useRef } from 'react';
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
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';

export default function LGUManageBarangay() {
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

  // const [sortOption, setSortOption] = useState('default');
  const [sortOption, setSortOption] = useState('incident-desc');
  const [incidentReports, setIncidentReports] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // ADD BARANGAY USER ACCOUNT
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [barangayAccounts, setBarangayAccounts] = useState([]);
  const [isViewAccountModalOpen, setIsViewAccountModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // DELETE BARANGAY ACCOUNT
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [barangayAccountToDelete, setBarangayAccountToDelete] = useState(null);


  // Edit
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingBarangayId, setEditingBarangayId] = useState(null);

  // Error Handling
  const [focusedInput, setFocusedInput] = useState(null);
  const [phoneNumberError, setPhoneNumberError] = useState('');

  const [requestSummary, setRequestSummary] = useState([]);
  const [docRequests, setDocRequests] = useState([]);
  
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [emailError, setEmailError] = useState('');

  // =================================================
  //  HELPERS
  // =================================================
  const capitalizeWords = (str) =>
    str?.toLowerCase().replace(/\b\w/g, char => char.toUpperCase()) || '';

  const normalizeName = (s) =>
    (s || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[,.-]/g, "")
      .replace(/\b(brgy|barangay)\b/g, "")
      .trim();

  const getIncidentType = (r) =>
    (r?.incident_type ??
    r?.type ??
    r?.category ??
    r?.incident ??
    r?.nature ??
    "Unspecified") + "";


  // =================================================
  // INPUT HANDLING
  // =================================================
  const validateInput = (text) => {
    const specialChars = "!@#$%^&*_-.'";
    if (text.length < 8 || text.includes(' ')) return false;

    let hasSpecial = false;
    let hasNumber = false;

    for (let char of text) {
      if (specialChars.includes(char)) hasSpecial = true;
      if (!isNaN(char)) hasNumber = true;
    }

    return hasSpecial && hasNumber;
  };

  // =================================================
  //  SORT FUNCTION (define first)
  // =================================================
  const sortOptions = [
    { value: 'incident-desc', label: 'Sort by Rank' },
    { value: 'barangay-name-asc', label: 'Sort by Barangay' },
  ];

  const sortBarangay = (barangay, option) => {
    const sorted = [...barangay];
    switch (option) {

    case 'incident-desc':
      return sorted.sort(
        (a, b) => (b.total_incidents ?? 0) - (a.total_incidents ?? 0)
      );
      case 'barangay-name-asc':
        return sorted.sort((a, b) =>
          a.barangay_name?.localeCompare(b.barangay_name)
        );
      default:
        return sorted;
    }
  };

  // =================================================
  //  SEARCH FUNCTION
  // =================================================
  const filterBarangays = (barangay) => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return barangay;

    return barangay.filter((acc) => {
      const idStr =
        acc.id != null ? `BRGY-${String(acc.id).padStart(5, '0')}` : '';

      const haystack = [
        idStr,
        acc.barangay_name,
        acc.barangay_captain,
        acc.phone_number,
        acc.barangay_address,
      ]
        .filter((v) => v != null && v !== '')
        .map((v) => String(v).toLowerCase());

      return haystack.some((s) => s.includes(q));
    });
  };


  // Modal Graph
  const incidentTypeData = useMemo(() => {
    if (!incidentReports || !selectedAccount) return [];

    const normalizeName = (s) =>
      (s || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[,.-]/g, "")
        .replace(/\b(brgy|barangay)\b/g, "")
        .trim();

    const selectedId = selectedAccount.id ?? selectedAccount.barangay_id ?? null;
    const selectedNameNorm = normalizeName(selectedAccount.barangay_name);

    const filtered = (incidentReports || []).filter((r) => {
      const rId = r.barangay_id ?? r.barangayId ?? r.brgy_id ?? null;
      const rName = normalizeName(
        r.barangay_name ?? r.barangay ?? r.brgy_name ?? r.brgy ?? ""
      );
      const byId = selectedId != null && rId != null && String(rId) === String(selectedId);
      const byName = !!selectedNameNorm && !!rName && rName === selectedNameNorm;
      return byId || byName;
    });

    const counts = new Map();
    for (const r of filtered) {
      const key = getIncidentType(r).trim() || "Unspecified";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
      .map(([type, count]) => ({ type, count }));
  }, [incidentReports, selectedAccount]);


  const topIncidents = useMemo(() => {
    if (!incidentTypeData || incidentTypeData.length === 0) return [];
    const maxCount = Math.max(...incidentTypeData.map(d => d.count));
    return incidentTypeData.filter(d => d.count === maxCount);
  }, [incidentTypeData]);


  // =================================================
  //  APPLY FILTER, THEN SORT
  // =================================================
  const incidentTotals = useMemo(() => {
    const byId = {};
    const byName = {};

    for (const r of incidentReports || []) {
      const id = r.barangay_id ?? r.barangayId ?? r.brgy_id ?? null;
      const nameRaw =
        r.barangay_name ?? r.barangay ?? r.brgy_name ?? r.brgy ?? null;

      const add = Number(r.total ?? r.count ?? r.total_reports ?? 1);

      if (id != null) {
        const key = String(id);
        byId[key] = (byId[key] ?? 0) + add;
      }

      if (nameRaw) {
        const key = normalizeName(nameRaw);
        byName[key] = (byName[key] ?? 0) + add;
      }
    }

    return { byId, byName };
  }, [incidentReports]);


  const rankedBarangays = useMemo(() => {
    const byId = incidentTotals.byId || {};
    const byName = incidentTotals.byName || {};

    const withCounts = (barangayDirectory || []).map((b) => {
      const viaId = byId[String(b.id)];
      const viaName = byName[normalizeName(b.barangay_name)];
      const fallback = Number.isFinite(+b?.total_incidents) ? +b.total_incidents : 0;

      const total =
        (Number.isFinite(viaId) ? viaId : null) ??
        (Number.isFinite(viaName) ? viaName : null) ??
        fallback;

      return { ...b, total_incidents: total };
    });

    const sorted = [...withCounts].sort((a, b) => {
      const d = (b.total_incidents ?? 0) - (a.total_incidents ?? 0);
      if (d !== 0) return d;
      const byNm = (a.barangay_name || "").localeCompare(b.barangay_name || "");
      if (byNm !== 0) return byNm;
      return String(a.id).localeCompare(String(b.id));
    });

    let currentRank = 0;
    let prevCount = null;
    const ranked = sorted.map((item) => {
      const c = item.total_incidents ?? 0;
      if (prevCount === null || c !== prevCount) {
        currentRank = currentRank === 0 ? 1 : currentRank + 1;
        prevCount = c;
      }
      return { ...item, rank: currentRank };
    });

    return ranked;
  }, [barangayDirectory, incidentTotals]);


  const displayBarangays = useMemo(() => {
    const filtered = filterBarangays(rankedBarangays);
    return sortBarangay(filtered, sortOption);
  }, [rankedBarangays, searchQuery, sortOption]);

  // =================================================
  //  FETCH ALL REPORTS BY LOCATION
  // =================================================
  const fetchReports = async (region, province, city) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await axios.get("/api/lgu/lgu-get-all-reports", {
        headers: { Authorization: `Bearer ${token}` },
        params: { region, province, city },
      });

      setIncidentReports(res.data || []);
    } catch (error) {
      console.error("Failed to fetch reports:", error?.response?.data?.message || error.message);
      setIncidentReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && LGUProfile) {
      fetchBarangayDirectory();
      fetchReports(LGUProfile.region, LGUProfile.province, LGUProfile.city);
    }
  }, [token, LGUProfile]);


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
    setIsClosing(true);
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
      setIsClosing(false);
    }, 200);
  };

  const closeViewAccountModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsViewAccountModalOpen(false);
      setSelectedAccount(null);
      setIsClosing(false);
    }, 200);
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

    console.log('Constructed payload:', JSON.stringify(payload, null, 2));

    const missingFields = Object.entries(payload)
      .filter(([key, value]) => value === undefined || value === null || value === '')
      .map(([key]) => key);

    if (missingFields.length > 0) {
      console.warn(`Missing fields: ${missingFields.join(', ')}`);
      toast.error(`Please fill in all fields: ${missingFields.join(', ')}`);
      console.groupEnd();
      return;
    }

    try {
      console.log('Sending POST request to /api/lgu/add-barangay-account...');
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
      console.error('Error creating account:');

      if (error.response) {
        console.group('Server error response');
        console.error('Status:', error.response.status);
        console.error('Data:', JSON.stringify(error.response.data, null, 2));
        toast.error(`${error.response.data.message || 'Server error occurred.'}`);
        console.groupEnd();
      } else if (error.request) {
        console.group('No response from server');
        console.error(error.request);
        toast.error('No response from server. Check network or backend.');
        console.groupEnd();
      } else {
        console.group('Request setup error');
        console.error(error.message);
        toast.error('Request error. See console.');
        console.groupEnd();
      }
    }
    console.groupEnd();
  };

  const fetchBarangayAccounts = async (lguId, barangay) => {
    const brgy = String(barangay || '').trim();
    if (!brgy) return setBarangayAccounts([]);

    const candidates = [...new Set([lguId, userId, localStorage.getItem('userId'), selectedAccount?.lgu_id].filter(Boolean))];
    const core = brgy.replace(/^(brgy\.?\s+|barangay\s+)/i, '').trim();
    const variants = [...new Set([brgy, core, `Brgy ${core}`, `Brgy. ${core}`, `Barangay ${core}`, core.toLowerCase(), core.toUpperCase()])];

    const all = [];
    const seen = new Set();

    try {
      for (const lgu of candidates) {
        for (const name of variants) {
          const url = `/api/lgu/view-created-account/${encodeURIComponent(lgu)}/${encodeURIComponent(name)}?limit=1000`;
          const res = await axios.get(url);
          const raw = res?.data;
          const list = Array.isArray(raw) ? raw : (raw?.accounts || raw?.rows || raw?.data || []);
          for (const u of list) {
            const k = u.id ?? u.user_id ?? u.uid ?? u.username;
            if (!seen.has(k)) { seen.add(k); all.push(u); }
          }
        }
      }
      setBarangayAccounts(all);
    } catch (e) {
      console.error('Failed to load accounts:', e?.response?.data || e.message);
      setBarangayAccounts([]);
      toast.error('Failed to load staff accounts for this barangay.');
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

  // =================================================
  //  DELETE BARANGAY USER ACCOUNT
  // =================================================
  const openDeleteAccountModal = (account) => {
    setBarangayAccountToDelete(account);
    setShowDeleteAccountConfirm(true);
  };

  const closeDeleteAccountModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowDeleteAccountConfirm(false);
      setBarangayAccountToDelete(null);
      setIsClosing(false);
    }, 200);
  };

  const confirmDeleteBarangayAccount = async () => {
    const id =
      barangayAccountToDelete?.id ??
      barangayAccountToDelete?.user_id ??
      barangayAccountToDelete?.uid;

    if (!id) return;

    try {
      await axios.delete(`/api/lgu/delete-barangay-account/${encodeURIComponent(id)}`);
      setBarangayAccounts(prev => prev.filter(u => (u.id ?? u.user_id ?? u.uid) !== id));
      toast.success('Barangay account deleted.');
    } catch (e) {
      console.error('Delete failed:', e?.response?.data || e.message);
      toast.error(e?.response?.data?.message || 'Failed to delete account.');
    } finally {
      closeDeleteAccountModal();
    }
  };



  // =================================================
  //  FETCH TOTAL REQUESTS
  // =================================================
  const fetchRequestSummary = async (region, province, city) => {
    if (!token) return;
    try {
      const { data = [] } = await axios.get(
        "/api/lgu/lgu-get-all-document-requests",
        { headers: { Authorization: `Bearer ${token}` }, params: { region, province, city } }
      );

      const summary = Object.values(
        data.reduce((m, r) => {
          const name = r.barangay_name || r.barangay || r.brgy_name || r.brgy || "—";
          (m[name] ||= { barangay_name: name, total_requests: 0 }).total_requests++;
          return m;
        }, {})
      ).sort((a, b) =>
        b.total_requests - a.total_requests || String(a.barangay_name).localeCompare(String(b.barangay_name))
      );

      setRequestSummary(summary);
    } catch (e) {
      console.error("fetchRequestSummary:", e?.response?.data || e.message);
      setRequestSummary([]);
    }
  };

  useEffect(() => {
    if (token && LGUProfile) {
      fetchRequestSummary(LGUProfile.region, LGUProfile.province, LGUProfile.city);
    }
  }, [token, LGUProfile]);


  // Totals Requests
  const requestTotals = useMemo(
    () =>
      (requestSummary || []).reduce(
        (out, r) => {
          const total = Number(r.total_requests ?? r.total ?? r.count ?? 0) || 0;

          const id = r.barangay_id ?? r.barangayId ?? r.brgy_id;
          if (id != null) out.byId[String(id)] = (out.byId[String(id)] || 0) + total;

          const name = r.barangay_name ?? r.barangay ?? r.brgy_name ?? r.brgy;
          if (name) {
            const key = normalizeName(name);
            out.byName[key] = (out.byName[key] || 0) + total;
          }
          return out;
        },
        { byId: {}, byName: {} }
      ),
    [requestSummary, normalizeName]
  );

  // Pie Chart
  const requestTypePieData = useMemo(() => {
    if (!Array.isArray(docRequests) || docRequests.length === 0) return [];
    const counts = docRequests.reduce((m, r) => {
      const type = (r.document_type || r.type || 'Unspecified').toString().trim() || 'Unspecified';
      m[type] = (m[type] || 0) + 1;
      return m;
    }, {});
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  }, [docRequests]);


  const topRequestTypes = useMemo(() => {
    if (!requestTypePieData.length) return [];
    const max = Math.max(...requestTypePieData.map(d => d.value));
    return requestTypePieData.filter(d => d.value === max);
  }, [requestTypePieData]);


  const fetchDocRequestsForSelected = async () => {
    if (!token || !LGUProfile || !selectedAccount) return;

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const params = {
        region: LGUProfile.region,
        province: LGUProfile.province,
        city: LGUProfile.city,
      };

      const { data = [] } = await axios.get("/api/lgu/lgu-get-all-document-requests", { headers, params });

      const selName = String(selectedAccount.barangay_name || "").trim().toLowerCase();
      const items = (Array.isArray(data) ? data : []).filter((r) => {
        const n = (r.barangay_name || r.barangay || r.brgy_name || r.brgy || "").toString().trim().toLowerCase();
        return n === selName;
      });

      setDocRequests(items);
    } catch (e) {
      console.error("[Requests] fetch error:", e?.response?.data || e.message);
      setDocRequests([]);
    }
  };

  useEffect(() => {
    if (activeTab === "requests" && selectedAccount) {
      fetchDocRequestsForSelected();
    }
  }, [activeTab, selectedAccount, LGUProfile]);

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
                <th className="table-header">Barangay Captain</th>
                <th className="table-header">Contact Number</th>
                <th className="table-header">Barangay Address</th>
                <th className="table-header">Document Requests</th>
                <th className="table-header">Barangay Reports</th>
                <th className="table-header">Rank</th>
                <th className="table-header" style={{ paddingLeft: '100px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {barangay.map((acc) => (
                <tr key={acc.id} onClick={() => handleRowClick(acc)} style={{ cursor: 'pointer' }}>
                  <td className="table-cell">{`BRGY-${String(acc.id).padStart(5, '0')}`}</td>
                  <td className="table-cell">{acc.barangay_name}</td>
                  <td className="table-cell">{acc.barangay_captain}</td>
                  <td className="table-cell">{acc.phone_number}</td>
                  <td className="table-cell">{acc.barangay_address}</td>

                  <td className="table-cell">
                    {(
                      requestTotals.byId[String(acc.id)] ??
                      requestTotals.byName[normalizeName(acc.barangay_name)] ??
                      Number(acc.total_requests ?? 0)
                    ).toLocaleString()}
                  </td>

                  <td className="table-cell">
                    {Number(acc.total_incidents ?? 0).toLocaleString()}
                  </td>
                  <td className="table-cell">{acc.rank ?? '—'}</td>
                  <td className="table-cell" style={styles.cell}>
                    <div style={styles.row}>
                      {[
                        {
                          src: "/icons/edit-row.png",
                          alt: "Edit",
                          action: () => {
                            setSelectedBarangay(acc.barangay_name);
                            setBarangayCaptain(acc.barangay_captain);
                            setPhoneNumber(acc.phone_number);
                            setAddress(acc.barangay_address);
                            setEditingBarangayId(acc.id);
                            setIsEditMode(true);
                            setIsAddBarangayModalOpen(true);
                          },
                        },
                        {
                          src: "/icons/delete-row.png",
                          alt: "Delete",
                          action: () => {
                            setBarangayToDelete(acc);
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
              <p className="sub-title" style={{ textAlign: 'center' }}>Are you sure you want to delete this barangay?</p>

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

        {/* DELETE BARANGAY ACCOUNT MODAL */}
        {showDeleteAccountConfirm && barangayAccountToDelete && (
          <div
            className="modal-overlay"
            onClick={closeDeleteAccountModal}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100000,
              pointerEvents: 'auto'
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
                    setShowDeleteAccountConfirm(false);
                    setBarangayAccountToDelete(null);
                    setIsClosing(false);
                  }, 200);
                }}
              />

              <div className="icon-container">
                <img src="/icons/delete.png" alt="Delete" className="icon-delete" />
              </div>

              <h3 className="modal-title" style={{ textAlign: 'center' }}>Delete</h3>
              <p className="sub-title" style={{ textAlign: 'center' }}>
                Are you sure you want to delete this uer account?
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 20, paddingLeft: 18, paddingRight: 18, textAlign: 'center' }}>
                <span className="location-text">
                  {(() => {
                    const u = barangayAccountToDelete;
                    const name = `${u?.first_name ?? u?.firstName ?? ''} ${u?.last_name ?? u?.lastName ?? ''}`.trim() || (u?.username ?? 'User');
                    return `${name}`;
                  })()}
                </span>
              </div>

              <div className="button-container">
                <button className="cancel-button" onClick={closeDeleteAccountModal}>
                  Cancel
                </button>
                <button className="confirm-button" onClick={confirmDeleteBarangayAccount}>
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
                      className={`input-field ${focusedInput === 'username' ? 'input-focus' : ''} ${usernameError ? 'input-error-border' : ''}`}
                      onFocus={() => setFocusedInput('username')}
                      onBlur={() => setFocusedInput(null)}
                      placeholder="Enter your username"
                      value={userForm.username}
                      onChange={async (e) => {
                        const raw = e.target.value;
                        // keep only allowed chars; no spaces
                        const cleaned = raw.replace(/[^A-Za-z0-9!@#$%^&*_.-]/g, '');
                        setUserForm(prev => ({ ...prev, username: cleaned }));

                        if (!validateInput(cleaned)) {
                          setUsernameError('Username must be at least 8 characters long, and include at least one special character and one number.');
                          return;
                        }
                        if (isRegistering) {
                          try {
                            const res = await axios.post('/api/auth/check-username', { username: cleaned });
                            setUsernameError(res.data.available ? '' : 'Username already exists.');
                          } catch {
                            setUsernameError('Error checking username.');
                          }
                        } else {
                          setUsernameError('');
                        }
                      }}
                      onKeyDown={(e) => e.key === ' ' && e.preventDefault()}
                    />
                    {usernameError && <p className="input-error-message">{usernameError}</p>}
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
                      className="input-field"
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
                      className="input-field"
                    />
                  </div>

                  {/* Phone Number */}
                  <div className="input-group">
                    <label className="input-label">Phone Number</label>
                    <input
                      className={`input-field ${focusedInput === 'phoneNumber' ? 'input-focus' : ''} ${phoneNumberError ? 'input-error' : ''}`}
                      onFocus={() => setFocusedInput('phoneNumber')}
                      onBlur={() => setFocusedInput(null)}
                      placeholder="+639XXXXXXXXX"
                      value={userForm.phoneNumber}
                      onChange={(e) => {
                        let value = e.target.value;

                        if (value.includes(' ')) return;

                        if (!value.startsWith('+639')) {
                          value = '+639' + value.replace(/\D/g, '').slice(0, 9);
                        } else {
                          value = '+639' + value.slice(4).replace(/\D/g, '').slice(0, 9);
                        }

                        setUserForm((prev) => ({
                          ...prev,
                          phoneNumber: value
                        }));

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
                      className="input-field"
                    />
                  </div>

                  {/* Password */}
                  <div className="input-group">
                    <label htmlFor="password" className="input-label">
                      Password
                    </label>

                    <div className="password-wrapper" style={{ position: "relative" }}>
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={userForm.password}
                        onFocus={() => setFocusedInput("password")}
                        onBlur={() => setFocusedInput(null)}
                        className={`modal-input ${
                          focusedInput === "password" ? "input-focus" : ""
                        } ${passwordError ? "input-error-border" : ""}`}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val.includes(" ")) return;
                          setUserForm((prev) => ({ ...prev, password: val }));
                          setPasswordError(
                            validateInput(val)
                              ? ""
                              : "Password must be at least 8 characters long, and include at least one special character and one number"
                          );
                        }}
                        onKeyDown={(e) => e.key === " " && e.preventDefault()}
                        autoComplete="current-password"
                        style={{ paddingRight: 36 }}
                      />

                      <button
                        type="button"
                        className="eye-btn"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword((p) => !p)}
                        style={{
                          position: "absolute",
                          right: 10,
                          top: "45%",
                          transform: "translateY(-50%)",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          lineHeight: 1,
                          fontSize: 16,
                        }}
                      >
                        {showPassword ? "🔓" : "🔒"}
                      </button>
                    </div>

                    {passwordError && (
                      <p className="input-error-message">{passwordError}</p>
                    )}
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
            <div className={`modal-content-details ${isClosing ? 'pop-out' : 'pop-in'}`}>
              <img
                src="/icons/close.png"
                alt="Close"
                className="modal-close-btn"
                onClick={closeViewAccountModal}
              />

              <h3 className="modal-title" style={{ textAlign: "center" }}>
                Barangay {selectedAccount.barangay_name}
              </h3>

              {/* Mini Nav Bar */}
              <div className="modal-tabs">
                <button
                  className={`tab-button ${activeTab === 'details' ? 'active' : ''}`}
                  onClick={() => setActiveTab('details')}
                >
                  Details
                </button>
                <button
                  className={`tab-button ${activeTab === 'staff' ? 'active' : ''}`}
                  onClick={() => setActiveTab('staff')}
                >
                  Staff
                </button>
                <button
                  className={`tab-button ${activeTab === 'reports' ? 'active' : ''}`}
                  onClick={() => setActiveTab('reports')}
                >
                  Reports
                </button>
                <button
                  className={`tab-button ${activeTab === 'requests' ? 'active' : ''}`}
                  onClick={() => setActiveTab('requests')}
                >
                  Requests
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
                ) : activeTab === 'staff' ? (
                  <div className="barangay-staff">
                    <div className="staff-card-grid">
                      {barangayAccounts.length > 0 ? (
                       barangayAccounts.map((user, index) => {
                          const first = user.first_name ?? user.firstName ?? '';
                          const last  = user.last_name  ?? user.lastName  ?? '';
                          const pos   = user.position   ?? user.role      ?? '';
                          const phone = user.phone_number ?? user.phoneNumber ?? user.contact ?? '';
                          const id    = user.id ?? user.user_id ?? user.uid ?? `${user.username || ''}-${index}`;

                          return (
                            <div className="staff-card" key={id} style={{ position: 'relative' }}>
                              {/* DELETE ICON */}
                              <img
                                src="/icons/delete-row.png"
                                alt="Delete"
                                title="Delete account"
                                style={{
                                  position: 'absolute',
                                  top: 15,
                                  right: 15,
                                  width: 18,
                                  height: 18,
                                  cursor: 'pointer',
                                  transition: 'transform 0.15s ease'
                                }}
                                onMouseEnter={(e) => bounceEffect(e.currentTarget)} 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDeleteAccountModal(user);
                                }}
                              />

                              <p><strong>Username:</strong> {user.username ?? user.user_name ?? '—'}</p>
                              <p><strong>Full Name:</strong> {first} {last}</p>
                              <p><strong>Position:</strong> {pos}</p>
                              <p><strong>Phone:</strong> {phone}</p>
                            </div>
                          );
                        })
                      ) : (
                        <p style={{ textAlign: 'center', marginTop: '20px' }}>No accounts found.</p>
                      )}
                    </div>

                    <div className="modal-button-row">
                      <button
                        className="add-user-btn"
                        onClick={() => {
                          setIsViewAccountModalOpen(false);
                          setSelectedBarangay(selectedAccount.barangay_name);
                          setIsAddUserModalOpen(true);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          backgroundColor: '#006FFD',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        Add User
                      </button>
                    </div>
                  </div>
                ) : activeTab === 'reports' ? (
                  <div className="reports-tab">
                    {topIncidents.length > 0 && (
                      <div className="top-incident-card">
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>


                          <div style={{ lineHeight: 1.25, flex: 1, minWidth: 240 }}>
                          <div className="top-incident-badge">
                            {topIncidents.length > 1 ? 'Most Common (ties)' : 'Most Common'}
                          </div>

                            <ul className="incident-bullets">
                              {topIncidents.map((t) => (
                                <li key={t.type}>
                                  <span className="incident-bullet-item">{t.type}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                    {incidentTypeData.length > 0 ? (
                      (() => {
                        const pastel = [
                          '#90c6f5ff', '#acf7b3ff', '#f7b8bdff', '#f8eabaff', '#D7E3FC',
                          '#E2F0CB', '#F1C0E8', '#FDE2E4', '#CDE7BE', '#FAD2E1'
                        ];
                        return (
                          <div style={{ width: '100%', height: 400 }}>
                            <ResponsiveContainer>
                              <BarChart data={incidentTypeData} margin={{ top: 8, right: 12, left: 4, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <YAxis allowDecimals={false} />
                                <Tooltip formatter={(value) => [value, 'Reports']} />
                                <Bar dataKey="count" name="Reports">
                                  {incidentTypeData.map((d, idx) => {
                                    const isTop = topIncidents.some(t => t.type === d.type && t.count === d.count);
                                    const color = pastel[idx % pastel.length];
                                    return (
                                      <Cell
                                        key={`cell-${idx}`}
                                        fill={color}
                                        stroke={color}
                                        strokeWidth={isTop ? 1.25 : 1}
                                      />
                                    );
                                  })}
                                </Bar>
                                <Legend
                                  verticalAlign="bottom"
                                  align="center"
                                  layout="horizontal"
                                  wrapperStyle={{ width: '100%'}}
                                  content={() => (
                                    <div
                                      style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(2, minmax(160px, 1fr))',
                                        gap: 10,
                                        paddingTop: 8,
                                        width: '120%',
                                        justifyItems: 'left',
                                        marginTop: "20px" 
                                      }}
                                    >
                                      {incidentTypeData.map((d, i) => (
                                        <div
                                          key={d.type}
                                          style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
                                        >
                                          <span
                                            style={{
                                              width: 10,
                                              height: 10,
                                              borderRadius: 2,
                                              background: pastel[i % pastel.length],
                                              display: 'inline-block',
                                            }}
                                          />
                                          <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: '14px' }}>
                                            {d.type} ({Number(d.count).toLocaleString()})
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        );
                      })()
                    ) : (
                      <p style={{ textAlign: 'center', marginTop: 20 }}>
                        No incident reports found for this barangay.
                      </p>
                    )}
                  </div>
                  ) : activeTab === 'requests' ? (
                    <div className="requests-tab">
                      {/* Top types card */}
                      {topRequestTypes.length > 0 && (
                        <div className="top-incident-card">
                          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <div style={{ lineHeight: 1.25, flex: 1, minWidth: 240 }}>
                              <div className="top-incident-badge">
                                {topRequestTypes.length > 1 ? 'Most Common (ties)' : 'Most Common'}
                              </div>
                              <ul className="incident-bullets">
                                {topRequestTypes.map((t) => (
                                  <li key={t.name}>
                                    <span className="incident-bullet-item">{t.name}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Chart block */}
                      {requestTypePieData.length > 0 ? (
                        <div style={{ width: '100%', height: 380 }}>
                          <ResponsiveContainer>
                            <PieChart>
                              <Tooltip formatter={(value) => [value, 'Requests']} />
                              <Pie
                                data={requestTypePieData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="42%"
                                outerRadius={100}
                              >
                                {requestTypePieData.map((d, idx) => {
                                  const isTop = topRequestTypes.some(t => t.name === d.name && t.value === d.value);
                                  const pastel = [
                                    '#90c6f5ff', '#acf7b3ff', '#f7b8bdff', '#f8eabaff', '#D7E3FC',
                                    '#E2F0CB', '#F1C0E8', '#FDE2E4', '#CDE7BE', '#FAD2E1'
                                  ];
                                  const color = pastel[idx % pastel.length];
                                  return (
                                    <Cell
                                      key={`cell-${idx}`}
                                      fill={color}
                                      stroke={color}
                                      strokeWidth={isTop ? 1.25 : 1}
                                    />
                                  );
                                })}
                              </Pie>

                              {/* Custom 2-column legend at the bottom */}
                              <Legend
                                verticalAlign="bottom"
                                align="center"
                                layout="horizontal"
                                wrapperStyle={{ width: '100%' }}
                                content={({ payload = [] }) => (
                                  <div
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(2, minmax(160px, 1fr))',
                                      gap: 10,
                                      width: '100%',
                                      justifyItems: 'left',
                                    }}
                                  >
                                    {payload.map((entry, i) => (
                                      <div
                                        key={i}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 8,
                                          whiteSpace: 'nowrap',

                                        }}
                                      >
                                        <span
                                          style={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: 2,
                                            background: entry.color,
                                            display: 'inline-block',
                                          }}
                                        />
                                        <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: '14px', }}>
                                          {entry.value} ({entry?.payload?.value?.toLocaleString?.() ?? entry?.payload?.value ?? 0})
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p style={{ textAlign: 'center', marginTop: 20 }}>
                          No document requests found for this barangay.
                        </p>
                      )}
                    </div>
                  ) : null
                }
              </div>
            </div>
          </div>
        )}
      </div>
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