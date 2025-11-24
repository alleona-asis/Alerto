const express = require('express');
const router = express.Router();
const authenticateToken = require('../Middleware/auth');
const path = require('path');
const fs = require('fs');
const multer = require('multer'); 
const { uploadWithSupabase } = require('../Middleware/upload');


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
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: feedbackFileFilter
});


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
  callBarangayAssistance,
  deleteBarangayAccount
} = require('../Controller/LGU/manageBarangayController')

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

// ========== DELETE BARANGAY USER ACCOUNT ============
router.delete('/delete-barangay-account/:id', deleteBarangayAccount);

// ============= VIEW CREATED ACCOUNT ==============
router.get('/view-created-account/:lguId/:barangay', viewCreatedBarangayAccounts);

// ============= EDIT BARANGAY DETAILS =============
router.put('/update-barangay/:id', editBarangayDetails);

// ================ CALL ASSISTANCE ================
router.post("/call", callBarangayAssistance);



// =================================================
// LGU FEEDBACKS
// =================================================
const { 
  submitLGUFeedback, 
  getAllLGUFeedback,
  deleteLGUFeedback
} = require('../Controller/LGU/supportHelp')


// ============= SUBMIT LGU FEEDBACK ===============
router.post(
  '/submit-feedback',

  // Debug: confirm multipart on device
  (req, res, next) => {
    console.log('[LGU FEEDBACK] CT:', req.headers['content-type']);
    next();
  },

  authenticateToken,

  // Accept up to 5 files under "files" but do not require them
  uploadWithSupabase([{ name: 'files', maxCount: 5 }]),

  async (req, res) => {
    try {
      console.log('[UPLOAD FEEDBACK] Starting submission');

      // Supabase middleware: req.supabaseFiles = { files: [ ... ] } (or undefined)
      const list = Array.isArray(req.supabaseFiles?.files) ? req.supabaseFiles.files : [];

      const images = [];
      let video = null;

      for (const f of list) {
        const mime = String(f.mimetype || '').toLowerCase();
        const entry = {
          path: f.relativePath || '',
          type: mime,
          name: f.filename || undefined,
        };
        if (mime.startsWith('image/')) images.push(entry);
        else if (mime.startsWith('video/')) video = entry;
      }

      // Make files available to the controller
      req.lguFiles = { images, video };

      // Also provide simple URL list as a fallback path
      const fileUrls = list.map(f => f.relativePath || '');
      console.log('[UPLOAD FEEDBACK] Files:', { count: list.length });
      if (fileUrls.length) console.log('[UPLOAD FEEDBACK] File URLs:', fileUrls);

      await submitLGUFeedback(req, res, { fileUrls });

    } catch (err) {
      console.error('[FEEDBACK UPLOAD] Failed:', err?.message, err?.stack);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Feedback upload failed', details: err?.message });
      }
    }
  }
);

// ============= GET ALL LGU FEEDBACK ==============
router.get('/all-feedback', getAllLGUFeedback);

router.delete('/feedback/:id', deleteLGUFeedback);



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

// ================= GET TOTAL =====================
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
//  MOBILE USERS
// =================================================
const {  
  getTotalMobileUsers,
  getMobileUsers,
  deleteMobileUser
} = require('../Controller/LGU/mobileUsers', )


router.get('/total-mobile-users', getTotalMobileUsers);
router.get('/get-lgu-mobile-users', getMobileUsers);
router.delete('/delete-mobile-user/:id', deleteMobileUser);



module.exports = router;