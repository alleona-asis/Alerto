// Routes/authRoutes.js
const express = require('express');
const router = express.Router();

const Authentication = require('../Middleware/auth');         
const { uploadWithSupabase } = require('../Middleware/upload'); 

const {
  mobileUserSignUp,
  requestMobileUserVerification,
  sendOTP,
  verifyOTP,
  mobileUserLogin,
  registerLguAdmin,
  adminLogin,
  checkUsernameAvailability,
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

// ============ LGU ADMIN REGISTRATION =============
router.post(
  '/register-lgu-admin',
  uploadWithSupabase([
    { name: 'idFile', maxCount: 1 },
    { name: 'intentFile', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const idFile = req.supabaseFiles.idFile?.[0];
      const intentFile = req.supabaseFiles.intentFile?.[0];

      await registerLguAdmin(req, res, {
        idFileUrl: idFile?.supabaseUrl || null,
        intentFileUrl: intentFile?.supabaseUrl || null,
        idFilePath: idFile?.relativePath || null,
        intentFilePath: intentFile?.relativePath || null,
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

// ================ BARANGAY STAFF LOGIN ===========
router.post('/barangay-staff-login', barangayStaffLogin);

// =========== MOBILE USER VERIFICATION ============
router.post(
  '/mobile-users/verify',
  Authentication,
  uploadWithSupabase([
    { name: 'idImage', maxCount: 2 },    
    { name: 'selfieTaken', maxCount: 1 } 
  ]),
  async (req, res) => {
    try {
      const idImages = (req.supabaseFiles?.idImage || []);
      const selfie   = (req.supabaseFiles?.selfieTaken || [])[0] || null;

      console.log('[VERIFY] received fields', {
        civil_status: req.body?.civil_status,
        sex: req.body?.sex,
        home_address: req.body?.home_address,
        id_type: req.body?.id_type
      });
      console.log('[VERIFY] received files', {
        idImageCount: idImages.length,
        hasSelfie: !!selfie
      });

      const idFront = idImages[0] || null;
      const idBack  = idImages[1] || null;

      req._verifyFiles = { idFront, idBack, selfie };
      await requestMobileUserVerification(req, res);
    } catch (err) {
      console.error('[VERIFY] handler failed:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Mobile verification upload failed' });
    }
  }
);

// OTP-Based Login Flow
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/mobile-user-login', mobileUserLogin);

// ================ USER PROFILES ==================
router.get('/super-admin-profile/:id', getAdminProfile);
router.get('/lgu-admin-profile/:id', getLGUProfile);
router.get('/barangay-staff-profile/:id', getBarangayProfile);
router.get('/mobile-user-profile/:id', getMobileUserProfile);

// ======== UPDATE / REMOVE PROFILE PICTURE =========
router.post(
  '/mobile-user-profile/:id/upload-picture',
  uploadWithSupabase([{ name: 'picture', maxCount: 1 }]),
  async (req, res) => {
    try {
      const file = req.supabaseFiles.picture?.[0];
      if (!file?.relativePath || !file?.supabaseUrl) {
        return res.status(400).json({ message: 'No picture uploaded.' });
      }
      await updateMobileUserProfilePicture(req, res, {
        profile_picture_url: file.supabaseUrl,
        profile_picture_path: file.relativePath,
      });
    } catch (err) {
      console.error('[UPLOAD PROFILE] Failed:', err.message);
      res.status(500).json({ message: 'Profile picture upload failed' });
    }
  }
);

router.put('/mobile-user-profile/:id/remove-picture', removeMobileUserProfilePicture);

module.exports = router;
