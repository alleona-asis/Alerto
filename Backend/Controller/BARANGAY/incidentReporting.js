const pool = require('../../PostgreSQL/database');
const path = require('path');
const fs = require('fs');
const { getIo } = require('../../socket');

// ================= Submit Incident Report =================
const submitReport = async (req, res) => {
  try {
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
    const uploadedFiles = req.files || [];
    const BASE_URL = process.env.BASE_URL || "http://localhost:5000"; 

    const media = uploadedFiles.map(file => ({
      filename: file.filename,
      url: `${BASE_URL}/uploads/reports/${file.filename}`,
      mimetype: file.mimetype
    }));

    const mediaFilenames = media.map(m => m.filename);
    const mediaUrls = media.map(m => m.url);

    // =======================
    // Parse date & boolean
    // =======================
    //const incidentDateTimeObj = incident_datetime ? new Date(incident_datetime) : new Date();
    //const agreedPrivacyBool = agreed_privacy === true || agreed_privacy === 'true';

    // Extract separate date and time
    //const incidentDate = incidentDateTimeObj.toISOString().split("T")[0]; // "YYYY-MM-DD"
    //const incidentTime = incidentDateTimeObj.toTimeString().split(" ")[0]; // "HH:MM:SS"

// =======================
// Parse date & boolean
// =======================
const agreedPrivacyBool = agreed_privacy === true || agreed_privacy === 'true';

// Prefer frontend values if available
let incidentDate = req.body.incident_date || null;
let incidentTime = req.body.incident_time || null;

let incidentDateTimeObj = null;

// If both provided, combine them into a single Date
if (incidentDate && incidentTime) {
  incidentDateTimeObj = new Date(`${incidentDate}T${incidentTime}`);
} else if (incident_datetime) {
  // fallback if frontend sends combined datetime
  incidentDateTimeObj = new Date(incident_datetime);
  incidentDate = incidentDateTimeObj.toISOString().split("T")[0];
  incidentTime = incidentDateTimeObj.toTimeString().split(" ")[0];
} else {
  // ultimate fallback = now
  incidentDateTimeObj = new Date();
  incidentDate = incidentDateTimeObj.toISOString().split("T")[0];
  incidentTime = incidentDateTimeObj.toTimeString().split(" ")[0];
}


    const reported_by = `${first_name || ''} ${last_name || ''}`.trim();

    // =======================
    // Save to PostgreSQL
    // =======================
const queryText = `
  INSERT INTO incident_reports 
  (latitude, longitude, barangay, city, province, region, category, incident_type, description, reported_person, reported_by, agreed_privacy, incident_datetime, incident_date, incident_time, media_filenames, media_urls, mobile_user_id)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, $18)
  RETURNING *;
`;

const values = [
  latitude,  // $1
  longitude, // $2
  barangay,  // $3
  city,      // $4
  province,  // $5
  region,    // $6
  category,  // $7
  incident_type ?? (customIncident || "other"), // $8
  description,       // $9
  reported_person,   // $10
  reported_by,       // $11
  agreedPrivacyBool, // $12
  incidentDateTimeObj, // $13
  incidentDate,      // $14
  incidentTime,      // $15
  mediaFilenames.length > 0 ? mediaFilenames : null, // $16
  mediaUrls.length > 0 ? mediaUrls : null,            // $17
  req.body.mobile_user_id || req.user?.id || null
];



    const result = await pool.query(queryText, values);
    const savedReport = result.rows[0];

    // Get mobile user ID from request or authenticated user
    const mobileUserId = req.body.mobile_user_id || req.user?.id;

if (mobileUserId) {
  try {
    await pool.query(
      `INSERT INTO notifications 
       (mobile_user_id, region, province, city, barangay, type, incident_type, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NOW())`,
      [
        mobileUserId,             // $1
        savedReport.region,       // $2
        savedReport.province,     // $3
        savedReport.city,         // $4
        savedReport.barangay,     // $5
        'newBarangayReport',      // $6
        savedReport.incident_type // $7
      ]
    );

    console.log(`✅ Notification created for mobile user ID ${mobileUserId}`);
  } catch (notifErr) {
    console.error('❌ Failed to create notification:', notifErr.message);
  }
} else {
  console.warn('⚠️ No mobile_user_id provided; skipping notification creation.');
}



//console.log('📌 Report saved to DB:', savedReport);

try {
  const io = getIo();
  //console.log('📢 Emitting newBarangayReport:', savedReport);
  io.emit('newBarangayReport', savedReport);
} catch (err) {
  console.warn('⚠️ Socket.io not initialized:', err.message);
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


// ================= Get All Pins =================
/*
const getPinsByLocation = async (req, res) => {
  try {
    const { city, province } = req.query;

    const result = await pool.query(
      'SELECT * FROM incident_reports WHERE city = $1 AND province = $2',
      [city, province]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching pins:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
*/

const getAllPins = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM incident_reports');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching pins:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// Get all barangay reports with status history
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
// =================================================
//  Barangay Web Dashboard
// =================================================
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

    // 1️⃣ Fetch current status_history
    const { rows } = await pool.query(
      `SELECT status_history FROM incident_reports WHERE id = $1`,
      [id]
    );
    const currentHistory = rows[0]?.status_history || [];

    // 2️⃣ Append new status
    const newHistoryItem = {
      label: status.toLowerCase(),
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    };
    const updatedHistory = [...currentHistory, newHistoryItem];

    // 3️⃣ Update report
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


      // After updating report
      const updatedReport = updateResult.rows[0];

      // -----------------------------
      // Save verification status notification to database
      // -----------------------------
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

      console.log("🔹 Saving notification for mobile_user_id:", updatedReport.mobile_user_id);

    let notification = null;
    try {
      const notificationResult = await pool.query(
        notificationQuery,
        notificationValues
      );
      notification = notificationResult.rows[0];
      console.log(
        "📲 Notification saved successfully:",
        notification
      );
    } catch (err) {
      console.error("❌ Failed to save notification:", err);
    }


    // Emit to everyone
    //const io = getIo();
    //io.emit("reportStatusUpdate", {
      //reportId: updatedReport.id,
      //status: updatedReport.status,
      //status_history: updatedReport.status_history
    //});

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
const LAN_IP = process.env.LAN_IP || "192.168.1.2"; 
const PORT = process.env.PORT || 5000;
const BASE_URL = `http://${LAN_IP}:${PORT}/uploads/proof`;

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

    // req.files is already an array if you use multer.array('proof', 5)
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const uploadedFiles = req.files; // Already an array
    console.log("Files received:", uploadedFiles);
    console.log("Number of files to upload:", uploadedFiles.length);

    const proofFiles = uploadedFiles.map(file => {
      const uploadsDir = "uploads/proof";
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

      const filePath = file.path; // multer already saved it
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

    // Emit to everyone
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

    // 1️⃣ Fetch current report
    const { rows } = await pool.query(
      `SELECT barangay, status_history FROM incident_reports WHERE id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Report not found" });
    }

    const report = rows[0];

    // 🔹 Log current barangay
    console.log(`Report ID ${id} is currently in barangay: ${report.barangay}`);

    // 2️⃣ Update status history
    const newHistoryItem = {
      label: "transferred",
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
      from_barangay: report.barangay,
      to_barangay: newBarangay,
    };

    const updatedHistory = [...(report.status_history || []), newHistoryItem];

    // 🔹 Log transfer action
    console.log(`Report ID ${id} transferred from ${report.barangay} to ${newBarangay} by ${updatedBy}`);

    // 3️⃣ Update report
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

    // 4️⃣ Save notification
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
      console.log(
        "📲 Notification saved successfully:",
        notification
      );
    } catch (err) {
      console.error("❌ Failed to save notification:", err);
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
    console.error("[transferReport] Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};






//  DELETE INCIDENT REPORT
// =================================================
const deleteIncidentReport = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  try {
    // Delete the mobile user by ID
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


//Blocking Rules
const getBarangayReportById = async (req, res) => {
  try {
    const userId = req.params.id; // comes from URL
    if (!userId) {
      return res.status(400).json({ error: "User ID missing" });
    }

    console.log("Fetching reports for userId:", userId); // 🔍 Debug log

    const query = `
      SELECT *
      FROM incident_reports
      WHERE mobile_user_id = $1
      ORDER BY incident_date DESC
    `;
    const result = await pool.query(query, [userId]);

    result.rows.forEach((report, index) => {
      console.log(`[getBarangayReportById] Report ${index + 1} proof_files:`, report.proof_files);
    });

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching user reports:", err);
    res.status(500).json({ error: "Server error" });
  }
};






module.exports = {
  submitReport,
  getAllPins,
  getBarangayReports,
  getBarangayReportsForMobile,

  getReportsByLocation,
  deleteIncidentReport,
  updateReportStatus,
  uploadProof,
  transferReport,

  getBarangayReportById,

};
