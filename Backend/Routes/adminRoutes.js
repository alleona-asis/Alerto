const express = require('express');
const router = express.Router();
const authenticateToken = require('../Middleware/auth');

// =================================================
//  MANAGE LOCAL GOVERNMENT UNIT
// =================================================
const {
  getPendingAccount,
  markAsRead,
  deleteNotification,
  updateLGUAccountStatus,
  getLGUAccounts,
  deleteLGUAccount,
  getTotalLGUAccounts
} = require('../Controller/ADMIN/lguAccessController')

// =============== PROTECTED ROUTES ================
router.use(authenticateToken);

// ========= GET ALL PENDING LGU ACCOUNTS ==========
router.get('/pending-accounts', getPendingAccount);

// ================= MARK AS READ ==================
router.put('/admin-accounts/:id/mark-read', markAsRead);

// =========== CLEANUP OLD NOTIFICATION ============
router.delete('/admin-accounts/:id', deleteNotification);

// ======= PUT STATUS UPDATE OF AN ACCOUNT =========
router.put('/status-account/:id', updateLGUAccountStatus);

// ============= GET ALL LGU ACCOUNTS ==============
router.get('/lgu-accounts', getLGUAccounts);

// ============== DELETE LGU ACCOUNT ===============
router.delete('/delete-account/:id', deleteLGUAccount);

router.get("/total-LGU-Accounts", getTotalLGUAccounts);



// =================================================
//  BARANGAY REPORTS
// =================================================
const {
  getBarangayReports,
  getAllPins,
  getTotalReports
} = require('../Controller/ADMIN/barangayReports')

// =============== GET ALL REPORTS =================
router.get('/admin-get-all-reports', getBarangayReports);

// ================ GET ALL PINS ===================
router.get('/admin-get-all-pins', getAllPins);

router.get("/total-barangay-reports", getTotalReports);


// =================================================
//  DOCUMENT REQUESTS
// =================================================

const {
  getDocumentRequests,
  getTotalRequests
} = require('../Controller/ADMIN/documentRequests')

// =============== GET ALL REPORTS =================
router.get('/admin-get-all-document-requests', getDocumentRequests);

router.get("/total-barangay-document-requests", getTotalRequests);


// =================================================
//  MOBILE USERS
// =================================================
const {
  getMobileUsers,
  deleteMobileUser,
  getTotalMobileUsers
} = require('../Controller/ADMIN/mobileUsers')

// =============== GET ALL MOBILE USERS =================
router.get('/admin-get-all-mobile-users', getMobileUsers);
router.delete("/delete-mobile-user/:id", deleteMobileUser);
router.get("/total-mobile-users", getTotalMobileUsers);

// =================================================
//  ANNOUNCEMENTS
// =================================================
const {
  getTotalAnnouncements,
  getAllAnnouncements
} = require('../Controller/ADMIN/Announcement')

// =============== GET ALL MOBILE USERS =================
router.get("/total-announcements", getTotalAnnouncements);
router.get('/get-all-announcements', getAllAnnouncements);


module.exports = router;
