const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const Authentication = require('../Middleware/auth');
const { uploadWithSupabase } = require('../Middleware/upload');

// ========== Multer Storage Setup ==========
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let folder = 'uploads/other';

    switch (file.fieldname) {
      case 'idFile':
        folder = 'uploads/id';
        break;
      case 'intentFile':
        folder = 'uploads/letter';
        break;
      case 'idImage':
        folder = 'uploads/mobile'; // for mobile ID uploads
        break;
      case 'selfieTaken':
        folder = 'uploads/selfie'; // folder for mobile user selfie pictures
        break;
      case 'image':
        folder = 'uploads/ocr'; // OCR-specific images
        break;
      case 'picture':
        folder = 'uploads/profile'; // folder for mobile user profile pictures
        break;
    }

    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// ========== Controllers ==========
const {
  mobileUserSignUp,
  requestMobileUserVerification,
  sendOTP,
  verifyOTP,
  mobileUserLogin,
  registerLguAdmin,
  adminLogin,
  checkUsernameAvailability,
  processOCR,
  getAdminProfile,
  getLGUProfile,
  barangayStaffLogin,
  getBarangayProfile,
  getMobileUserProfile,
  updateMobileUserProfilePicture,
  removeMobileUserProfilePicture
} = require('../Controller/authController');

// ========== ROUTES ==========

// ✅ Username Availability
router.post('/check-username', checkUsernameAvailability);

// ✅ OCR Endpoint
router.post(
  '/ocr',
  uploadWithSupabase([{ name: 'image', maxCount: 1 }]),
  async (req, res) => {
    try {
      // Access the uploaded file info
      const imageFile = req.supabaseFiles.find(f => f.field === 'image');

      if (!imageFile) {
        return res.status(400).json({ error: 'No image uploaded' });
      }

      const localPath = imageFile.localPath;      // local copy
      const supabaseUrl = imageFile.supabaseUrl;  // private signed URL

      // Call your OCR processor
      const ocrResult = await processOCR(localPath);

      res.json({
        message: 'OCR processed successfully',
        ocrResult,
        localPath,
        supabaseUrl
      });
    } catch (err) {
      console.error('[OCR] Upload or processing failed:', err.message);
      res.status(500).json({ error: 'OCR processing failed' });
    }
  }
);

// ✅ LGU Admin Registration
router.post(
  '/register-lgu-admin',
  uploadWithSupabase([
    { name: 'idFile', maxCount: 1 },
    { name: 'intentFile', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      // Access Supabase URLs
      const idFile = req.supabaseFiles.find(f => f.field === 'idFile')?.supabaseUrl || null;
      const intentFile = req.supabaseFiles.find(f => f.field === 'intentFile')?.supabaseUrl || null;

      // Optional: access local paths too
      const localId = req.supabaseFiles.find(f => f.field === 'idFile')?.localPath || null;
      const localIntent = req.supabaseFiles.find(f => f.field === 'intentFile')?.localPath || null;

      // Now you can pass these URLs to your controller or DB
      await registerLguAdmin(req, res, { idFile, intentFile, localId, localIntent });
    } catch (err) {
      console.error('[LGU REGISTER] Upload failed:', err.message);
      res.status(500).json({ error: 'File upload failed' });
    }
  }
);

// ✅ Admin Login
router.post('/login-admin', adminLogin);

// ✅ Mobile User Registration
router.post('/mobile-user-registration', mobileUserSignUp);


// Mobile User Verification with multer for ID images and selfie
router.post(
  '/mobile-users/verify',
  Authentication, // JWT authentication
  uploadWithSupabase([
    { name: 'idImage', maxCount: 2 },    // front & back IDs
    { name: 'selfieTaken', maxCount: 1 } // selfie
  ]),
  async (req, res) => {
    try {
      // Access uploaded files info
      const idFiles = req.supabaseFiles.filter(f => f.field === 'idImage');
      const selfieFile = req.supabaseFiles.find(f => f.field === 'selfieTaken');

      // Local paths (optional)
      const localIdPaths = idFiles.map(f => f.localPath);
      const localSelfie = selfieFile?.localPath || null;

      // Supabase URLs (private)
      const idUrls = idFiles.map(f => f.supabaseUrl);
      const selfieUrl = selfieFile?.supabaseUrl || null;

      // Pass to your verification controller
      await requestMobileUserVerification(req, res, {
        localIdPaths,
        localSelfie,
        idUrls,
        selfieUrl
      });
    } catch (err) {
      console.error('[MOBILE VERIFY] Upload or processing failed:', err.message);
      res.status(500).json({ error: 'Mobile verification upload failed' });
    }
  }
);






// ✅ OTP-Based Login Flow
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/mobile-user-login', mobileUserLogin);

// ✅ Admin & LGU Profiles
router.get('/super-admin-profile/:id', getAdminProfile);
router.get('/lgu-admin-profile/:id', getLGUProfile);

// ✅ Barangay Staff
router.post('/barangay-staff-login', barangayStaffLogin);
router.get('/barangay-staff-profile/:id', getBarangayProfile);

// GET user profile by ID (matches frontend)
router.get('/mobile-user-profile/:id', getMobileUserProfile);

// POST upload profile picture (matches frontend)
router.post(
  '/mobile-user-profile/:id/upload-picture',
  uploadWithSupabase([{ name: 'picture', maxCount: 1 }]),
  async (req, res) => {
    try {
      // The uploaded file info
      const profileFile = req.supabaseFiles.find(f => f.field === 'picture');

      if (!profileFile) {
        return res.status(400).json({ message: 'No picture uploaded.' });
      }

      const profileUrl = profileFile.supabaseUrl; // private signed URL
      const localPath = profileFile.localPath;    // local storage path (optional)

      // Call your existing controller to update DB
      await updateMobileUserProfilePicture(req, res, { profileUrl, localPath });

    } catch (err) {
      console.error('[UPLOAD PROFILE] Failed:', err.message);
      res.status(500).json({ message: 'Profile picture upload failed' });
    }
  }
);


router.put('/mobile-user-profile/:id/remove-picture', removeMobileUserProfilePicture);



module.exports = router;
