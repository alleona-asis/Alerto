import { useState, useEffect } from "react";
import Select from 'react-select';
import './login.css';
import axios from '../../axios/axiosInstance';
import { motion } from 'framer-motion';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import location from 'phil-reg-prov-mun-brgy';

const {
  regions,
  getProvincesByRegion,
  getCityMunByProvince,
  getBarangayByMun,
  sort,
} = location;

export default function Login() {
  const [userType, setUserType] = useState('ADMIN');
  const [role, setRole] = useState('Local Government Unit');
  const [isRegistering, setIsRegistering] = useState(false);

  // Input  Fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [position, setPosition] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [region, setRegion] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [idFile, setIdFile] = useState(null);
  const [intentFile, setIntentFile] = useState(null);

  const [idStatus, setIdStatus] = useState('');
  const [intentStatus, setIntentStatus] = useState('');
  const [idFileName, setIdFileName] = useState('');
  const [intentFileName, setIntentFileName] = useState('');

  const [provinceList, setProvinceList] = useState([]);
  const [cityList, setCityList] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedCity, setSelectedCity] = useState('');

  // Error Handling
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneNumberError, setPhoneNumberError] = useState('');
  const [focusedInput, setFocusedInput] = useState(null);


  // =================================================
  // ERROR HANDLING
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
  // LOAD PROVINCE WHEN REGION CHANGES
  // =================================================
    useEffect(() => {
    if (selectedRegion) {
      const provinces = getProvincesByRegion(selectedRegion);
      setProvinceList(sort(provinces, 'A'));
      setSelectedProvince('');
      setCityList([]);
      setSelectedCity('');
    } else {
      setProvinceList([]);
      setSelectedProvince('');
      setCityList([]);
      setSelectedCity('');
    }
  }, [selectedRegion]);


  // =================================================
  // LOAD CITIES WHEN PROVINCE  CHANGES
  // =================================================
  useEffect(() => {
    if (selectedProvince) {
      const cities = getCityMunByProvince(selectedProvince);
      setCityList(sort(cities, 'A'));
      setSelectedCity('');
    } else {
      setCityList([]);
      setSelectedCity('');
    }
  }, [selectedProvince]);


  // =================================================
  // HANDLE LOGIN
  // =================================================
  const handleLogin = async () => {
    try {
      const endpoint = role === 'BARANGAY'
        ? '/api/auth/barangay-staff-login'
        : '/api/auth/login-admin';

      const res = await axios.post(endpoint, { username, password, role });
      const { token, user } = res.data;

      localStorage.setItem('token', token);
      localStorage.setItem('userId', user.id);
      localStorage.setItem('role', role);

      localStorage.setItem('adminInfo', JSON.stringify(user));
      console.debug('Saved adminInfo in localStorage:', user);

      toast.success('Login successful!');
      resetForm();

      setTimeout(() => {
        if (role === 'Super Admin') {
          window.location.href = '/ADMINDashboard';
        } else if (role === 'Local Government Unit') {
          window.location.href = '/LGUDashboard';
        } else {
          window.location.href = '/BRGYDashboard';
        }
      }, 1200);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login error');
    }
  };

  // =================================================
  // HANDLE REGISTRATION
  // =================================================
  const handleRegister = async () => {
    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);
      formData.append('role', role);
      formData.append('firstName', firstName);
      formData.append('lastName', lastName);
      formData.append('position', position);
      formData.append('phoneNumber', phoneNumber);
      formData.append('email', email);
      formData.append('address', address);
      formData.append('region', region);
      formData.append('province', province);
      formData.append('city', city);
      if (idFile) formData.append('idFile', idFile);
      if (intentFile) formData.append('intentFile', intentFile);

      const res = await axios.post(
        '/api/auth/register-lgu-admin',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      toast.success('Registration submitted. Awaiting Super Admin approval.');
      resetForm();
      setIsRegistering(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration error');
    }
  };

  // =================================================
  // UPLOAD FUNCTION
  // =================================================
  const handleAutoUpload = (e, setFile, setStatus, setFileName) => {
    const file = e.target.files[0];
    if (!file) return;

    const maxSizeMB = 15;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      setStatus(`File too large (max ${maxSizeMB}MB)`);
      return;
    }

    setFile(file);
    setFileName(file.name);
    setStatus('Uploaded ✔');
  };

  const handleRemoveFile = (setFile, setStatus, setFileName, inputRef = null) => {
    setFile(null);
    setFileName('');
    setStatus('');
    if (inputRef?.current) {
      inputRef.current.value = null;
    }
  };

  // =================================================
  // RESET FORM
  // =================================================
  const resetForm = () => {
    setUsername('');
    setPassword('');

    setFirstName('');
    setLastName('');
    setPosition('');
    setPhoneNumber('');
    setEmail('');
    setAddress('');

    setIdFile(null);
    setIntentFile(null);

    setIdStatus('');
    setIntentStatus('');
    setIdFileName('');
    setIntentFileName('');


    setSelectedRegion('');
    setSelectedProvince('');
    setSelectedCity('');

    setProvinceList([]);
    setCityList([]);

    setRegion('');
    setProvince('');
    setCity('');


    setUsernameError('');
    setPasswordError('');
    setEmailError('');
    setPhoneNumberError('');
  };

  return (
      <motion.div
        initial={{ x: '-100vw', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100vw', opacity: 0 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
    
    <div className="container">
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
      <div className="card">
        <div className="card-header">
          <h1 className="title">Welcome to Alerto</h1>
          <p className="subtitle">
            Bulletin for Announcements, Incident Reports, and Document Requests.
          </p>

          <div className="toggle-container">
            <button
              className="toggle-button"
              style={{
                backgroundColor: userType === 'ADMIN' ? '#fff' : 'transparent',
                color: userType === 'ADMIN' ? '#374856' : '#8696BB',
                fontWeight: userType === 'ADMIN' ? '700' : '200',
              }}
              onClick={() => {
                setUserType('ADMIN');
                setRole('Super Admin');
                setIsRegistering(false);
                resetForm();
              }}
            >
              Login as ADMIN
            </button>

            <button
              className="toggle-button"
              style={{
                backgroundColor: userType === 'BARANGAY' ? '#fff' : 'transparent',
                color: userType === 'BARANGAY' ? '#374856' : '#8696BB',
                fontWeight: userType === 'BARANGAY' ? '700' : '200',
              }}
              onClick={() => {
                setUserType('BARANGAY');
                setRole('BARANGAY');
                setIsRegistering(false);
                resetForm();
              }}
            >
              Login as STAFF
            </button>
          </div>
        </div>

        <div className="card-body">
        {userType === 'ADMIN' && (
          <>
            <Select
              options={[
                { value: 'Super Admin', label: 'Super Admin' },
                { value: 'Local Government Unit', label: 'Local Government Unit' },
              ]}
              value={{ value: role, label: role }}
              onChange={(selectedOption) => {
                  if (selectedOption.value !== role) {
                    setRole(selectedOption.value);
                    resetForm();
                  }
                }}
              styles={dropdownStyles}
            />

            {/* Username Field */}
            <div className="input-wrapper">
              <label className="input-label">Username</label>
              <input
                className={`input-field ${focusedInput === 'username' ? 'input-focus' : ''} ${usernameError ? 'input-error-border' : ''}`}
                onFocus={() => setFocusedInput('username')}
                onBlur={() => setFocusedInput(null)}
                placeholder="Enter your username"
                value={username}
                onChange={async (e) => {
                  const val = e.target.value;
                  setUsername(val);
                  if (!validateInput(val)) {
                    setUsernameError('Username must be at least 8 characters long, and include at least one special character and one number.');
                    return;
                  }

                  if (isRegistering) {
                    try {
                      const res = await axios.post('/api/auth/check-username', { username: val });
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

            {/* Password Field */}
            <div className="input-wrapper">
              <label className="input-label">Password</label>
              <input
                type="password"
                className={`input-field ${focusedInput === 'password' ? 'input-focus' : ''} ${passwordError ? 'input-error-border' : ''}`}
                onFocus={() => setFocusedInput('password')}
                onBlur={() => setFocusedInput(null)}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.includes(' ')) return;
                  setPassword(val);
                  setPasswordError(validateInput(val) ? '' : 'Password must be at least 8 characters long, and include at least one special character and one number');
                }}
                onKeyDown={(e) => e.key === ' ' && e.preventDefault()}
              />
              {passwordError && <p className="input-error-message">{passwordError}</p>}
            </div>


            {/* LGU Registration Extra Fields */}
        {role === 'Local Government Unit' && isRegistering && (
        <>

        <div className="row">
                    {/* Last Name Input */}
          <div className="input-wrapper" style={{ width: '35%' }}>
            <label className="input-label">Representative Name</label>
            <input
              type="text"
              className={`input-field ${focusedInput === 'lastName' ? 'input-focus' : ''}`}
              onFocus={() => setFocusedInput('lastName')}
              onBlur={() => setFocusedInput(null)}
              placeholder="Enter your First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          {/* First Name Input */}
          <div className="input-wrapper" style={{ width: '35%' }}>
            <label className="input-label"  style={{color: '#fff'}}>Representative Name</label>
            <input
              type="text"
              className={`input-field ${focusedInput === 'firstName' ? 'input-focus' : ''}`}
              onFocus={() => setFocusedInput('firstName')}
              onBlur={() => setFocusedInput(null)}
              placeholder="Enter your Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>


          {/* Position Input */}
          <div className="input-wrapper" style={{ width: '30%' }}>
            <label className="input-label">Position</label>
            <input
              type="text"
              className={`input-field ${focusedInput === 'position' ? 'input-focus' : ''}`}
              onFocus={() => setFocusedInput('position')}
              onBlur={() => setFocusedInput(null)}
              placeholder="Enter Position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
          </div>
        </div>

        <div className="row">
          {/* Phone Number Input */}
          <div className="input-wrapper">
            <label className="input-label">Phone Number</label>
            <input
              className={`input-field ${focusedInput === 'phoneNumber' ? 'input-focus' : ''} ${phoneNumberError ? 'input-error' : ''}`}
              onFocus={() => setFocusedInput('phoneNumber')}
              onBlur={() => setFocusedInput(null)}
              placeholder="+639XXXXXXXXX"
              value={phoneNumber}
              onChange={(e) => {
                let value = e.target.value;
                if (value.includes(' ')) return;

                if (!value.startsWith('+639')) {
                  value = '+639' + value.replace(/\D/g, '').slice(0, 9);
                } else {
                  value = '+639' + value.slice(4).replace(/\D/g, '').slice(0, 9);
                }

                setPhoneNumber(value);

                if (value.length !== 13) {
                  setPhoneNumberError('Phone number must be +639 followed by 9 digits');
                } else {
                  setPhoneNumberError('');
                }
              }}
            />
            {phoneNumberError && <p className="input-error-message">{phoneNumberError}</p>}
          </div>

          {/* Government Email Input */}
          <div className="input-wrapper">
            <label className="input-label">Email</label>
            <input
              className={`input-field ${focusedInput === 'email' ? 'input-focus' : ''} ${emailError ? 'input-error' : ''}`}
              onFocus={() => setFocusedInput('email')}
              onBlur={() => setFocusedInput(null)}
              placeholder="@gmail.com"
              value={email}
              onChange={(e) => {
                const value = e.target.value;
                if (value.includes(' ')) return;

                setEmail(value);

                if (!value.includes('@')) {
                  setEmailError('(e.g., ncib@gmail.com)');
                } else {
                  setEmailError('');
                }
              }}
            />
            {emailError && <p className="input-error-message">{emailError}</p>}
          </div>
        </div>

        {/* Address Input */}
        <div className="input-wrapper">
          <label className="input-label">Office Address</label>
          <input
            type="text"
            className={`input-field ${focusedInput === 'address' ? 'input-focus' : ''}`}
            onFocus={() => setFocusedInput('address')}
            onBlur={() => setFocusedInput(null)}
            placeholder="Enter your Address"
            value={address}
            onChange={e => setAddress(e.target.value)}
          />
        </div>

        {/* Select Region */}
        <Select
          options={regions.map((r) => ({
            value: r.reg_code,
            label: r.name,
          }))}
          value={
            selectedRegion
              ? {
                  value: selectedRegion,
                  label:
                    regions.find((r) => r.reg_code === selectedRegion)?.name || '',
                }
              : null
          }
          onChange={(selected) => {
            const code = selected?.value;
            const region = regions.find((r) => r.reg_code === code);
            setSelectedRegion(code);
            setRegion(region?.name || '');
            setProvinceList(sort(getProvincesByRegion(code), 'A'));
            setProvince('');
            setSelectedProvince('');
            setCity('');
            setCityList([]);
            setSelectedCity('');
          }}
          onFocus={() => setFocusedInput('region-select')}
          onBlur={() => setFocusedInput(null)}
          placeholder="Select Region"
          styles={dropdownStyles}
        />

        {/* Select Province */}
        <Select
          options={provinceList.map(p => ({
            value: p.prov_code,
            label: p.name,
          }))}
          value={provinceList.find(p => p.prov_code === selectedProvince)
            ? { value: selectedProvince, label: province }
            : null}
          onChange={(selected) => {
            const code = selected.value;
            const province = provinceList.find(p => p.prov_code === code);
            setSelectedProvince(code);
            setProvince(province?.name || '');
            setCityList(sort(getCityMunByProvince(code), 'A'));
            setCity('');
            setSelectedCity('');
          }}
          onFocus={() => setFocusedInput('province')}
          onBlur={() => setFocusedInput(null)}
          placeholder="Select Province"
          isDisabled={!provinceList.length}
          styles={dropdownStyles}
        />

        {/* Select City */}
        <Select
          options={cityList.map(c => ({
            value: c.mun_code,
            label: c.name,
          }))}
          value={cityList.find(c => c.mun_code === selectedCity)
            ? { value: selectedCity, label: city }
            : null}
          onChange={(selected) => {
            const code = selected.value;
            const city = cityList.find(c => c.mun_code === code);
            setSelectedCity(code);
            setCity(city?.name || '');
          }}
          onFocus={() => setFocusedInput('city')}
          onBlur={() => setFocusedInput(null)}
          placeholder="Select City / Municipality"
          isDisabled={!cityList.length}
          styles={dropdownStyles}
        />

        <div className="upload-container">
          {/* Government-Issued ID */}
          <div className="upload-box">
            <label className="input-label">Upload Government-Issued ID</label>
            <div
              className="dropzone"
              onClick={() => document.getElementById("id-upload-input").click()}
            >
              <input
                id="id-upload-input"
                type="file"
                accept=".png,.jpg,.jpeg"
                className="file-input"
                onChange={(e) =>
                  handleAutoUpload(e, setIdFile, setIdStatus, setIdFileName)
                }
                style={{ display: "none" }} // hide default input
              />
              <div className="upload-content">
                <p className="upload-size">
                  <span className="click-text">Click to Upload</span> or drag and drop
                </p>
                <small className="upload-size">(PNG, JPG • Max: 15 MB)</small>

                {idStatus && (
                  <div
                    className="status-container"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="status-text">{idFileName}</span>
                    <span className="status-text">{idStatus}</span>
                    <button
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation(); // block from bubbling
                        handleRemoveFile(setIdFile, setIdStatus, setIdFileName);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Letter of Intent */}
          <div className="upload-box">
            <label className="input-label">Upload Letter of Intent</label>
            <div
              className="dropzone"
              onClick={() => document.getElementById("intent-upload-input").click()}
            >
              <input
                id="intent-upload-input"
                type="file"
                accept=".pdf,.doc,.docx"
                className="file-input"
                onChange={(e) =>
                  handleAutoUpload(e, setIntentFile, setIntentStatus, setIntentFileName)
                }
                style={{ display: "none" }}
              />
              <div className="upload-content">
                <p className="upload-size">
                  <span className="click-text">Click to Upload</span> or drag and drop
                </p>
                <small className="upload-size">(PDF, DOCX • Max: 15 MB)</small>

                {intentStatus && (
                  <div
                    className="status-container"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="status-text">{intentFileName}</span>
                    <span className="status-text">{intentStatus}</span>
                    <button
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile(
                          setIntentFile,
                          setIntentStatus,
                          setIntentFileName
                        );
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        </>
        )}
            {/* Login / Register Buttons */}
            {role === 'Local Government Unit' ? (
              isRegistering ? (
                <>
                  <button className="button" onClick={handleRegister}>Register</button>
                  <p className="subtitlelink">
                    Already have an account?{" "}
                    <span 
                      className="link" 
                      onClick={() => {
                        setIsRegistering(false);
                        resetForm();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setIsRegistering(false);
                          resetForm();
                        }
                      }}
                    >
                      Login
                    </span>
                  </p>
                </>
              ) : (
                <>
                  <button className="button" onClick={handleLogin}>Login</button>
                  <p className="subtitlelink">
                    Want to register your barangays?{" "}
                    <span 
                      className="link"
                      onClick={() => { 
                        setIsRegistering(true); 
                        resetForm();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setIsRegistering(true);
                          resetForm();
                        }
                      }}
                    >
                      Apply for LGU Access
                    </span>
                  </p>
                </>
              )
            ) : (
              <button className="button" onClick={handleLogin}>Login</button>
            )}
          </>
        )}

        {/* Barangay Login */}
        {userType === 'BARANGAY' && (
          <>
            <div className="input-wrapper">
              <label className="input-label">Username</label>
              <input
                className={`input-field ${focusedInput === 'username' ? 'input-focus' : ''} ${usernameError ? 'input-error-border' : ''}`}
                value={username}
                placeholder="Enter your username"
                onFocus={() => setFocusedInput('username')}
                onBlur={() => setFocusedInput(null)}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === ' ' && e.preventDefault()}
              />
              {usernameError && <p className="input-error-message">{usernameError}</p>}
            </div>

            <div className="input-wrapper">
              <label className="input-label">Password</label>
              <input
                type="password"
                className={`input-field ${focusedInput === 'password' ? 'input-focus' : ''} ${passwordError ? 'input-error-border' : ''}`}
                value={password}
                placeholder="Enter your password"
                onFocus={() => setFocusedInput('password')}
                onBlur={() => setFocusedInput(null)}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === ' ' && e.preventDefault()}
              />
              {passwordError && <p className="input-error-message">{passwordError}</p>}
            </div>
            <button className="button" onClick={handleLogin}>Login</button>
          </>
        )}
      </div>
      </div>
    </div>
    </motion.div>
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