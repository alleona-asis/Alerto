import { useState, useEffect, useMemo } from 'react';
import LGUNavbar from '../../../components/NavBar/LGU-Navbar';
import LGUSidebar from '../../../components/SideBar/LGU-Sidebar';
import '../../../components/SideBar/styles.css';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';
import axios from '../../../axios/axiosInstance';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  regions,
  getProvincesByRegion,
  getCityMunByProvince,
  getBarangayByMun,
} from 'phil-reg-prov-mun-brgy';
import Select from 'react-select';

import ActsoflasciviousnessIcon from '@/assets/pins/Acts-of-lasciviousness.png';
import AnimalIssuesIcon from '@/assets/pins/Animal-Issues.png';
import BlockedDrainageIcon from '@/assets/pins/Blocked-Drainage.png';
import BrokenstreetlightIcon from '@/assets/pins/Broken-streetlight.png';
import DomesticIcon from '@/assets/pins/Domestic.png';
import FloodingIcon from '@/assets/pins/Flooding.png';
import GarbageIcon from '@/assets/pins/Garbage.png';
import IllegalgamblingIcon from '@/assets/pins/Illegal-gambling.png';
import IllegalParkingIcon from '@/assets/pins/Illegal-Parking.png';
import MaliciousmischiefIcon from '@/assets/pins/Malicious-mischief.png';
import MissingpersonIcon from '@/assets/pins/Missing-person.png';
import MonetaryIssuesIcon from '@/assets/pins/Monetary-Issues.png';
import NeighborconflictsIcon from '@/assets/pins/Neighbor-conflicts.png';
import NoiseIcon from '@/assets/pins/Noise.png';
import otherIcon from '@/assets/pins/other.png';
import PhysicalinjuriesIcon from '@/assets/pins/Physical-injuries.png';
import PotholeIcon from '@/assets/pins/Pothole.png';
import StagnantwaterIcon from '@/assets/pins/Stagnant-water.png';
import SuspeciouspersonreportIcon from '@/assets/pins/Suspecious-person-report.png';
import SuspiciousIcon from '@/assets/pins/Suspicious.png';
import TheftIcon from '@/assets/pins/Theft.png';
import VehicularaccidentsIcon from '@/assets/pins/Vehicular-accidents.png';

export default function LGUDashboard() {

  const userId = localStorage.getItem("userId");
  const token = localStorage.getItem("token");
  const [profile, setProfile] = useState(null);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [totalReports, setTotalReports] = useState(0);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [totalMobileUsers, setTotalMobileUsers] = useState(0);

  const [mobileUsersGraph, setMobileUsersGraph] = useState([]);
  const [barangayReportsGraph, setBarangayReportsGraph] = useState([]);
  const [documentRequestsGraph, setDocumentRequestsGraph] = useState([]);
  const [lguAccountsGraph, setLguAccountsGraph] = useState([]);
  const [pins, setPins] = useState([]);

  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [selectedBarangay, setSelectedBarangay] = useState("");

  const [selectedYearReports, setSelectedYearReports] = useState('');
  const [selectedYearMobile,  setSelectedYearMobile]  = useState('');
  const [barangayGraphYear, setBarangayGraphYear] = useState(null);

  const pinIcons = {
    'Garbage': GarbageIcon,
    'Stagnant water': StagnantwaterIcon,
    'Noise': NoiseIcon,
    'Monetary Issues': MonetaryIssuesIcon,
    'Theft / Robbery': TheftIcon,
    'Suspicious Activity ': SuspiciousIcon,
    'Loitering / Suspicious person report': SuspeciouspersonreportIcon,
    'Domestic Violence': DomesticIcon,
    'Acts of lasciviousness': ActsoflasciviousnessIcon,
    'Physical injuries': PhysicalinjuriesIcon,
    'Vehicular accidents': VehicularaccidentsIcon,
    'Missing Persons': MissingpersonIcon,
    'Malicious Mischief ': MaliciousmischiefIcon,
    'Illegal Gatherings / Gambling': IllegalgamblingIcon,
    'Animal issues': AnimalIssuesIcon,
    'Neighbor Conflicts': NeighborconflictsIcon,
    'Broken streetlight': BrokenstreetlightIcon,
    'Pothole': PotholeIcon,
    'Flooding': FloodingIcon,
    'Blocked Drainage': BlockedDrainageIcon,
    'Abandoned Vehicles / Illegal Parking': IllegalParkingIcon,
    'Any other barangay-relevant concern': otherIcon,
    'Other': otherIcon,
    'other': otherIcon
  };

  const getPinIcon = (type) => {
    const iconUrl = pinIcons[type] || otherIcon;
    return L.icon({
      iconUrl,
      iconSize: [34, 36],
      iconAnchor: [17, 36],
      popupAnchor: [0, -36],
    });
  };

  // =================================================
  //  HELPERS
  // =================================================
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const LONG = {january:'Jan',february:'Feb',march:'Mar',april:'Apr',may:'May',june:'Jun',july:'Jul',august:'Aug',september:'Sep',october:'Oct',november:'Nov',december:'Dec'};

  const normalizeMonthLabel = (label) => {
    if (!label) return null;
    const s = String(label).trim().toLowerCase();
    for (let i=0;i<MONTHS.length;i++) if (MONTHS[i].toLowerCase()===s) return MONTHS[i];
    return LONG[s]||null;
  };

  const parseYMD = (s) => {
    if (typeof s!=='string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
    if (!m) return null;
    const d = new Date(+m[1], +m[2]-1, +m[3]);
    return isNaN(d.getTime())?null:d;
  };

  const parseCreatedAt = function (s) {
    if (!s || typeof s !== 'string') return null;
    const t = s.trim();

    const dot = t.indexOf('.');
    let main = t, frac = '';
    if (dot !== -1) {
      main = t.slice(0, dot);
      frac = t.slice(dot + 1);
      frac = frac.slice(0, 3);
    }

    const iso = main.replace(' ', 'T') + (frac ? ('.' + frac) : '');
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  };


  const toDate = (v) => {
    if (!v) return null;
    if (typeof v==='string') {
      const d1 = parseYMD(v); if (d1) return d1;
      const d2 = new Date(v.indexOf(' ')!==-1 && v.indexOf('T')===-1 ? v.replace(' ','T') : v);
      return isNaN(d2.getTime())?null:d2;
    }
    if (typeof v==='number') {
      const d = new Date(v<1e12? v*1000 : v);
      return isNaN(d.getTime())?null:d;
    }
    if (typeof v==='object') {
      const sec = v&&v.seconds? v.seconds:0, nsec = v&&v.nanoseconds? v.nanoseconds:0;
      if (sec||nsec) {
        const d = new Date(sec*1000 + Math.floor(nsec/1e6));
        return isNaN(d.getTime())?null:d;
      }
    }
    return null;
  };

  const extractYear = function (row) {
    if (!row) return null;

    if (row.year != null) return Number(row.year);
    if (row.__metaYear != null) return Number(row.__metaYear);

    let d =
      (row.created_at && parseCreatedAt(row.created_at)) ||
      (row.createdAt && parseCreatedAt(row.createdAt)) ||
      (row.dateISO && toDate(row.dateISO)) ||
      (row.date && toDate(row.date)) ||
      (row.timestamp && toDate(row.timestamp));

    if (d) return d.getFullYear();

    if (row.label) {
      const m = String(row.label).match(/\b(19|20)\d{2}\b/);
      if (m) return Number(m[0]);
    }
    return null;
  };

  const extractDateFromPin  = (p) => (p && toDate(p.incident_date)) || null;
  const extractYearFromPin  = (p) => { const d = extractDateFromPin(p); return d? d.getFullYear(): null; };
  const extractMonthFromPin = (p) => { const d = extractDateFromPin(p); return d? d.getMonth()+1: null; };


  // =================================================
  //  FETCH LGU PROFILE
  // =================================================
  useEffect(() => {
    if (!userId || !token) {
      console.warn("Missing userId or token. Cannot fetch profile.");
      return;
    }
    const fetchProfile = async () => {
      try {
        const res = await axios.get(`/api/auth/lgu-admin-profile/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setProfile({
          region: res.data.region || "",
          province: res.data.province || "",
          city: res.data.city || "",
        });

        //console.log("Profile location set:", res.data.region, res.data.province, res.data.city);
      } catch (error) {
        console.error("Failed to fetch profile location:", error?.response?.data || error.message);
        setProfile({ region: "", province: "", city: "" });
      }
    };

    fetchProfile();
  }, []);

  const lguAxios = (url, options = {}) => {
    if (!profile) throw new Error("Profile not loaded");

    const defaultParams = {
      city: profile.city,
      province: profile.province,
      region: profile.region,
    };

    const mergedOptions = {
      ...options,
      params: { ...(options.params || {}), ...defaultParams },
      headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
    };

    return axios(url, mergedOptions);
  };


  useEffect(() => {
    if (!profile) return;

    const documentItems = [
      'Barangay Clearance',
      'Barangay Certificate of Residency',
      'Barangay Certificate of Indigency',
      'Barangay Certificate of Good Moral Character',
      'Barangay Business Clearance',
      'Barangay Certificate of No Objection',
      'Other Documents',
    ];

    const fetchTotals = async () => {
      try {
        const [
          reportsRes,
          documentsRes,
          mobileUsersRes,
          announcementsRes,
          lguAccountsRes,
          pinsRes
        ] = await Promise.all([
          lguAxios('/api/lgu/get-all-barangay-reports'),
          axios.get('/api/admin/total-barangay-document-requests'),
          lguAxios('/api/lgu/total-mobile-users'),

          axios.get('/api/admin/total-announcements'),
          axios.get('/api/admin/total-LGU-accounts'),
          lguAxios('/api/admin/admin-get-all-pins')
        ]);
        //console.log("Pins:", pinsRes.data);

        // Set totals
        setTotalReports(reportsRes.data.total || 0);
        setTotalDocuments(documentsRes.data.total || 0);
        setTotalMobileUsers(mobileUsersRes.data.total || 0);
        setPins(pinsRes.data || []);

        // Set graphs
        setBarangayReportsGraph(reportsRes.data.graphData || []);
        setMobileUsersGraph(mobileUsersRes.data.graphData || []);

        // Convert LGU accounts graph data to numbers
        const lguGraphData = (lguAccountsRes.data.graphData || []).map(item => ({
          status: item.status,
          value: Number(item.value) || 0,
        }));
        setLguAccountsGraph(lguGraphData);

        // Merge document requests with predefined items
        const mergedDocumentData = documentItems.map(label => {
          const found = documentsRes.data.graphData?.find(d => d.label === label);
          return { label, value: found ? Number(found.value) : 0 };
        });
        setDocumentRequestsGraph(mergedDocumentData);

      } catch (err) {
        console.error("Error fetching totals:", err?.response?.data || err.message);
      }
    };

    fetchTotals();
  }, [profile]);

  function FitBounds({ pins }) {
    const map = useMap();
    useEffect(() => {
      if (pins.length === 0) return;
      const bounds = pins.map(pin => [pin.latitude, pin.longitude]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }, [pins, map]);
    return null;
  }

  
  // =================================================
  //  BARANGAY LIST
  // =================================================
  const barangayList = useMemo(() => {
    if (!profile?.region || !profile?.province || !profile?.city) return [];

    const regionLabelToCode = regions.reduce((map, region) => {
        map[region.name] = region.reg_code;
        return map;
    }, {});
    
    const regCode = regionLabelToCode[profile.region];
    if (!regCode) {
        console.warn('Region code not found for:', profile.region);
        return [];
    }

    const provinces = getProvincesByRegion(regCode);
    //console.log("Provinces for region:", profile.region, provinces.map(p => p.name));

    const matchedProvince = provinces.find(
        (prov) =>
        prov.name.toLowerCase().includes(profile.province.toLowerCase().trim()) ||
        profile.province.toLowerCase().includes(prov.name.toLowerCase().trim())
    );

    if (!matchedProvince) {
        console.warn('Province not matched:', profile.province);
        return [];
    }

    const cities = getCityMunByProvince(matchedProvince.prov_code);

    const normalize = (str) =>
    str.toLowerCase().replace(/ city| municipality/g, '').trim();

    const matchedCity = cities.find(
    (c) => normalize(c.name) === normalize(profile.city)
    );

    if (!matchedCity) {
    console.warn('City not matched:', profile.city);
    console.log('Available cities:', cities.map(c => c.name));
    return [];
    }

    return getBarangayByMun(matchedCity.mun_code);
  }, [profile]);

  // =================================================
  //  MOST REPORTED BARANGAY
  // =================================================
  const mostReportedBarangay = useMemo(() => {
    if (!barangayReportsGraph || barangayReportsGraph.length === 0) return "";

    const totals = {};
    barangayReportsGraph.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (key === "label") return;
        totals[key] = (totals[key] || 0) + (row[key] || 0);
      });
    });

    let max = 0;
    let mostReported = "";
    Object.entries(totals).forEach(([barangay, total]) => {
      if (total > max) {
        max = total;
        mostReported = barangay;
      }
    });

    return mostReported;
  }, [barangayReportsGraph]);


  // Filtered pins based on selected barangay
  const normalize = (str) => str?.toLowerCase().trim() || "";
    const filteredPins = useMemo(() => {
    if (!pins || pins.length === 0) return [];

    return pins.filter(pin => {
      const regionMatch = profile?.region ? normalize(pin.region) === normalize(profile.region) : true;
      const provinceMatch = profile?.province ? normalize(pin.province) === normalize(profile.province) : true;
      const cityMatch = profile?.city ? normalize(pin.city) === normalize(profile.city) : true;

      return regionMatch && provinceMatch && cityMatch;
    });
  }, [pins, profile]);

  // =================================================
  //  MOST COMMON INCIDENT
  // =================================================
  const incidentTypeSummary = useMemo(() => {
    const counts = {};
    (filteredPins || []).forEach((p) => {
      const t =
        (p.incident_type ??
          p.type ??
          p.category ??
          p.incidentType ??
          "").toString().trim();
      if (!t) return;
      counts[t] = (counts[t] || 0) + 1;
    });

    const entries = Object.entries(counts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => (b.count - a.count) || a.type.localeCompare(b.type));

    const max = entries[0]?.count ?? 0;
    const top = max > 0 ? entries.filter((e) => e.count === max) : [];
    const total = entries.reduce((sum, e) => sum + e.count, 0);

    return { total, max, top, entries };
  }, [filteredPins]);


  const [commonIdx, setCommonIdx] = useState(0);

  const nextCommon = () => {
    const len = incidentTypeSummary?.top?.length || 0;
    if (!len) return;
    setCommonIdx(i => (i + 1) % len);
  };

  useEffect(() => {
    const len = incidentTypeSummary?.top?.length || 0;
    if (!len) {
      setCommonIdx(0);
      return;
    }
    setCommonIdx(i => Math.min(i, len - 1));
  }, [incidentTypeSummary?.top?.length]);

  const topList = useMemo(
    () =>
      (incidentTypeSummary?.top || []).map(t => ({
        type: t?.type ?? 'Unknown',
        count: Number(t?.count ?? 0),
      })),
    [incidentTypeSummary?.top]
  );


  // =================================================
  //  BARANGAY REPORTS GRAPH
  // =================================================
  const yearOptions = useMemo(() => {
    const years = [];
    const addYear = (y) => { if (y && years.indexOf(y) === -1) years.push(y); };

    (Array.isArray(barangayReportsGraph) ? barangayReportsGraph : []).forEach(r => addYear(extractYear(r)));
    (Array.isArray(mobileUsersGraph)   ? mobileUsersGraph   : []).forEach(r => addYear(extractYear(r)));
    (Array.isArray(pins)               ? pins               : []).forEach(p => addYear(extractYearFromPin(p)));

    if (barangayGraphYear != null) addYear(Number(barangayGraphYear));

    years.sort((a,b) => b - a);

    if (years.length === 0) {
      const now = new Date().getFullYear();
      return Array.from({length: 5}, (_,i) => {
        const yy = String(now - i);
        return { value: yy, label: yy };
      });
    }

    return years.map(yy => ({ value: String(yy), label: String(yy) }));
  }, [barangayReportsGraph, mobileUsersGraph, pins, barangayGraphYear]);

  // incidents per month graph
  const incidentsByMonthGraph = useMemo(() => {
    const buckets = [0,0,0,0,0,0,0,0,0,0,0,0];
    const list = Array.isArray(filteredPins) ? filteredPins : [];
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const y = extractYearFromPin(p);
      if (selectedYearReports && y !== Number(selectedYearReports)) continue;

      if (selectedBarangay) {
        const pinBrgy = (p.barangay || '').toString().trim().toLowerCase();
        if (pinBrgy !== selectedBarangay.trim().toLowerCase()) continue;
      }

      const m = extractMonthFromPin(p);
      if (!m) continue;
      buckets[m - 1] += 1;
    }
    const out = [];
    for (let i = 0; i < 12; i++) out.push({ label: MONTHS[i], value: buckets[i] });
    return out;
  }, [filteredPins, selectedYearReports, selectedBarangay]);

  const rowsHaveExplicitMobileYear = useMemo(() => {
    const list = Array.isArray(mobileUsersGraph) ? mobileUsersGraph : [];
    for (let i = 0; i < list.length; i++) {
      if (extractYear(list[i]) != null) return true;
    }
    return false;
  }, [mobileUsersGraph]);


  const mobileSeriesYear = useMemo(() => {
    const list = Array.isArray(mobileUsersGraph) ? mobileUsersGraph : [];

    for (let i = 0; i < list.length; i++) {
      const r = list[i] || {};
      let d = null;
      if (r.created_at) d = parseCreatedAt(r.created_at);
      if (!d && r.createdAt) d = parseCreatedAt(r.createdAt);
      if (!d) d = toDate(r.date || r.dateISO || r.timestamp);
      if (d) return d.getFullYear();
    }

    if (Array.isArray(yearOptions) && yearOptions.length) {
      return Number(yearOptions[0].value);
    }
    return new Date().getFullYear();
  }, [mobileUsersGraph, yearOptions]);

  const mobileUsersByMonth = useMemo(() => {
    if (!rowsHaveExplicitMobileYear && selectedYearMobile) {
      if (Number(selectedYearMobile) !== Number(mobileSeriesYear)) {
        return MONTHS.map((m) => ({ label: m, value: 0 }));
      }
    }

    const buckets = Array(12).fill(0);
    const list = Array.isArray(mobileUsersGraph) ? mobileUsersGraph : [];

    for (let i = 0; i < list.length; i++) {
      const row = list[i];

      if (rowsHaveExplicitMobileYear && selectedYearMobile) {
        const y = extractYear(row);
        if (y !== Number(selectedYearMobile)) continue;
      }

      let mIdx = -1;
      const short = normalizeMonthLabel(row && row.label);
      if (short) mIdx = MONTHS.indexOf(short);
      if (mIdx < 0 && row && (row.month != null || row.mm != null)) {
        const n = Number(row.month != null ? row.month : row.mm);
        mIdx = !isNaN(n) ? (n >= 1 && n <= 12 ? n - 1 : (n >= 0 && n <= 11 ? n : -1)) : -1;
      }
      if (mIdx < 0) {
        let d = toDate(row && (row.date || row.dateISO || row.timestamp));
        if (!d && (row && (row.created_at || row.createdAt))) d = parseCreatedAt(row.created_at || row.createdAt);
        if (d) mIdx = d.getMonth();
      }
      if (mIdx < 0) continue;

      const val = Number(row.value || 0);
      buckets[mIdx] += isNaN(val) ? 0 : val;
    }

    return MONTHS.map((m, i) => ({ label: m, value: buckets[i] }));
  }, [mobileUsersGraph, selectedYearMobile, rowsHaveExplicitMobileYear, mobileSeriesYear]);



  return (
    <>
    <div className="wrapper">
      <div className="navbar">
        <LGUNavbar />
      </div>
      <div className="layout">
        <LGUSidebar 
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
          <div className="header-row">
            <h2 className="page-title">Dashboard</h2>
          </div>
         {/* Dashboard Grid Layout */}
          <div style={styles.dashboardGrid}>
            {/* Row 1 - 4 mini cards */}
            <div style={styles.rowFour}>

              <div style={styles.miniCard}>
                <p style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#6b7280',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>Barangay Reports</p>
                <h3 style={{
                  fontSize: '32px',
                  fontWeight: '700',
                  color: '#111827',
                  margin: 0,
                }}>{totalReports}</h3>
              </div>
              
              <div style={styles.miniCard}>
                <p style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#6b7280',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>Document Requests</p>
                <h3 style={{
                  fontSize: '32px',
                  fontWeight: '700',
                  color: '#111827',
                  margin: 0,
                }}>{totalDocuments}</h3>
              </div>

              <div style={styles.miniCard}>
                <p style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#6b7280',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>Mobile Users</p>
                <h3 style={{
                  fontSize: '32px',
                  fontWeight: '700',
                  color: '#111827',
                  margin: 0,
                }}>{totalMobileUsers}</h3>
              </div>

              <div style={styles.miniCard}>
                <p
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#6b7280',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span>
                    Most Common Incident{(incidentTypeSummary?.top?.length || 0) > 1 ? 's' : ''}
                  </span>

                  {(incidentTypeSummary?.top?.length || 0) > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        color: '#94a3b8',
                        border: '1px solid #BFDBFE',
                        background: '#EFF6FF',
                        padding: '2px 8px',
                        borderRadius: 999,
                        marginLeft: '10px'
                      }}
                    >
                      {Math.min(commonIdx + 1, incidentTypeSummary.top.length)}/{incidentTypeSummary.top.length}
                    </span>
                  )}
                </p>

              {topList.length === 0 ? (
                <h3 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>—</h3>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const t = topList[commonIdx] || { type: '—', count: 0 };
                    nextCommon();
                  }}
                  title="Click to view next incident"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    borderRadius: 12,
                    border: '1px solid #ffffffff',
                    background: '#ffffffff',
                    cursor: 'pointer',
                  }}
                >
                  {(() => {
                    const t = topList[commonIdx] || { type: '—', count: 0 };
                    return (
                      <>
                        <h3
                          style={{
                            fontSize: '25px',
                            fontWeight: '700',
                            color: '#111827',
                            margin: 0,
                          }}
                        >
                          {t.type}
                        </h3>
                      </>
                    );
                  })()}
                </button>
              )}

              </div>

              <div style={styles.miniCard}>
                <p style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#6b7280',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>Most Reported Barangay</p>
                <h3 style={{
                  fontSize: '32px',
                  fontWeight: '700',
                  color: '#111827',
                  margin: 0,
                }}>{mostReportedBarangay || "N/A"}</h3>
              </div>

            </div>

            {/* Barangay Reports by Month graph */}
            <div style={styles.rowTwo}>
              
              <div style={{
                  ...styles.graphCard,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                }}>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    textAlign: "center",
                    width: "100%",
                  }}
                >
                  <h3
                    style={{
                      textAlign: "left",
                      marginBottom: "0px",
                      fontSize: "16px",
                      fontWeight: "600",
                      color: "#374856",
                    }}
                  >
                    Barangay Reports by Month
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", marginLeft: "auto", gap: 12 }}>

                  {/* Barangay Dropdown */}
                  <Select
                    options={barangayList.map((b) => {
                      const formattedName = b.name
                        .toLowerCase()
                        .replace(/\b\w/g, (c) => c.toUpperCase())
                        .trim();
                      return { value: formattedName, label: formattedName };
                    })}
                    value={
                      selectedBarangay
                        ? { value: selectedBarangay, label: selectedBarangay }
                        : null
                    }
                    onChange={(selectedOption) =>
                      setSelectedBarangay(selectedOption?.value || "")
                    }
                    placeholder="Select Barangay"
                    styles={dropdownStyles}
                  />

                  {/* Year Dropdown*/}
                  <Select
                    options={yearOptions}
                    value={selectedYearReports ? { value: String(selectedYearReports), label: String(selectedYearReports) } : null}
                    onChange={(opt) => setSelectedYearReports(opt ? opt.value : '')}
                    placeholder="Select Year"
                    styles={dropdownStyles}
                    isClearable
                  />

                  </div>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    key={`inc-${selectedYearReports || 'all'}-${selectedBarangay || 'all'}`}
                    data={incidentsByMonthGraph}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#374856" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div
                style={{
                  ...styles.graphCard,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  justifyContent: 'flex-start',
                }}
              >
                {/* Row: Title + Year dropdown */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    marginBottom: 12,
                    gap: 12,
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '16px',
                      fontWeight: 600,
                      color: '#374856',
                    }}
                  >
                    Mobile Users by Month
                  </h3>

                  <div style={{ minWidth: 180 }}>
                    <Select
                      options={yearOptions}
                      value={selectedYearMobile ? { value: String(selectedYearMobile), label: String(selectedYearMobile) } : null}
                      onChange={(opt) => setSelectedYearMobile(opt ? opt.value : '')}
                      placeholder={rowsHaveExplicitMobileYear ? "Select Year" : `${mobileSeriesYear}`}
                      styles={dropdownStyles}
                      isClearable
                    />
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={250}>
                <LineChart
                  key={`mob-${selectedYearMobile || 'all'}`}
                  data={mobileUsersByMonth}
                >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#374856" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/*Document Requests by Type graph */}
            <div style={styles.rowTwo}>

              <div style={{
                ...styles.graphCard,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                width: '100%'
              }}>
                <h3 style={{ 
                  textAlign: 'left', 
                  marginBottom: '15px', 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  color: '#374856' 
                }}>
                  Document Requests by Type
                </h3>

                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={documentRequestsGraph}
                      dataKey="value"
                      nameKey="label"
                      cx="40%"
                      cy="50%"
                      outerRadius={80}
                      fill="#10b981"
                    >
                      {documentRequestsGraph.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={["#2E7D32", "#2196F3", "#FF9800", "#F44336", "#9C27B0", "#795548", "#3b240aff"][index % 7]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />

                    <Legend 
                      layout="vertical"
                      verticalAlign="middle"
                      align="right"
                      wrapperStyle={{ 
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '15px',
                        fontWeight: 500,
                        color: '#374856',
                        lineHeight: '2em'
                      }}
                      iconSize={12}
                    />

                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{
                ...styles.graphCard,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
              }}>
                <h3 style={{ 
                  textAlign: 'left', 
                  marginBottom: '15px', 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  color: '#374856' 
                }}>
                  Map
                </h3>

                <div 
                  style={{ width: '100%', height: '250px', cursor: 'pointer' }}
                  onClick={() => setMapModalVisible(true)}
                >
                  <MapContainer 
                    center={[13.6215, 123.1811]}
                    zoom={13} 
                    style={{ width: '100%', height: '100%' }}
                    dragging={false}
                    scrollWheelZoom={false}
                    doubleClickZoom={false}
                    attributionControl={false}
                    zoomControl={false}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {filteredPins.map((pin, index) => (
                      <Marker 
                        key={index} 
                        position={[pin.latitude, pin.longitude]} 
                        icon={getPinIcon(pin.incident_type)}
                      >
                        <Popup>
                          {pin.barangay}, {pin.city} <br />
                          {pin.incident_type}
                        </Popup>
                      </Marker>
                    ))}

                    <FitBounds pins={filteredPins} />
                  </MapContainer>
                </div>
              </div>

            </div>

          </div>
        </div>
      </div>
    </div>

    {/* Map Modal */}
    {mapModalVisible && (
      <div
        className="overlay modal-fade"
        onClick={() => setMapModalVisible(false)}
      >
        <div
          className="modal"
          style={{ width: '90%', maxWidth: '900px', height: '80%', padding: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ width: '100%', height: '100%' }}>
            <MapContainer
              center={[13.6215, 123.1811]}
              zoom={13}
              style={{ width: '100%', height: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {filteredPins.map((pin, index) => (
                <Marker
                  key={index}
                  position={[pin.latitude, pin.longitude]}
                  icon={getPinIcon(pin.incident_type)}
                >
                  <Popup>
                    {pin.barangay}, {pin.city} <br />
                    {pin.incident_type}
                  </Popup>
                </Marker>
              ))}
              <FitBounds pins={filteredPins} />

            </MapContainer>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

const styles = {
  dashboardGrid: {
    display: 'grid',
    gridTemplateRows: '15% 40% 40%',
    gap: '20px',
    height: 'calc(100% - 40px)',
  },
  rowFour: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '20px',
  },
  rowTwo: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '20px',
  },
  rowThree: {
    display: 'grid',
    gridTemplateColumns: 'calc(40% - 13.33px) calc(40% - 8.66px) calc(20% - 20px)',
    gap: '20px',
},

  miniCard: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
    textAlign: 'center',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    flexDirection: 'column',
    //border: '1px solid #ddd',
  },
  graphCard: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    //border: '1px solid #ddd',
  },
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