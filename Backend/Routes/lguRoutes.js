const express = require('express');
const router = express.Router();
const authenticateToken = require('../Middleware/auth');
const path = require('path');
const fs = require('fs');
const multer = require('multer'); 

// =================================================
// MANAGE BARANGAY 
// =================================================
const {
  addBarangay,
  getAllBarangays,
  deleteBarangay,
  addBarangayUserAccount,
  viewCreatedBarangayAccounts,
  editBarangayDetails,
  callBarangayAssistance
} = require('../Controller/LGU/manageBarangayController')

// =================================================
// LGU FEEDBACKS
// =================================================
const { 
  submitLGUFeedback, 
  getAllLGUFeedback 
} = require('../Controller/LGU/supportHelp')

// =================================================
// MULTER SETUP FOR LGU FEEDBACK
// =================================================
const feedbackStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const folder = 'uploads/feedback';
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const feedbackFileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/jpg',
    'video/mp4', 'video/quicktime', 'video/mov'
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and videos are allowed.'));
  }
};

const feedbackUpload = multer({
  storage: feedbackStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: feedbackFileFilter
});

// =============== PROTECTED ROUTES ================
router.use(authenticateToken);

// ================= ADD BARANGAY ==================
router.post('/add-barangay', addBarangay);

// =============== GET ALL BARANGAY ================
router.get('/all-barangays-by-location', getAllBarangays);

// =============== GET ALL BARANGAY ================
router.delete('/delete-barangay/:id', deleteBarangay);

// ========== ADD BARANGAY USER ACCOUNT ============
router.post('/add-barangay-account', addBarangayUserAccount);

// ============= VIEW CREATED ACCOUNT ==============
router.get('/view-created-account/:lguId/:barangay', viewCreatedBarangayAccounts);

router.put('/update-barangay/:id', editBarangayDetails);

// Case 2: Fetch by location (using POST with body data)
router.post("/call", callBarangayAssistance);


// ============= LGU FEEDBACK ==============
router.post(
  '/submit-feedback',
  feedbackUpload.array('files', 5), // max 5 items (images + video)
  submitLGUFeedback
);

// GET all LGU feedback
router.get('/all-feedback', getAllLGUFeedback);






// =================================================
//  BARANGAY REPORTS
// =================================================
const { 
  getAllPins, 
  getBarangayReports,
  getTotalReports
} = require('../Controller/LGU/barangayReports')

// =============== GET ALL REPORTS =================
router.get('/lgu-get-all-reports', getBarangayReports);

// ================ GET ALL PINS ===================
router.get('/lgu-get-all-pins', getAllPins);

// ================ GET TOTAL ===================
router.get('/get-all-barangay-reports', getTotalReports);


// =================================================
//  DOCUMENT REQUESTS
// =================================================
const {  
  getDocumentRequests,
  deleteDocumentRequest
} = require('../Controller/LGU/documentRequests')

// =============== GET ALL REQUESTS ================
router.get('/lgu-get-all-document-requests', getDocumentRequests);

// =============== DELETE REQUESTS =================
router.delete("/document-requests/:id", deleteDocumentRequest);

// =================================================
//  DOCUMENT REQUESTS
// =================================================
const {  
  getTotalMobileUsers,
} = require('../Controller/LGU/mobileUsers', )

// =============== GET ALL REQUESTS ================
router.get('/total-mobile-users', getTotalMobileUsers);



module.exports = router;