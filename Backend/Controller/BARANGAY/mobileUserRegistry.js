const pool = require('../../PostgreSQL/database');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { getIo } = require('../../socket'); 

// =================================================
//  OCR PROCESSING
// =================================================
/* 
const processOCR = async (req, res) => {
  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const { idType } = req.body;
    if (!idType || !ID_KEYWORDS[idType]) {
      return res.status(400).json({ error: 'Invalid or missing ID type' });
    }

    // Process image in-memory with Sharp and pass buffer to Tesseract directly
    const processedBuffer = await sharp(req.file.path)
      .grayscale()
      .normalize()
      .resize({ width: 1000 })
      .png()
      .toBuffer(); // ✅ Skip writing to disk

    // OCR directly from processed buffer
    const {
      data: { text: rawText = '' }
    } = await Tesseract.recognize(processedBuffer, 'eng', {
      logger: m => console.log('🧠 OCR Progress:', m),
    });

    const cleanedText = cleanText(rawText);
    console.log('🧾 Cleaned OCR Text:', cleanedText);

    const { matched, keyword, score } = fuzzyMatchKeywords(cleanedText, idType);

    // Cleanup original file
    fs.promises.unlink(req.file.path).catch(err =>
      console.warn('⚠️ Failed to delete original file:', err)
    );

    return res.status(200).json({
      text: cleanedText,
      matched,
      matchedKeyword: keyword,
      matchScore: score,
    });

  } catch (error) {
    console.error('❌ OCR processing failed:', error.message || error);
    res.status(500).json({ error: 'OCR processing failed' });
  }
};
*/

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

const processOCR = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No image files uploaded" });
    }

    const { idType } = req.body;
    if (!idType || !ID_KEYWORDS[idType]) {
      return res.status(400).json({ error: "Invalid or missing ID type" });
    }

    let combinedText = "";

    // 🔄 Loop through both front + back images
    for (const file of req.files) {
      const processedBuffer = await sharp(file.path)
        .grayscale()
        .normalize()
        .resize({ width: 1000 })
        .png()
        .toBuffer();

      const {
        data: { text: rawText = "" },
      } = await Tesseract.recognize(processedBuffer, "eng", {
        logger: (m) => console.log("🧠 OCR Progress:", m),
      });

      combinedText += rawText + "\n";

      // Cleanup uploaded file
      fs.promises.unlink(file.path).catch((err) =>
        console.warn("⚠️ Failed to delete original file:", err)
      );
    }

    const cleanedText = cleanText(combinedText);
    console.log("🧾 Cleaned OCR Text:", cleanedText);

    const { matched, keyword, score } = fuzzyMatchKeywords(cleanedText, idType);

    return res.status(200).json({
      text: cleanedText,
      matched,
      matchedKeyword: keyword,
      matchScore: score,
    });
  } catch (error) {
    console.error("❌ OCR processing failed:", error.message || error);
    res.status(500).json({ error: "OCR processing failed" });
  }
};


// GET MOBILE USERS WITH OPTIONAL LOCATION FILTERS AND STAFF JURISDICTION
const getAllMobileUsers = async (req, res) => {
  try {
    const { region, province, city, barangay } = req.query;

    // Assume staff's jurisdiction is in req.user
    const staffRegion = req.user.region;
    const staffProvince = req.user.province;
    const staffCity = req.user.city;
    const staffBarangay = req.user.barangay;

    let baseQuery = 'SELECT * FROM mobile_users';
    const conditions = [];
    const values = [];

    // ALWAYS filter by staff jurisdiction
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

    // Optional filters from query (further narrow)
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

    // Apply conditions
    if (conditions.length > 0) {
      baseQuery += ' WHERE ' + conditions.join(' AND ');
    }

    baseQuery += ' ORDER BY last_name ASC, first_name ASC';

    const result = await pool.query(baseQuery, values);

    //console.log('Mobile Users under barangay staff jurisdiction:', result.rows);

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Failed to retrieve mobile users:', error);
    return res.status(500).json({ message: 'Failed to retrieve mobile users' });
  }
};

// =================================================
// NOTIFICATIONS CONTROLLER WITH DEBUGGING
// =================================================
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params; // notification ID
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
    console.error('❌ Error marking as read:', error);
    res.status(500).json({ success: false, message: 'Server error marking notification as read.' });
  }
};







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
    console.error('❌ Failed to fetch notifications:', error);
    res.status(500).json({ message: 'Server error fetching notifications.', error: error.message });
  }
};


// Delete a notification
// Delete a notification
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch notification first to check status
    const checkQuery = `SELECT * FROM notifications WHERE id = $1`;
    const checkResult = await pool.query(checkQuery, [id]);

    if (checkResult.rowCount === 0) {
      return res.json({ success: false, message: "Notification not found" });
    }

    const notification = checkResult.rows[0];

    // ✅ If it's already read, schedule auto-delete in 5 minutes
    if (notification.is_read) {
      console.log(`⏳ Notification ${id} is read. Scheduling deletion in 5 minutes...`);

      setTimeout(async () => {
        try {
          const deleteQuery = `
            DELETE FROM notifications
            WHERE id = $1
          `;
          const delResult = await pool.query(deleteQuery, [id]);

          if (delResult.rowCount > 0) {
            console.log(`🗑️ Notification ${id} auto-deleted after 5 minutes`);
          }
        } catch (err) {
          console.error("❌ Error auto-deleting notification:", err);
        }
      }, 30 * 24 * 60 * 60 * 1000); // 5 minutes = 5 * 60 * 1000 
    }

    // ✅ Manual delete (when user explicitly deletes)
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
    console.error("❌ Error deleting notification:", err);
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
    // Delete the mobile user by ID
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


/*
const updateMobileUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id) return res.status(400).json({ message: 'Missing user ID (id) in request params' });
    if (!status) return res.status(400).json({ message: 'Missing status in request body' });

    const allowedStatuses = ['pending', 'verified', 'unverified'];
    if (!allowedStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({ message: `Invalid status: "${status}". Allowed: ${allowedStatuses.join(', ')}` });
    }

    const query = `UPDATE mobile_users SET status = $1 WHERE id = $2 RETURNING *`;
    const values = [status.toLowerCase(), id];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'Status updated', user: result.rows[0] });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};


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

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updatedUser = result.rows[0];

    // ✅ Increment attempts only if rejected
    if (status.toLowerCase() === 'unverified') {
      await pool.query(
        `UPDATE mobile_users
         SET verification_attempts = verification_attempts + 1,
             last_verification_request = $1
         WHERE id = $2`,
        [new Date(), id]
      );
    }

    // 🔥 Emit socket event so all clients know about the update
    const io = getIo();
    io.emit("verificationStatusUpdate", {
      userId: updatedUser.id,
      status: updatedUser.status,
      reason_for_rejection: updatedUser.reason_for_rejection || null,
      last_verification_request: updatedUser.last_verification_request,
      reason_for_rejection: updatedUser.reason_for_rejection || null,
    });

    res.status(200).json({ message: 'Status updated', user: updatedUser });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
*/


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

    // Update status first
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

    // Increment attempts only if rejected
    if (status.toLowerCase() === 'unverified') {
      await pool.query(
        `UPDATE mobile_users
         SET verification_attempts = verification_attempts + 1,
             last_verification_request = NOW()
         WHERE id = $1`,
        [id]
      );

      // Refetch updated user to get new attempts and last_verification_request
      const refreshed = await pool.query('SELECT * FROM mobile_users WHERE id=$1', [id]);
      updatedUser = refreshed.rows[0];
    }

    // -----------------------------
    // Save verification status notification to database
    // -----------------------------
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


    // -----------------------------
    // Emit real-time notification to the specific user
    // -----------------------------

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

// GET /api/mobile/notifications/:userId
const getMobileUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ message: 'Missing user ID in request params' });

    // Fetch notifications for this user, most recent first
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








module.exports = { 
  processOCR,
  getAllMobileUsers,
  deleteMobileUser,
  updateMobileUserStatus,
  markAsRead,
  getNotificationsByLocation,
  deleteNotification,
  getMobileUserNotifications,
  markMobileNotificationAsRead
};
