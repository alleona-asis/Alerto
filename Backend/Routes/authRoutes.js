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

// ================ CHECK USERNAME =================
router.post('/check-username', checkUsernameAvailability);

// ================ OCR PROCESSING =================
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

// ============ LGU ADMIN REGISTRATION =============
router.post(
  '/register-lgu-admin',
  uploadWithSupabase([
    { name: 'idFile', maxCount: 1 },
    { name: 'intentFile', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      // Access Supabase URLs
      const idFileUrl = req.supabaseFiles.idFile?.[0]?.supabaseUrl || null;
      const intentFileUrl = req.supabaseFiles.intentFile?.[0]?.supabaseUrl || null;


      // Optional: access local paths too
      // const localId = req.supabaseFiles.idFile?.[0]?.localPath || null;
      // const localIntent = req.supabaseFiles.intentFile?.[0]?.localPath || null;

      // IMPORTANT: Also pass file paths (relative paths in Supabase bucket)
      // You need to modify your uploadWithSupabase middleware to also store relativePath:
      // Add relativePath to req.supabaseFiles[field.name].push({ relativePath, supabaseUrl, isPublic })
      const idFilePath = req.supabaseFiles.idFile?.[0]?.relativePath || null;
      const intentFilePath = req.supabaseFiles.intentFile?.[0]?.relativePath || null;


      await registerLguAdmin(req, res, {
        idFileUrl,
        intentFileUrl,
        idFilePath,
        intentFilePath
      });
    } catch (err) {
      console.error('[LGU REGISTER] Upload failed:', err.message);
      res.status(500).json({ error: 'File upload failed' });
    }
  }
);


// ================== ADMIN LOGIN ==================
router.post('/login-admin', adminLogin);

// =========== MOBILE USER REGISTRATION ============
router.post('/mobile-user-registration', mobileUserSignUp);

// ================ BARANGAY STAFF LOGIN ==================
router.post('/barangay-staff-login', barangayStaffLogin);

// =========== MOBILE USER VERIFICATION ============
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

// ================ USER PROFILES ==================
router.get('/super-admin-profile/:id', getAdminProfile);
router.get('/lgu-admin-profile/:id', getLGUProfile);
router.get('/barangay-staff-profile/:id', getBarangayProfile);
router.get('/mobile-user-profile/:id', getMobileUserProfile);

// ======== UPDATE OR ADD PROFILE PICTURE ===========
router.post(
  '/mobile-user-profile/:id/upload-picture',
  uploadWithSupabase([{ name: 'picture', maxCount: 1 }]),
  async (req, res) => {
    try {
      const file = req.supabaseFiles.picture?.[0];
      if (!file?.relativePath || !file?.supabaseUrl) {
        return res.status(400).json({ message: 'No picture uploaded.' });
      }

      // picture is in PUBLIC bucket per your middleware; supabaseUrl is a public URL
      const profile_picture_url = file.supabaseUrl;
      const profile_picture_path = file.relativePath; // stable key stored in DB

      // Call the new controller (it will send the final JSON response)
      await updateMobileUserProfilePicture(req, res, {
        profile_picture_url,
        profile_picture_path
      });

    } catch (err) {
      console.error('[UPLOAD PROFILE] Failed:', err.message);
      res.status(500).json({ message: 'Profile picture upload failed' });
    }
  }
);


router.put('/mobile-user-profile/:id/remove-picture', removeMobileUserProfilePicture);


module.exports = router;
