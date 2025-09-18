const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const Authentication = require('../Middleware/auth');

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
router.post('/ocr', upload.single('image'), processOCR);

// ✅ LGU Admin Registration
router.post(
  '/register-lgu-admin',
  upload.fields([
    { name: 'idFile', maxCount: 1 },
    { name: 'intentFile', maxCount: 1 }
  ]),
  registerLguAdmin
);

// ✅ Admin Login
router.post('/login-admin', adminLogin);

// ✅ Mobile User Registration
router.post('/mobile-user-registration', mobileUserSignUp);


// Mobile User Verification with multer for ID images and selfie
router.post(
  '/mobile-users/verify',
  Authentication, // <-- make sure this is your JWT middleware
  upload.fields([
    { name: 'idImage', maxCount: 2 },  // front & back in same field
    { name: 'selfieTaken', maxCount: 1 }
  ]),
  requestMobileUserVerification
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
router.post('/mobile-user-profile/:id/upload-picture', upload.single('picture'), updateMobileUserProfilePicture);

router.put('/mobile-user-profile/:id/remove-picture', removeMobileUserProfilePicture);



module.exports = router;
