const pool = require('../PostgreSQL/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { cleanText, fuzzyMatchKeywords, ID_KEYWORDS } = require('../utils/ocr');
const { getIo } = require('../socket');




// =================================================
//  CHECK USERNAME AVAILABILITY
// =================================================
const checkUsernameAvailability = async (req, res) => {
  const { username } = req.body;

  try {
    if (!username || username.trim() === '') {
      return res.status(400).json({ error: 'Username is required' });
    }

    const result = await pool.query(
      'SELECT * FROM admin_accounts WHERE username = $1',
      [username]
    );

    const isAvailable = result.rows.length === 0;

    res.status(200).json({ available: isAvailable });
  } catch (error) {
    console.error('Error checking username:', error.message);
    res.status(500).json({ error: 'Server error while checking username' });
  }
};


// =================================================
//  OCR PROCESSING
// =================================================
const processOCR = async (req, res) => {
  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const { idType } = req.body;
    if (!idType || !ID_KEYWORDS[idType]) {
      return res.status(400).json({ error: 'Invalid or missing ID type' });
    }

    // Process image in-memory with Sharp and pass buffer to Tesseract directly
    const processedBuffer = await sharp(req.file.path)
      .grayscale()
      .normalize()
      .resize({ width: 1000 })
      .png()
      .toBuffer(); // ✅ Skip writing to disk

    // OCR directly from processed buffer
    const {
      data: { text: rawText = '' }
    } = await Tesseract.recognize(processedBuffer, 'eng', {
      logger: m => console.log('🧠 OCR Progress:', m),
    });

    const cleanedText = cleanText(rawText);
    console.log('🧾 Cleaned OCR Text:', cleanedText);

    const { matched, keyword, score } = fuzzyMatchKeywords(cleanedText, idType);

    // Cleanup original file
    fs.promises.unlink(req.file.path).catch(err =>
      console.warn('⚠️ Failed to delete original file:', err)
    );

    return res.status(200).json({
      text: cleanedText,
      matched,
      matchedKeyword: keyword,
      matchScore: score,
    });

  } catch (error) {
    console.error('❌ OCR processing failed:', error.message || error);
    res.status(500).json({ error: 'OCR processing failed' });
  }
};



// =================================================
//  LGU ADMIN REGISTRATION
// =================================================
const registerLguAdmin = async (req, res) => {
  console.log('📥 Incoming LGU Admin Registration Request');
  console.log('📝 Form Data:', req.body);
  console.log('📎 Files:', req.files);

  const {
    username,
    password,
    role,
    lastName,
    firstName,
    position,
    phoneNumber,
    email,
    address,
    region,
    province,
    city,
  } = req.body;

  if (
    !username || !password || !role ||
    !lastName || !firstName || !position ||
    !phoneNumber || !email || !address ||
    !region || !province || !city
  ) {
    console.warn('Missing required fields');
    return res.status(400).json({ message: 'All form fields are required' });
  }

  const govID = req.files?.idFile?.[0] || null;
  const letterOfIntent = req.files?.intentFile?.[0] || null;

  if (!govID || !letterOfIntent) {
    console.warn('Missing uploaded documents');
    return res.status(400).json({ message: 'Both Government ID and Letter of Intent are required' });
  }

  const idFileName = govID?.filename || null;
  const intentFileName = letterOfIntent?.filename || null;

  const idUrl = govID ? `${req.protocol}://${req.get('host')}/uploads/id/${idFileName}` : null;
  const letterUrl = letterOfIntent ? `${req.protocol}://${req.get('host')}/uploads/letter/${intentFileName}` : null;

  try {
    const existing = await pool.query(
      'SELECT * FROM admin_accounts WHERE username = $1 AND role = $2',
      [username, role]
    );

    if (existing.rows.length > 0) {
      console.warn('Account already exists');
      return res.status(400).json({ message: 'Account already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const status = role === 'Local Government Unit' ? 'pending' : 'approved';

    await pool.query(
      `
      INSERT INTO admin_accounts (
        username, password, role, status,
        first_name, last_name, position, phone_number,
        email, address, region, province, city,
        upload_id_filename, upload_letter_filename,
        upload_id_url, upload_letter_url
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, $15, $16, $17
      )
    `,
      [
        username,
        hashedPassword,
        role,
        status,
        firstName,
        lastName,
        position,
        phoneNumber,
        email,
        address,
        region,
        province,
        city,
        idFileName,
        intentFileName,
        idUrl,
        letterUrl,
      ]
    );

    console.log('LGU Admin registration successful');

    return res.status(201).json({
      message:
        status === 'pending'
          ? 'Registration submitted. Awaiting Super Admin approval.'
          : 'Super Admin registered successfully.',
    });
  } catch (error) {
    console.error('Registration Error:', error.message);
    return res.status(500).json({ message: 'Registration failed', error: error.message });
  }
};


// =================================================================================
// LOGIN ADMIN
// =================================================================================
const adminLogin = async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM admin_accounts WHERE username = $1 AND role = $2',
      [username, role]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Account not found' });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (role === 'Local Government Unit') {
      if (user.status === 'pending') {
        return res.status(403).json({ message: 'Your LGU account is pending approval.' });
      }

      if (user.status === 'rejected') {
        return res.status(403).json({ message: 'Your LGU account has been rejected.' });
      }
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        status: user.status,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        status: user.status,
        firstName: user.first_name,
        lastName: user.last_name,
        position: user.position,
        phoneNumber: user.phone_number,
        email: user.email,
      }
    });

  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// =================================================================================
// BARANGAY LOGIN
// =================================================================================
const barangayStaffLogin = async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM barangay_accounts WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        barangay: user.barangay,
        lgu_id: user.lgu_id,
      },
      process.env.JWT_SECRET, // ✅ Uses .env secret
      { expiresIn: '2h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name, // ✅ add this
        lastName: user.last_name,   // ✅ add this
        position: user.position,
        barangay: user.barangay,
        lguId: user.lgu_id,
      },
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};




/*
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const mobileUserSignUp = async (req, res) => {
  try {
    console.log('📥 Received mobile signup request');

    const {
      firstName,
      lastName,
      username,
      email,
      phone,
      password,
      region,
      province,
      city,
      barangay,
      idType, // 🆕 new field
    } = req.body;

    console.log('📝 User details:', {
      firstName, lastName, username, email, phone,
      region, province, city, barangay, idType
    });

    if (!firstName || !lastName || !username || !email || !phone || !password || !idType) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }

    // 🔍 Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM mobile_users WHERE username = $1 OR email = $2',
      [username.trim(), email.trim()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'Username or email already exists.' });
    }

    // 🔐 Hash password
    const hashedPassword = await bcrypt.hash(password.trim(), 10);

    // 📎 Handle file (assumes multer already ran)
    const idFilename = req.file?.filename || null;
    const idUrl = idFilename
      ? `${req.protocol}://${req.get('host')}/uploads/mobile/${idFilename}`
      : null;

    if (idFilename) {
      console.log('🖼️ ID image saved as:', idFilename);
      console.log('🌐 ID image URL:', idUrl);
    }

    // 💾 Insert into database, including new status field
    const insertQuery = `
      INSERT INTO mobile_users 
      (first_name, last_name, username, email, phone_number, password, region, province, city, barangay, id_type, id_filename, id_url, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, first_name, last_name, username, email, phone_number, region, province, city, barangay, id_type, id_filename, id_url, status
    `;

    const insertValues = [
      firstName.trim(),
      lastName.trim(),
      username.trim(),
      email.trim(),
      phone.trim(),
      hashedPassword,
      region?.trim() || null,
      province?.trim() || null,
      city?.trim() || null,
      barangay?.trim() || null,
      idType?.trim() || null,
      idFilename,
      idUrl,
      'pending', // default status added here
    ];

    const result = await pool.query(insertQuery, insertValues);
    const user = result.rows[0];

    // Emit event to notify clients about new mobile user registration
    try {
      const io = getIo();
      io.emit('mobileUserRegistered', user);
    } catch (err) {
      console.warn('Socket.io not initialized:', err.message);
    }

    if (!JWT_SECRET) {
      return res.status(500).json({ message: 'JWT secret not configured.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    console.log('✅ Mobile user created:', user.username);

    res.status(201).json({
      message: 'User registered successfully.',
      user,
      token,
    });

  } catch (error) {
    console.error('❌ Error during mobile signup:', {
      message: error.message,
      detail: error?.detail,
      code: error?.code,
      constraint: error?.constraint,
    });
    res.status(500).json({ message: 'Server error during registration.', error: error.message });
  }
};
*/
// =================================================================================
// MOBILE REGISTRATION
// =================================================================================
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const mobileUserSignUp = async (req, res) => {
  try {
    console.log('📥 Received mobile signup request');

    const {
      firstName,
      lastName,
      middleName,
      dateOfBirth,
      phoneNumber,
      username,
      region,
      province,
      city,
      barangay,
      password,
    } = req.body;

    console.log('📝 User details:', {
      firstName, lastName, middleName, dateOfBirth, phoneNumber, username, 
      region, province, city, barangay,
    });

    // Format dateOfBirth to YYYY-MM-DD for PostgreSQL
    let dobFormatted = null;
    if (dateOfBirth) {
      if (dateOfBirth.includes('/')) {
        // MM/DD/YYYY → YYYY-MM-DD
        const [month, day, year] = dateOfBirth.split('/');
        dobFormatted = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      } else {
        // Already in YYYY-MM-DD
        dobFormatted = dateOfBirth;
      }
    }

    if (!firstName || !lastName || !username || !phoneNumber || !password) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM mobile_users WHERE username = $1',
      [username.trim()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'Username already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password.trim(), 10);

    const insertQuery = `
      INSERT INTO mobile_users 
      (first_name, last_name, middle_name, date_of_birth, phone_number, username, password, region, province, city, barangay, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, first_name, last_name, middle_name, date_of_birth, phone_number, username, region, province, city, barangay, status
    `;


    const insertValues = [
      firstName?.trim(),
      lastName?.trim(),
      middleName?.trim() || null,
      dobFormatted,
      phoneNumber?.trim(),
      username?.trim(),
      hashedPassword,
      region?.trim() || '',
      province?.trim() || '',
      city?.trim() || '',
      barangay?.trim() || '',
      'unverified'
    ];


    const result = await pool.query(insertQuery, insertValues);
    const user = result.rows[0];

    // ===========================
    // Create notification for mobile signup
    // ===========================
    try {
      await pool.query(
        `INSERT INTO notifications 
        (mobile_user_id, region, province, city, barangay, type, is_read, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, FALSE, NOW())`,
        [user.id, user.region, user.province, user.city, user.barangay, 'mobileRegistered']
      );

      console.log(`✅ Notification created for mobile user ID ${user.id} at location ${user.region}, ${user.province}, ${user.city}, ${user.barangay}`);
    } catch (notifErr) {
      console.error('❌ Failed to create notification:', notifErr);
    }


    // Emit event to notify clients about new mobile user registration
    try {
      const io = getIo();
      io.emit('mobileUserRegistered', user);
    } catch (err) {
      console.warn('Socket.io not initialized:', err.message);
    }

    if (!JWT_SECRET) {
      return res.status(500).json({ message: 'JWT secret not configured.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    console.log('✅ Mobile user created:', user.username);

    res.status(201).json({
      message: 'User registered successfully.',
      user,
      token,
    });

  } catch (error) {
    console.error('❌ Error during mobile signup:', {
      message: error.message,
      detail: error?.detail,
      code: error?.code,
      constraint: error?.constraint,
    });
    res.status(500).json({ message: 'Server error during registration.', error: error.message });
  }
};


// =================================================================================
//  VERIFICATION REQUEST
// =================================================================================

const requestMobileUserVerification = async (req, res) => {
  try {
    console.log('📥 Received mobile user verification request');

    const userId = req.user?.id;
    console.log("👤 User ID from token:", userId);

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: No user ID in token" });
    }


    // ===========================
    // Check verification attempts & cooldown
    // ===========================
    const userQuery = await pool.query(
      `SELECT id, region, province, city, barangay, 
              verification_attempts, last_verification_request, status 
      FROM mobile_users 
      WHERE id=$1`,
      [userId]
    );
    if (!userQuery.rows.length) return res.status(404).json({ message: "User not found" });

    const user = userQuery.rows[0];

    const MAX_ATTEMPTS = 2;
    const COOLDOWN_MINUTES = 1; // Test
    const attempts = user.verification_attempts || 0;
    const lastRequest = user.last_verification_request ? new Date(user.last_verification_request) : null;
    const now = new Date();

    if (user.status === 'unverified' && attempts >= MAX_ATTEMPTS && lastRequest) {
      const diffMinutes = (now.getTime() - lastRequest.getTime()) / (1000 * 60);
      if (diffMinutes < COOLDOWN_MINUTES) {
        return res.status(400).json({
          message: `Cooldown active. Please wait ${Math.ceil(COOLDOWN_MINUTES - diffMinutes)} minute(s).`
        });
      }
    }

    // ===========================
    // Handle form fields & files
    // ===========================
    const { civil_status, sex, home_address, id_type } = req.body;

    const idImages = req.files?.idImage || [];
    const idFrontFile = idImages[0];
    const idBackFile  = idImages[1];
    const selfieFile = req.files?.selfieTaken?.[0];

    //console.log('💾 Fields:', { civil_status, sex, home_address, id_type });
    //console.log('💾 Files:', { idFrontFile, idBackFile, selfieFile });

    if (!civil_status || !sex || !home_address || !idFrontFile || !idBackFile || !selfieFile) {
      return res.status(400).json({ message: 'Missing required fields or files.' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const idFrontUrl = `${baseUrl}/${idFrontFile.path.replace(/\\/g, '/')}`;
    const idBackUrl  = `${baseUrl}/${idBackFile.path.replace(/\\/g, '/')}`;
    const selfieUrl  = `${baseUrl}/${selfieFile.path.replace(/\\/g, '/')}`;

    const result = await pool.query(
      `UPDATE mobile_users SET
        civil_status=$1,
        sex=$2,
        home_address=$3,
        id_type=$4,
        id_front_path=$5,
        id_front_url=$6,
        id_back_path=$7,
        id_back_url=$8,
        selfie_path=$9,
        selfie_url=$10,
        status='pending'
      WHERE id=$11
      RETURNING *`,
      [
        civil_status,
        sex,
        home_address,
        id_type,
        idFrontFile.path,
        idFrontUrl,
        idBackFile.path,
        idBackUrl,
        selfieFile.path,
        selfieUrl,
        userId
      ]
    );


    console.log("📝 DB Update result rowCount:", result.rowCount);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found or not updated" });
    }


    // ===========================
    // Create notification for mobile signup
    // ===========================
    try {
    await pool.query(
      `INSERT INTO notifications 
      (mobile_user_id, region, province, city, barangay, first_name, last_name, type, is_read, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, NOW())`,
      [
        user.id,
        user.region,
        user.province,
        user.city,
        user.barangay,
        user.first_name,
        user.last_name,
        'verificationRequest'
      ]
    );


      console.log(`✅ Notification created for mobile user ID ${user.id} at location ${user.region}, ${user.province}, ${user.city}, ${user.barangay}`);
    } catch (notifErr) {
      console.error('❌ Failed to create notification:', notifErr);
    }


    const io = getIo();
    io.emit('newVerificationRequest', result.rows[0]);
    console.log('📡 Emitted newVerificationRequest event to web clients');

    res.json({ message: 'Verification submitted successfully', user: result.rows[0] });
  } catch (err) {
    console.error('❌ Error during verification request:', err);
    res.status(500).json({ message: 'Server error during verification', error: err.message });
  }
};




// =================================================================================
// MOBILE LOGIN
// =================================================================================
const mobileUserLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    const result = await pool.query(
      'SELECT * FROM mobile_users WHERE username = $1',
      [username]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    if (!JWT_SECRET) {
      console.error('❌ JWT_SECRET is not defined');
      return res.status(500).json({ message: 'JWT_SECRET not configured.' });
    }

    const tokenPayload = { id: user.id, username: user.username };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phoneNumber: user.phone_number,
      },
      token,
    });

  } catch (error) {
    console.error('❌ Error during login:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
};






const twilio = require('twilio');

console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID);
console.log('TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? 'Loaded' : 'Missing');
console.log('TWILIO_SERVICE_SID:', process.env.TWILIO_SERVICE_SID);

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_SERVICE_SID;

const client = twilio(accountSid, authToken);

// Send OTP
const sendOTP = async (req, res) => {
  const { phoneNumber } = req.body;

  console.log('[OTP] Requested for:', phoneNumber); // 🔍 Incoming phone

  try {
    const verification = await client.verify.v2.services(serviceSid)
      .verifications
      .create({ to: phoneNumber, channel: 'sms' });

    console.log('[OTP] Twilio response:', verification); // 🔍 Log Twilio result

    res.status(200).json({ success: true, status: verification.status });
  } catch (err) {
    console.error('[OTP] Error sending OTP:', err.message); // 🔍 Error log
    res.status(500).json({ success: false, message: err.message });
  }
};


// Verify OTP
const verifyOTP = async (req, res) => {
  const { phoneNumber, code } = req.body;

  try {
    const verificationCheck = await client.verify.v2.services(serviceSid)
      .verificationChecks
      .create({ to: phoneNumber, code });

    if (verificationCheck.status === 'approved') {
      res.status(200).json({ success: true });
    } else {
      res.status(400).json({ success: false, message: 'Incorrect OTP' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

















// =================================================
// GET ADMIN PROFILE
// =================================================
const getAdminProfile = async (req, res) => {
    const { id } = req.params;
    const role = req.query.role || 'Super Admin';

    try {
        const result = await pool.query(
        'SELECT * FROM admin_accounts WHERE id = $1 AND role = $2',
        [id, role]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: `${role} account not found` });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`${role} Profile fetch error:`, error);
    return res.status(500).json({ message: 'Server error' });
  }
};


// =================================================
// GET LGU PROFILE
// =================================================
const getLGUProfile = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM admin_accounts WHERE id = $1 AND role = $2',
      [id, 'Local Government Unit']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'LGU account not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// =================================================
// GET BARANGAY PROFILE
// =================================================
const getBarangayProfile = async (req, res) => {
  const { id } = req.params;
  //console.log('[PROFILE] Fetching Barangay profile for ID:', id);

  try {
    const result = await pool.query(
      `SELECT * FROM barangay_accounts WHERE id = $1`,
      [id]
    );
    //console.log('[PROFILE] Query returned', result.rows.length, 'rows');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching barangay accounts:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// =================================================
// GET MOBILE USER PROFILE
// =================================================
/*
const getMobileUserProfile = async (req, res) => {
  const { id } = req.params;
  console.log('[PROFILE] Received request to fetch mobile user profile. ID:', id);

  try {
    console.log('[PROFILE] Executing DB query for user ID:', id);
    const result = await pool.query(
      `SELECT * FROM mobile_users WHERE id = $1`,
      [id]
    );
    console.log('[PROFILE] Query executed successfully.');

    if (!result.rows.length) {
      console.warn(`[PROFILE] No user found with ID: ${id}`);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('[PROFILE] Query returned rows:', result.rows.length);
    console.log('[PROFILE] User data:', result.rows[0]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PROFILE] Error fetching user profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
*/

const getMobileUserProfile = async (req, res) => {
  try {
    //console.log("[PROFILE] Received request to fetch mobile user profile. ID:", req.params.id);

    const result = await pool.query("SELECT * FROM mobile_users WHERE id=$1", [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];

    // Build full URLs
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    user.id_front_url  = user.id_front_path  ? `${baseUrl}/${user.id_front_path.replace(/\\/g, "/")}` : null;
    user.id_back_url   = user.id_back_path   ? `${baseUrl}/${user.id_back_path.replace(/\\/g, "/")}` : null;
    user.selfie_url    = user.selfie_path    ? `${baseUrl}/${user.selfie_path.replace(/\\/g, "/")}` : null;
    user.profile_picture = user.profile_picture ? `${baseUrl}${user.profile_picture.replace(/\\/g, "/")}` : null;

    //console.log("[PROFILE] User data with URLs:", user);

    res.json(user);
  } catch (err) {
    console.error("❌ Error fetching profile:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


// =================================================
// UPDATE MOBILE USER PROFILE PICTURE
// =================================================
const updateMobileUserProfilePicture = async (req, res) => {
  const { id } = req.params;
  console.log('[PROFILE UPDATE] Received request to update profile picture for user ID:', id);

  const file = req.file;
  if (!file) {
    console.warn('[PROFILE UPDATE] No file uploaded in request.');
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filePath = `/uploads/profile/${file.filename}`;
  console.log('[PROFILE UPDATE] File uploaded with filename:', file.filename);
  console.log('[PROFILE UPDATE] File will be saved with path:', filePath);

  try {
    console.log('[PROFILE UPDATE] Executing DB update for user ID:', id);
    const updateResult = await pool.query(
      `UPDATE mobile_users SET profile_picture = $1 WHERE id = $2 RETURNING *`,
      [filePath, id]
    );

    if (!updateResult.rows.length) {
      console.warn(`[PROFILE UPDATE] No user found to update with ID: ${id}`);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('[PROFILE UPDATE] Profile picture updated successfully in DB for user:', updateResult.rows[0]);

    res.json({
      message: 'Profile picture updated successfully',
      picture: filePath,
      user: updateResult.rows[0],
    });
  } catch (err) {
    console.error('[PROFILE UPDATE] Error updating profile picture:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// =================================================
// REMOVE MOBILE USER PROFILE PICTURE
// =================================================
const removeMobileUserProfilePicture = async (req, res) => {
  const { id } = req.params;

  try {
    // Update the user's profile_picture to null or empty string
    await pool.query(
      `UPDATE mobile_users
       SET profile_picture = NULL
       WHERE id = $1`,
      [id]
    );

    res.json({ message: 'Profile picture removed successfully' });
  } catch (err) {
    console.error('Error removing profile picture:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};





module.exports = {
  checkUsernameAvailability,
  processOCR,
  registerLguAdmin,
  adminLogin,
  mobileUserSignUp,
  requestMobileUserVerification,
  sendOTP,
  verifyOTP,
  mobileUserLogin,

  getAdminProfile,
  getLGUProfile,
  barangayStaffLogin,
  getBarangayProfile,
  getMobileUserProfile,
  updateMobileUserProfilePicture,
  removeMobileUserProfilePicture
};