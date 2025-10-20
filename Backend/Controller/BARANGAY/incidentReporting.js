const pool = require('../../PostgreSQL/database');
const path = require('path');
const fs = require('fs');
const { getIo } = require('../../socket');
const {supabase} = require('../../PostgreSQL/supabaseClient');


// =================================================
//  SUBMIT BARANGAY REPORT
// =================================================
const submitReport = async (req, res, { mediaUrls = [] }) => {
  try {

    const mobileUserId = req.body.mobile_user_id || req.user?.id;
    const deviceIdentifier = req.body.device_id;

    if (!mobileUserId) {
      return res.status(400).json({ message: "User ID missing" });
    }

    // ================== Handle Device ==================
    let deviceRow = null;
    if (deviceIdentifier) {
      const { rows: existingDevices } = await pool.query(
        `SELECT id FROM devices WHERE mobile_user_id = $1 AND device_id = $2`,
        [mobileUserId, deviceIdentifier]
      );

      if (existingDevices.length > 0) {
        deviceRow = existingDevices[0];
      } else {
        const { rows: newDevice } = await pool.query(
          `INSERT INTO devices (mobile_user_id, device_id) 
           VALUES ($1, $2) 
           RETURNING id`,
          [mobileUserId, deviceIdentifier]
        );
        deviceRow = newDevice[0];
      }
    }

    // ================== Blocking Checks ==================
    const { rows: users } = await pool.query(
      `SELECT invalid_count, blocked_until, permanently_blocked 
       FROM mobile_users 
       WHERE id = $1`,
      [mobileUserId]
    );
    if (users.length === 0) return res.status(404).json({ message: "User not found" });
    const user = users[0];
    const now = new Date();

    if (user.permanently_blocked) return res.status(403).json({ message: "❌ Permanently blocked." });

    if (user.blocked_until && new Date(user.blocked_until) > now) {
      return res.status(403).json({
        message: `Temporarily blocked until ${user.blocked_until}.`
      });
    }

    // ================== Extract Fields ==================
    const {
      latitude,
      longitude,
      barangay,
      city,
      province,
      region,
      category,
      incident_type,
      customIncident,
      incident_datetime,
      description,
      reported_person,
      agreed_privacy,
      first_name,
      last_name
    } = req.body;

    // =======================
    // Handle uploaded files
    // =======================

   const supabaseMedia = Array.isArray(req.supabaseFiles?.media)
        ? req.supabaseFiles.media
        : [];

      const media = supabaseMedia.map(f => ({
        filename: f.filename,
        url: f.supabaseUrl,  // signed URL
        mimetype: f.mimetype || (f.filename.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg')
      }));

      const mediaFilenames = media.map(m => m.filename);
      const mediaUrls = media.map(m => m.url);
    // =======================
    // Parse date & boolean
    // =======================
    const agreedPrivacyBool = agreed_privacy === true || agreed_privacy === 'true';

    let incidentDate = req.body.incident_date || null;
    let incidentTime = req.body.incident_time || null;

    let incidentDateTimeObj = null;

    if (incidentDate && incidentTime) {
      incidentDateTimeObj = new Date(`${incidentDate}T${incidentTime}`);
    } else if (incident_datetime) {
      incidentDateTimeObj = new Date(incident_datetime);
      incidentDate = incidentDateTimeObj.toISOString().split("T")[0];
      incidentTime = incidentDateTimeObj.toTimeString().split(" ")[0];
    } else {
      incidentDateTimeObj = new Date();
      incidentDate = incidentDateTimeObj.toISOString().split("T")[0];
      incidentTime = incidentDateTimeObj.toTimeString().split(" ")[0];
    }

    const reported_by = `${first_name || ''} ${last_name || ''}`.trim();

    const queryText = `
      INSERT INTO incident_reports 
      (latitude, longitude, barangay, city, province, region, category, incident_type, description, reported_person, reported_by, agreed_privacy, incident_datetime, incident_date, incident_time, media_filenames, media_urls, mobile_user_id, device_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, $18, $19)
      RETURNING *;
    `;

    const values = [
      latitude,
      longitude,
      barangay,
      city,
      province,
      region,
      category,
      incident_type ?? (customIncident || "other"),
      description,
      reported_person,
      reported_by,
      agreedPrivacyBool,
      incidentDateTimeObj,
      incidentDate,
      incidentTime,
      mediaFilenames.length > 0 ? mediaFilenames : null,
      mediaUrls.length > 0 ? mediaUrls : null,
      req.body.mobile_user_id || req.user?.id || null,
      deviceRow ? deviceRow.id : null
    ];

    const result = await pool.query(queryText, values);
    const savedReport = result.rows[0];

    if (mobileUserId) {
      try {
        await pool.query(
          `INSERT INTO notifications 
          (mobile_user_id, region, province, city, barangay, type, incident_type, is_read, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NOW())`,
          [
            mobileUserId,
            savedReport.region,
            savedReport.province,
            savedReport.city,
            savedReport.barangay,
            'newBarangayReport',
            savedReport.incident_type
          ]
        );

        console.log(`Notification created for mobile user ID ${mobileUserId}`);
      } catch (notifErr) {
        console.error('Failed to create notification:', notifErr.message);
      }
    } else {
      console.warn('No mobile_user_id provided; skipping notification creation.');
    }

    try {
      const io = getIo();
      io.emit('newBarangayReport', savedReport);
    } catch (err) {
      console.warn('Socket.io not initialized:', err.message);
    }

    res.status(201).json({
      message: "Report submitted successfully",
      report: savedReport
    });

  } catch (error) {
    console.error("Error submitting report:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


// =======================
// USER BLOCKING
// =======================
const userBlocking = async (user, id, io) => {
  const now = new Date();
  let statusChanged = false;

  console.log(`Checking block status for user ${user.id}`);
  console.log(`invalid_count: ${user.invalid_count}`);
  console.log(`permanently_blocked: ${user.permanently_blocked}`);
  console.log(`blocked_until: ${user.blocked_until}`);

  if (user.blocked_until && new Date(user.blocked_until) <= now) {
    await pool.query(
      `UPDATE mobile_users SET blocked_until = NULL WHERE id = $1`,
      [id]
    );
    user.blocked_until = null;
    statusChanged = true;
  }

  if (user.invalid_count >= 5 && !user.permanently_blocked) {
    await pool.query(
      `UPDATE mobile_users SET permanently_blocked = true, blocked_until = NULL WHERE id = $1`,
      [id]
    );
    user.permanently_blocked = true;
    user.blocked_until = null;
    statusChanged = true;
  }

  const blockMinutesLookup = { 2: 1, 3: 2, 4: 3 };
  const isCurrentlyBlocked =
    user.blocked_until && new Date(user.blocked_until) > now;

  const blockMinutes =
    !user.permanently_blocked && !isCurrentlyBlocked
      ? blockMinutesLookup[user.invalid_count] || 0
      : 0;

  if (blockMinutes > 0) {
    const newBlockedUntil = new Date(now.getTime() + blockMinutes * 60 * 1000);
    await pool.query(
      `UPDATE mobile_users SET blocked_until = $1 WHERE id = $2`,
      [newBlockedUntil, id]
    );
    user.blocked_until = newBlockedUntil;
    console.log(`Applied NEW temporary block for user ${user.id}: ${blockMinutes} minute(s). Unblock at: ${newBlockedUntil.toISOString()}`);
    statusChanged = true;
  } else if (isCurrentlyBlocked) {
    console.log(`User ${user.id} is STILL blocked until ${user.blocked_until}, no reset.`);
  } else {
    console.log(`No temporary block needed for user ${user.id}`);
  }

  if (statusChanged) {
    const blockingStatus = {
      userId: user.id,
      blocked_until: user.blocked_until,
      permanently_blocked: user.permanently_blocked,
      invalid_count: user.invalid_count,
      isTemporarilyBlocked: !!user.blocked_until,
    };

    console.log(
      `Emitting blocking status for user ${user.id}:`,
      blockingStatus
    );
    io.emit("blockingStatusUpdated", blockingStatus);
  }
};


// =================================================
//  GET ALL BARANGAY PINS
// =================================================
const getAllPins = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM incident_reports');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching pins:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// =================================================
//  GET ALL BARANGAY REPORT FOR MOBILE
// =================================================
const getBarangayReportsForMobile = async (req, res) => {
  try {
    const { rows: reports } = await pool.query(
      `SELECT id, latitude, longitude, incident_type, status,
              incident_date, incident_time, barangay, city, province,
              updated_by, updated_at, status_history
       FROM incident_reports
       ORDER BY incident_date DESC`
    );

    res.status(200).json(reports);
  } catch (error) {
    console.error("Error fetching incident reports:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// =================================================
//  GET ALL BARANGAY REPORT FOR WEB
// =================================================
const getBarangayReports = async (req, res) => {
  try {
    const { province, region, city, barangay } = req.query;

    if (!province || !region || !city || !barangay) {
      return res.status(400).json({ message: "User location not found" });
    }

    const { rows: reports } = await pool.query(
      `SELECT *
       FROM incident_reports
       WHERE province = $1
         AND region = $2
         AND city = $3
         AND barangay = $4
       ORDER BY incident_date DESC`,
      [province, region, city, barangay]
    );

    res.status(200).json(reports);
  } catch (error) {
    console.error("Error fetching incident reports:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// =================================================
//  BARANGAY WEB DASHBOARD
// =================================================
const getReportsByLocation = async (req, res) => {
  try {
    const { city, province, barangay } = req.query;

    const result = await pool.query(
      'SELECT * FROM incident_reports WHERE city = $1 AND province = $2 AND barangay = $3',
      [city, province, barangay]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching pins:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// =================================================
//  UPDATE REPORT STATUS
// =================================================
const updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updatedBy = req.user?.first_name && req.user?.last_name
      ? `${req.user.first_name} ${req.user.last_name}`
      : (req.body.first_name && req.body.last_name
          ? `${req.body.first_name} ${req.body.last_name}`
          : "Unknown");

    if (!id || !status) {
      return res.status(400).json({ message: "Missing report ID or status" });
    }

    const allowedStatuses = [
      "pending",
      "under review",
      "in progress",
      "resolved",
      "invalid",
      "escalated",
      "transferred",
    ];

    if (!allowedStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const { rows } = await pool.query(
      `SELECT status_history FROM incident_reports WHERE id = $1`,
      [id]
    );
    const currentHistory = rows[0]?.status_history || [];

    const newHistoryItem = {
      label: status.toLowerCase(),
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    };
    const updatedHistory = [...currentHistory, newHistoryItem];

    const updateResult = await pool.query(
      `UPDATE incident_reports
       SET status = $1,
           updated_by = $2,
           updated_at = NOW(),
           status_history = $3::jsonb
       WHERE id = $4
       RETURNING *`,
      [status.toLowerCase(), updatedBy, JSON.stringify(updatedHistory), id]
    );

    const updatedReport = updateResult.rows[0];

    // Increment invalid_count if status is invalid
    if (status.toLowerCase() === "invalid" && updatedReport.mobile_user_id) {
      const { rows: userRows } = await pool.query(
        `UPDATE mobile_users 
        SET invalid_count = invalid_count + 1 
        WHERE id=$1 
        RETURNING id, invalid_count, blocked_until, permanently_blocked`,
        [updatedReport.mobile_user_id]
      );

      const user = userRows[0];
      const io = getIo();

      await userBlocking(user, updatedReport.mobile_user_id, io);
    }

    const notificationQuery = `
      INSERT INTO mobile_notifications
        (mobile_user_id, type, status)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const notificationValues = [
      updatedReport.mobile_user_id,
      'barangay_report_status',
      status.toLowerCase(),
    ];

    let notification = null;
    try {
      const notificationResult = await pool.query(
        notificationQuery,
        notificationValues
      );
      notification = notificationResult.rows[0];
      console.log("Notification saved successfully:", notification);
    } catch (err) {
      console.error("Failed to save notification:", err);
    }


// after you compute updatedReport and (optionally) save notification
const io = getIo();

// optional: keep a dedicated channel for the inbox feed
if (notification) {
  io.to(`user_${updatedReport.mobile_user_id}`).emit('notification', {
    ...notification,
    type: 'barangay_report_status',
  });
}

// ✅ send the actual report update for the UI list/modal
io.to(`user_${updatedReport.mobile_user_id}`).emit('reportStatusUpdate', {
  id: updatedReport.id,                 // the client accepts id OR reportId
  reportId: updatedReport.id,
  status: updatedReport.status,
  status_history: updatedReport.status_history,
  updated_by: updatedReport.updated_by,
  updated_at: updatedReport.updated_at,
});


    res.status(200).json({
      message: "Status updated successfully",
      report: updatedReport,
    });

  } catch (error) {
    console.error("[updateReportStatus] Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// ==========================
// PROOF UPLOAD BASE URL
// ==========================
// const LAN_IP = process.env.LAN_IP || "192.168.1.2"; 
 const PORT = process.env.PORT || 5000;
// const BASE_URL = `http://${LAN_IP}:${PORT}/uploads/proof`;

/* 
// In production, we should use the server's domain or public IP instead of LAN IP
// const HOST = process.env.HOST || 'yourdomain.com';
// const BASE_URL = process.env.NODE_ENV === 'production'
//   ? `https://${HOST}/uploads/proof`
//   : `http://${LAN_IP}:${PORT}/uploads/proof`;
*/

const uploadProof = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "Missing report ID" });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const uploadedFiles = req.files;
    //console.log("Files received:", uploadedFiles);
    //console.log("Number of files to upload:", uploadedFiles.length);

    const proofFiles = uploadedFiles.map(file => {
      const uploadsDir = "uploads/proof";
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

      const filePath = file.path;
      const url = `${BASE_URL}/${file.filename}`;
      console.log("File ready for DB:", { name: file.originalname, path: filePath, url });

      return {
        filename: file.originalname,
        path: filePath,
        url,
        type: file.mimetype.startsWith("image") ? "image" : "video",
      };
    });

    const { rows } = await pool.query(
      `SELECT proof_files FROM incident_reports WHERE id = $1`,
      [id]
    );
    const currentProofs = rows[0]?.proof_files || [];

    const updatedProofs = [...currentProofs, ...proofFiles];

    const updateResult = await pool.query(
      `UPDATE incident_reports
       SET proof_files = $1::jsonb,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(updatedProofs), id]
    );

    const updatedReport = updateResult.rows[0];

    // Emit via Socket.io
    const io = getIo();
    io.emit("proofUploaded", {
      reportId: updatedReport.id,
      proof_files: updatedReport.proof_files,
    });

    res.status(200).json({
      message: "Proof uploaded successfully",
      report: updatedReport,
    });
  } catch (error) {
    console.error("[uploadProof] Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// ==========================
// TRANSFER REPORT
// ==========================
const transferReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { newBarangay } = req.body;

    if (!id || !newBarangay) {
      return res.status(400).json({ message: "Missing report ID or target barangay" });
    }

    const updatedBy = req.user?.first_name && req.user?.last_name
      ? `${req.user.first_name} ${req.user.last_name}`
      : "Unknown";

    const { rows } = await pool.query(
      `SELECT barangay, status_history FROM incident_reports WHERE id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Report not found" });
    }

    const report = rows[0];
    console.log(`Report ID ${id} is currently in barangay: ${report.barangay}`);

    const newHistoryItem = {
      label: "transferred",
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
      from_barangay: report.barangay,
      to_barangay: newBarangay,
    };

    const updatedHistory = [...(report.status_history || []), newHistoryItem];

    console.log(`Report ID ${id} transferred from ${report.barangay} to ${newBarangay} by ${updatedBy}`);

    const updateResult = await pool.query(
      `UPDATE incident_reports
       SET barangay = $1,
           status = 'transferred',
           updated_by = $2,
           updated_at = NOW(),
           status_history = $3::jsonb
       WHERE id = $4
       RETURNING *`,
      [newBarangay, updatedBy, JSON.stringify(updatedHistory), id]
    );

    const updatedReport = updateResult.rows[0];

    const notificationQuery = `
      INSERT INTO mobile_notifications
        (mobile_user_id, type, status)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const notificationValues = [
      updatedReport.mobile_user_id,
      'barangay_report_status',
      'transferred',
    ];

    let notification = null;
    try {
      const notificationResult = await pool.query(
        notificationQuery,
        notificationValues
      );
      notification = notificationResult.rows[0];
      console.log("Notification saved successfully:", notification);
    } catch (err) {
      console.error("Failed to save notification:", err);
    }

    // --- Emit notification ONLY to the mobile user ---
    if (notification) {
      const io = getIo();
      io.to(`user_${updatedReport.mobile_user_id}`).emit(
        "reportStatusUpdate",
        {
          ...notification,
          type: "barangay_report_status",
        }
      );
    }

    res.status(200).json({
      message: `Report successfully transferred to ${newBarangay}`,
      report: updatedReport
    });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// =================================================
//  DELETE INCIDENT REPORT
// =================================================
const deleteIncidentReport = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  try {
    const deleteResult = await pool.query(
      'DELETE FROM incident_reports WHERE id = $1 RETURNING *',
      [id]
    );

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'Report deleted successfully', user: deleteResult.rows[0] });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
};

// =================================================
//  BLOCK EXCESSIVE REPORTING
// =================================================
const getBarangayReportById = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!userId) {
      return res.status(400).json({ error: "User ID missing" });
    }

    console.log("Fetching reports for userId:", userId);

    const query = `
      SELECT *
      FROM incident_reports
      WHERE mobile_user_id = $1
      ORDER BY incident_date DESC
    `;
    const result = await pool.query(query, [userId]);

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching user reports:", err);
    res.status(500).json({ error: "Server error" });
  }
};


// =================================================
//  USER BLOCKING STATUS
// =================================================
const getUserBlockingStatus = async (userId) => {
  try {
    const result = await pool.query(
      `SELECT invalid_count, blocked_until, permanently_blocked 
       FROM mobile_users 
       WHERE id = $1`,
      [userId]
    );
    if (result.rows.length > 0) {
      return result.rows[0];  // Return { invalid_count, blocked_until, permanently_blocked }
    } else {
      return null; 
    }
  } catch (error) {
    console.error('Error fetching user blocking status:', error);
    throw error; 
  }
};



module.exports = {
  submitReport,
  userBlocking,
  getAllPins,
  getBarangayReports,
  getBarangayReportsForMobile,
  getReportsByLocation,
  deleteIncidentReport,
  updateReportStatus,
  uploadProof,
  transferReport,
  getBarangayReportById,
  getUserBlockingStatus,
};