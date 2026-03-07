const pool = require('../../PostgreSQL/database');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { getIo } = require('../../socket'); 
const {supabase} = require('../../PostgreSQL/supabaseClient');
const { processOCRLocalFile } = require('../../utils/ocr');

// Keywords for validation
const ID_KEYWORDS = {
  passport: ["passport", "republic"],
  driver_license: ["driver", "license", "dl no", "lto"],
  national_id: ["national id", "philippine identification", "psa"],
  philhealth: ["philhealth"],
  student_id: ["student", "school", "university", "college"],
};

// Clean OCR text
const cleanText = (text) => {
  return text
    .split("\n")
    .map((line) =>
      line
        .replace(/[-=~#*|><_]{2,}/g, " ")
        .replace(/[^\w\s.,:;!?'/()-]/g, "")
        .replace(/\s{2,}/g, " ")
        .trim()
    )
    .filter((line) => line.length > 4)
    .join("\n");
};

// Fuzzy keyword matching
const fuzzyMatchKeywords = (text, idType) => {
  const keywords = ID_KEYWORDS[idType] || [];
  const lowerText = text.toLowerCase();

  for (const keyword of keywords) {
    if (lowerText.includes(keyword.toLowerCase())) {
      return { matched: true, keyword, score: 1.0 };
    }
  }
  return { matched: false, keyword: null, score: 0 };
};



// =================================================
//  GET ALL MOBILE USERS WITHIN JURISDICTION
// =================================================
const getAllMobileUsers = async (req, res) => {
  try {
    const { region, province, city, barangay } = req.query;
    const staffRegion = req.user.region;
    const staffProvince = req.user.province;
    const staffCity = req.user.city;
    const staffBarangay = req.user.barangay;

    let baseQuery = 'SELECT * FROM mobile_users';
    const conditions = [];
    const values = [];

    if (staffRegion) {
      values.push(staffRegion);
      conditions.push(`region = $${values.length}`);
    }
    if (staffProvince) {
      values.push(staffProvince);
      conditions.push(`province = $${values.length}`);
    }
    if (staffCity) {
      values.push(staffCity);
      conditions.push(`city = $${values.length}`);
    }
    if (staffBarangay) {
      values.push(staffBarangay);
      conditions.push(`barangay = $${values.length}`);
    }

    if (region) {
      values.push(region);
      conditions.push(`region = $${values.length}`);
    }
    if (province) {
      values.push(province);
      conditions.push(`province = $${values.length}`);
    }
    if (city) {
      values.push(city);
      conditions.push(`city = $${values.length}`);
    }
    if (barangay) {
      values.push(barangay);
      conditions.push(`barangay = $${values.length}`);
    }

    if (conditions.length > 0) {
      baseQuery += ' WHERE ' + conditions.join(' AND ');
    }

    baseQuery += ' ORDER BY last_name ASC, first_name ASC';

    const result = await pool.query(baseQuery, values);

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Failed to retrieve mobile users:', error);
    return res.status(500).json({ message: 'Failed to retrieve mobile users' });
  }
};


// =================================================
// MARK AS READ NOTIFICATIONS
// =================================================
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ success: false, message: 'Staff name is required.' });
    }

    const read_by = `${first_name} ${last_name}`;
    const read_at = new Date();

    const result = await pool.query(
      `UPDATE notifications 
       SET is_read = TRUE, read_by = $1, read_at = $2
       WHERE id = $3
       RETURNING *`,
      [read_by, read_at, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    res.status(200).json({ success: true, notification: result.rows[0] });
  } catch (error) {
    console.error('Error marking as read:', error);
    res.status(500).json({ success: false, message: 'Server error marking notification as read.' });
  }
};



// =================================================
// GET NOTIFICATIONS BY LOCATIONS
// =================================================
const getNotificationsByLocation = async (req, res) => {
  try {
    const { region, province, city, barangay } = req.query;

    if (!region || !province || !city || !barangay) {
      return res.status(400).json({ message: 'Missing location parameters.' });
    }

    const query = `
      SELECT n.id, n.mobile_user_id,
             mu.first_name, mu.last_name,
             n.region, n.province, n.city, n.barangay,
             n.type, n.incident_type,
             n.is_read, n.read_by, n.read_at, n.created_at
      FROM notifications n
      LEFT JOIN mobile_users mu ON n.mobile_user_id = mu.id
      WHERE n.region = $1 AND n.province = $2 AND n.city = $3 AND n.barangay = $4
      ORDER BY n.created_at DESC
    `;

    const result = await pool.query(query, [region, province, city, barangay]);

    res.status(200).json({
      success: true,
      notifications: result.rows
    });
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    res.status(500).json({ message: 'Server error fetching notifications.', error: error.message });
  }
};


// =================================================
// DELETE NOTIFICATIONS
// =================================================
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const checkQuery = `SELECT * FROM notifications WHERE id = $1`;
    const checkResult = await pool.query(checkQuery, [id]);

    if (checkResult.rowCount === 0) {
      return res.json({ success: false, message: "Notification not found" });
    }

    const notification = checkResult.rows[0];

    if (notification.is_read) {

      setTimeout(async () => {
        try {
          const deleteQuery = `
            DELETE FROM notifications
            WHERE id = $1
          `;
          const delResult = await pool.query(deleteQuery, [id]);

          if (delResult.rowCount > 0) {
            console.log(`Notification ${id} auto-deleted after 5 minutes`);
          }
        } catch (err) {
          console.error("Error auto-deleting notification:", err);
        }
      }, 30 * 24 * 60 * 60 * 1000); // 5 minutes = 5 * 60 * 1000 
    }

    const query = `
      DELETE FROM notifications
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return res.json({ success: false, message: "Notification already deleted" });
    }

    res.json({
      success: true,
      message: "Notification deleted successfully",
      deletedNotification: result.rows[0]
    });
  } catch (err) {
    console.error("Error deleting notification:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};


// =================================================
//  DELETE MOBILE USER
// =================================================
const deleteMobileUser = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  try {
    const deleteResult = await pool.query(
      'DELETE FROM mobile_users WHERE id = $1 RETURNING *',
      [id]
    );

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'User deleted successfully', user: deleteResult.rows[0] });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
};


// =================================================
//  UPDATE MOBILE USER STATUS
// =================================================
const updateMobileUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason_for_rejection } = req.body;

    if (!id) return res.status(400).json({ message: 'Missing user ID (id) in request params' });
    if (!status) return res.status(400).json({ message: 'Missing status in request body' });

    const allowedStatuses = ['pending', 'verified', 'unverified'];
    if (!allowedStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({ message: `Invalid status: "${status}". Allowed: ${allowedStatuses.join(', ')}` });
    }

    const query = `
      UPDATE mobile_users 
      SET status = $1, reason_for_rejection = $2
      WHERE id = $3 
      RETURNING *
    `;
    const values = [status.toLowerCase(), reason_for_rejection || null, id];

    let result = await pool.query(query, values);
    if (result.rowCount === 0) return res.status(404).json({ message: 'User not found' });

    let updatedUser = result.rows[0];

    if (status.toLowerCase() === 'unverified') {
      await pool.query(
        `UPDATE mobile_users
         SET verification_attempts = verification_attempts + 1,
             last_verification_request = NOW()
         WHERE id = $1`,
        [id]
      );

      const refreshed = await pool.query('SELECT * FROM mobile_users WHERE id=$1', [id]);
      updatedUser = refreshed.rows[0];
    }


    const notificationQuery = `
      INSERT INTO mobile_notifications
        (mobile_user_id, type, status, reason_for_rejection, last_verification_request)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const notificationValues = [
      updatedUser.id,
      'verification_status',
      updatedUser.status,
      updatedUser.reason_for_rejection || null,
      updatedUser.last_verification_request
    ];

    const notificationResult = await pool.query(notificationQuery, notificationValues);
    const notification = notificationResult.rows[0];

    // Emit via Socket.io
    const io = getIo();
    io.emit("verificationStatusUpdate", {
      userId: updatedUser.id,
      status: updatedUser.status,
      reason_for_rejection: updatedUser.reason_for_rejection || null,
      last_verification_request: updatedUser.last_verification_request,
    });

    res.status(200).json({ message: 'Status updated', user: updatedUser });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};


// =================================================
//  GET MOBILE USER NOTIFICATIONS
// =================================================
const getMobileUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ message: 'Missing user ID in request params' });

    const query = `
      SELECT id, type, status, reason_for_rejection, last_verification_request, is_read, created_at
      FROM mobile_notifications
      WHERE mobile_user_id = $1
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query, [userId]);

    res.status(200).json({
      success: true,
      notifications: result.rows
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};


// =================================================
//  MARK MOBILE NOTIFICATIONS AS READ
// =================================================
const markMobileNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    if (!notificationId) return res.status(400).json({ message: 'Missing notification ID in request params' });

    const query = `
      UPDATE mobile_notifications
      SET is_read = true
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [notificationId]);

    if (result.rowCount === 0) return res.status(404).json({ message: 'Notification not found' });

    res.status(200).json({ success: true, notification: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// =================================================
//  DEACTIVATE MOBILE USER
// =================================================
const deactivateMobileUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "Missing user ID (id) in request params" });

    // get current status first
    const currentRes = await pool.query("SELECT status FROM mobile_users WHERE id = $1", [id]);
    if (currentRes.rowCount === 0) return res.status(404).json({ message: "User not found" });

    const currentStatus = String(currentRes.rows[0].status || "").toLowerCase();

    // store only verified/unverified as previous history
    const prev =
      currentStatus === "unverified" ? "unverified" : "verified";

    const result = await pool.query(
      `
      UPDATE mobile_users
      SET previous_status = $1,
          status = 'deactivated'
      WHERE id = $2
      RETURNING *
      `,
      [prev, id]
    );

    const updatedUser = result.rows[0];

    const io = getIo();
    io.emit("verificationStatusUpdate", {
      userId: updatedUser.id,
      status: updatedUser.status,
      reason_for_rejection: updatedUser.reason_for_rejection || null,
      last_verification_request: updatedUser.last_verification_request || null,
    });

    return res.status(200).json({ message: "Account deactivated", user: updatedUser });
  } catch (error) {
    console.error("Error deactivating user:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


// =================================================
//  ACTIVATE MOBILE USER (restore previous_status)
// =================================================
const activateMobileUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "Missing user ID (id) in request params" });

    const currentRes = await pool.query(
      "SELECT previous_status FROM mobile_users WHERE id = $1",
      [id]
    );
    if (currentRes.rowCount === 0) return res.status(404).json({ message: "User not found" });

    const prev = String(currentRes.rows[0].previous_status || "").toLowerCase();
    const restoreTo = prev === "unverified" ? "unverified" : "verified";

    const result = await pool.query(
      `
      UPDATE mobile_users
      SET status = $1,
          previous_status = NULL,
          suspended_at = NULL,
          suspended_until = NULL
      WHERE id = $2
      RETURNING *
      `,
      [restoreTo, id]
    );


    const updatedUser = result.rows[0];

    const io = getIo();
    io.emit("verificationStatusUpdate", {
      userId: updatedUser.id,
      status: updatedUser.status,
      reason_for_rejection: updatedUser.reason_for_rejection || null,
      last_verification_request: updatedUser.last_verification_request || null,
    });

    return res.status(200).json({ message: "Account activated", user: updatedUser });
  } catch (error) {
    console.error("Error activating user:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


// =================================================
//  BLOCK MOBILE USER
// =================================================
const blockMobileUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "Missing user ID (id) in request params" });
    }

    const currentRes = await pool.query(
      "SELECT status FROM mobile_users WHERE id = $1",
      [id]
    );
    if (currentRes.rowCount === 0) return res.status(404).json({ message: "User not found" });

    const currentStatus = String(currentRes.rows[0].status || "").toLowerCase();

    const prev = currentStatus === "unverified" ? "unverified" : "verified";

    const result = await pool.query(
      `
      UPDATE mobile_users
      SET previous_status = $1,
          status = 'blocked'
      WHERE id = $2
      RETURNING *
      `,
      [prev, id]
    );

    const updatedUser = result.rows[0];

    const io = getIo();
    io.emit("verificationStatusUpdate", {
      userId: updatedUser.id,
      status: updatedUser.status,
      reason_for_rejection: updatedUser.reason_for_rejection || null,
      last_verification_request: updatedUser.last_verification_request || null,
    });

    return res.status(200).json({ message: "Account blocked", user: updatedUser });
  } catch (error) {
    console.error("Error blocking user:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


// =================================================
//  SUSPEND MOBILE USER (5 minutes)
// =================================================
const suspendMobileUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "Missing user ID (id) in request params" });
    }

    const restoreRes = await pool.query(
      `
      UPDATE mobile_users
      SET status = COALESCE(previous_status, 'verified'),
          previous_status = NULL,
          suspended_at = NULL,
          suspended_until = NULL
      WHERE id = $1
        AND status = 'suspended'
        AND suspended_until IS NOT NULL
        AND suspended_until <= NOW()
      RETURNING *
      `,
      [id]
    );

    if (restoreRes.rowCount > 0) {
      const restoredUser = restoreRes.rows[0];

      const io = getIo();
      io.emit("verificationStatusUpdate", {
        userId: restoredUser.id,
        status: restoredUser.status,
        suspended_at: restoredUser.suspended_at || null,
        suspended_until: restoredUser.suspended_until || null,
        reason_for_rejection: restoredUser.reason_for_rejection || null,
        last_verification_request: restoredUser.last_verification_request || null,
      });

      return res.status(200).json({
        message: "Suspension expired. Account restored to previous status.",
        user: restoredUser,
      });
    }

    const currentRes = await pool.query(
      "SELECT status, previous_status FROM mobile_users WHERE id = $1",
      [id]
    );
    if (currentRes.rowCount === 0) return res.status(404).json({ message: "User not found" });

    const currentStatus = String(currentRes.rows[0].status || "").toLowerCase();
    const prev = currentStatus === "unverified" ? "unverified" : "verified";

    const result = await pool.query(
      `
      UPDATE mobile_users
      SET previous_status = COALESCE(previous_status, $1),
          status = 'suspended',
          suspended_at = NOW(),
          suspended_until = NOW() + INTERVAL '5 minutes'
      WHERE id = $2
      RETURNING *
      `,
      [prev, id]
    );

    const updatedUser = result.rows[0];

    const io = getIo();
    io.emit("verificationStatusUpdate", {
      userId: updatedUser.id,
      status: updatedUser.status,
      suspended_at: updatedUser.suspended_at || null,
      suspended_until: updatedUser.suspended_until || null,
      reason_for_rejection: updatedUser.reason_for_rejection || null,
      last_verification_request: updatedUser.last_verification_request || null,
    });

    return res.status(200).json({
      message: "Account Suspended (5 minutes)",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error suspending user:", error);
    return res.status(500).json({ message: "Server error" });
  }
};




module.exports = { 
  getAllMobileUsers,
  deleteMobileUser,
  updateMobileUserStatus,
  markAsRead,
  getNotificationsByLocation,
  deleteNotification,
  getMobileUserNotifications,
  markMobileNotificationAsRead,
  deactivateMobileUser,
  activateMobileUser,
  blockMobileUser,
  suspendMobileUser,
};
