const express = require('express');
const router = express.Router();
const authenticateToken = require('../Middleware/auth');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { uploadWithSupabase } = require('../Middleware/upload');

// =================================================
// MULTER SETUP FOR REPORTS
// =================================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const folder = 'uploads/reports';
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'video/mp4', 'video/quicktime', 'video/mov'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and videos are allowed.'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter
});


// =================================================
// MULTER SETUP FOR ANNOUNCEMENTS
// =================================================
const announcementStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const folder = 'uploads/announcements';
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const announcementFileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images are allowed.'));
  }
};

const announcementUpload = multer({
  storage: announcementStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: announcementFileFilter
});


// =================================================
// MULTER SETUP FOR PROOF UPLOAD
// =================================================
// Multer setup for proof uploads
const proofStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const folder = 'uploads/proof';
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const proofFileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'video/mp4', 'video/quicktime', 'video/mov'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and videos are allowed.'));
  }
};

const proofUpload = multer({
  storage: proofStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: proofFileFilter
});

// =================================================
// MULTER SETUP FOR OFFICIALS PROFILE PICTURE
// =================================================
// Storage
const officialStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const folder = "uploads/officials";
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter
const officialFileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only images are allowed."));
  }
};

// Upload config
const officialUpload = multer({
  storage: officialStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: officialFileFilter
});


// =================================================
//  MOBILE USER REGISTRY
// =================================================
const {
    processOCR,
    getAllMobileUsers,
    deleteMobileUser,
    updateMobileUserStatus,
    markAsRead,
    getNotificationsByLocation,
    deleteNotification,
    getMobileUserNotifications,
    markMobileNotificationAsRead
} = require('../Controller/BARANGAY/mobileUserRegistry');

router.use(authenticateToken);

// POST upload front/back ID for mobile user
router.post(
  '/mobile-user-profile/:userId/upload-id',
  uploadWithSupabase([{ name: 'files', maxCount: 2 }]), // max 2 files (front/back)
  async (req, res) => {
    try {
      const uploadedFiles = req.supabaseFiles.filter(f => f.field === 'files');

      if (uploadedFiles.length === 0) {
        return res.status(400).json({ message: 'No ID files uploaded.' });
      }

      // Get Supabase URLs for processing (OCR, DB, etc.)
      const idUrls = uploadedFiles.map(f => f.supabaseUrl);

      // Call your existing OCR processor
      await processOCR(req, res, { idUrls });

    } catch (err) {
      console.error('[UPLOAD ID] Failed:', err.message);
      res.status(500).json({ message: 'ID upload failed' });
    }
  }
);

router.get('/mobile-user-registry', getAllMobileUsers);

router.delete('/delete-mobile-user/:id', deleteMobileUser);
router.patch('/update-mobile-user-status/:id', updateMobileUserStatus);
router.put('/notifications/:id/mark-read', markAsRead);
router.get('/notifications', getNotificationsByLocation);
router.delete('/notifications/:id', deleteNotification);
router.get('/mobile-notifications/:userId', getMobileUserNotifications);
router.patch('/notifications/:notificationId/read', markMobileNotificationAsRead);
// =================================================
//  INCIDENT REPORTING
// =================================================
const {
    submitReport,
    userBlocking,
    getAllPins,
    getBarangayReports,
    getBarangayReportsForMobile,

    // Web
    getReportsByLocation,
    deleteIncidentReport,
    updateReportStatus,
    uploadProof,
    transferReport,
    getBarangayReportById
} = require('../Controller/BARANGAY/incidentReporting');

// Mobile
router.post(
  '/submit-incident-report',
  uploadWithSupabase([{ name: 'media', maxCount: 5 }]), // handle up to 5 media files
  async (req, res) => {
    try {
      const uploadedFiles = req.supabaseFiles.filter(f => f.field === 'media');

      if (uploadedFiles.length === 0) {
        return res.status(400).json({ message: 'No media files uploaded.' });
      }

      // Get Supabase private URLs (signed URLs for sensitive incident reports)
      const mediaUrls = uploadedFiles.map(f => f.supabaseUrl);

      // Call your existing report handler, passing mediaUrls
      await submitReport(req, res, { mediaUrls });

    } catch (err) {
      console.error('[INCIDENT REPORT UPLOAD] Failed:', err.message);
      res.status(500).json({ message: 'Incident report upload failed' });
    }
  }
);


router.get('/all-report-pins', getAllPins);

router.get('/barangay-get-all-reports', authenticateToken, getBarangayReports);
router.get('/all-barangay-reports', authenticateToken, getBarangayReportsForMobile);

// GET proof files for a report
//router.get('/proof-files-report/:id', fetchProofFilesBackend);




// Blockings
router.get('/reports/:id', getBarangayReportById);

//Web
router.get('/barangay-incident-reports', getReportsByLocation);
router.delete('/barangay-delete-incident-report/:id', deleteIncidentReport);
router.patch('/update-barangay-report-status/:id', updateReportStatus);


router.post(
  '/upload-proof/:id',
  authenticateToken,
  uploadWithSupabase([{ name: 'proof', maxCount: 5 }]), // private by default
  async (req, res) => {
    try {
      const uploadedFiles = req.supabaseFiles.filter(f => f.field === 'proof');

      if (uploadedFiles.length === 0) {
        return res.status(400).json({ message: 'No proof files uploaded.' });
      }

      const proofUrls = uploadedFiles.map(f => f.supabaseUrl);

      await uploadProof(req, res, { proofUrls });
    } catch (err) {
      console.error('[UPLOAD PROOF] Failed:', err.message);
      res.status(500).json({ message: 'Proof upload failed' });
    }
  }
);

router.patch('/transfer-report/:id', transferReport);

// =================================================
//  DOCUMENT REQUEST
// =================================================
const {
  createDocumentRequest,
  getRequestsByUserId,
  getRequestsByLocation,
  updateDocumentRequestStatus,
  rejectDocumentRequest,
} = require('../Controller/BARANGAY/documentRequest');

// document request
router.post('/submit-document-request', createDocumentRequest);
router.get('/my-document-request/:id', getRequestsByUserId);
router.get('/barangay-document-requests', getRequestsByLocation);
router.patch('/update-document-request-status/:id', updateDocumentRequestStatus);
router.patch('/reject-document-request/:requestId', rejectDocumentRequest);


// =================================================
//  ANNOUNCEMENTS
// =================================================
const {
  createAnnouncement,
  getAnnouncements,
  getAnnouncementByUserLocation,
  followOtherBarangay,
  toggleLikeAnnouncement,
  getAnnouncementLikes,
  addComment,
  getComments,
  deleteComment,
  createOfficial,
  getOfficials,
  deleteOfficial,
  getBarangayOfficialsForMobile,
  unfollowBarangay,
  deleteAnnouncement,
  sendAlert,
} = require('../Controller/BARANGAY/announcements');

// Announcements (always public bucket)
router.post(
  '/create-announcements',
  uploadWithSupabase([{ name: 'images', maxCount: 5 }], true),
  async (req, res) => {
    try {
      console.log('Files received:', req.files);
      console.log('Supabase files:', req.supabaseFiles);
      await createAnnouncement(req, res);
    } catch (err) {
      console.error('[CREATE ANNOUNCEMENT ROUTE ERROR]:', err.stack || err.message || err);
      res.status(500).json({ message: 'Announcement creation failed', error: err.message });
    }
  }
);

router.delete("/delete-announcement/:id", authenticateToken, deleteAnnouncement);

router.get('/get-announcements', getAnnouncements);

//mobile
router.get('/get-announcements-by-location/:id', getAnnouncementByUserLocation);

router.post('/follow-other-barangay', followOtherBarangay);

// Likes
router.post('/like-announcement', toggleLikeAnnouncement);
router.get('/get-announcement-likes/:announcementId/:userId', getAnnouncementLikes);

// Comments
router.post('/add-comment', addComment);
router.get('/get-comments/:announcementId', getComments);
router.delete('/delete-comment', deleteComment);

// Barangay Officials
router.post(
  "/create-official",
  uploadWithSupabase([{ name: "image", maxCount: 1 }]), // private by default
  async (req, res) => {
    try {
      const uploadedFiles = req.supabaseFiles.filter(f => f.field === "image");

      if (uploadedFiles.length === 0) {
        return res.status(400).json({ message: "No official image uploaded." });
      }

      // Get the signed URL from Supabase
      const imageUrl = uploadedFiles[0].supabaseUrl;

      // Pass imageUrl into your controller
      await createOfficial(req, res, { imageUrl });
    } catch (err) {
      console.error("[OFFICIAL UPLOAD] Failed:", err.message);
      res.status(500).json({ message: "Official upload failed" });
    }
  }
);

router.get("/get-officials", getOfficials);

// Using DELETE method
router.delete("/delete-official/:id", deleteOfficial);




// ================= GET ALL MOBILE USERS BY LOCATION ==================



// Get all notifications
router.get('/notifications', getNotificationsByLocation);

// ================= DELETE NOTIFICATION ==================
router.delete('/notifications/:id', deleteNotification);


// ================= MARK AS READ ==================
router.put('/notifications/:id/mark-read', markAsRead);










router.get('/mobile-notifications/:userId', getMobileUserNotifications);

router.patch('/notifications/:notificationId/read', markMobileNotificationAsRead);





// =================================================
router.get('/officials/mobile', getBarangayOfficialsForMobile);


router.post('/unfollow-barangay', unfollowBarangay);

// Send Alert
router.post('/send-alert', authenticateToken, sendAlert);


// =================================================
//  BLOCKING RULE
// =================================================
router.post('/user-blocking/apply', async (req, res) => {
  const { userId, invalidCount } = req.body;

  if (!userId || invalidCount == null) {
    return res.status(400).json({ message: "Missing userId or invalidCount" });
  }

  try {
    const result = await applyBlockingRules(userId, invalidCount);
    res.json({
      message: "Blocking rules applied successfully",
      userId,
      ...result
    });
  } catch (err) {
    console.error("Error applying blocking rules:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});


module.exports = router;
