const express = require('express');
const router = express.Router();
const authenticateToken = require('../Middleware/auth');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

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

router.post(
  "/mobile-user-profile/:userId/upload-id",
  upload.array("files", 2),
  processOCR
);

router.get('/mobile-user-registry', getAllMobileUsers);

router.delete('/delete-mobile-user/:id', deleteMobileUser);
router.patch('/update-mobile-user-status/:id', updateMobileUserStatus);

// =================================================
//  INCIDENT REPORTING
// =================================================
const {
    submitReport,
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

router.post(
  '/submit-incident-report',
  upload.array('media', 5), 
  submitReport
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
  proofUpload.array('proof', 5), 
  uploadProof
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
  deleteAnnouncement
} = require('../Controller/BARANGAY/announcements');

//Annoucemment
router.post(
  '/create-announcements',
  announcementUpload.array('images', 5),
  createAnnouncement
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
  officialUpload.single("image"),
  createOfficial
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



module.exports = router;
