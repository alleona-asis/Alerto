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
//  OCR PROCESSING
// =================================================

async function processOCR(req, res, { localPaths = [] }) {
  const userId = Number(req.params.userId);
  const idType = req.body.idType || req.body.id_type || 'national_id';

  try {
    const filesMeta = (req.supabaseFiles?.files) || [];
    const front = filesMeta[0] || null;
    const back  = filesMeta[1] || null;

    // 1) Persist paths/urls immediately (so dashboards can view right away)
    const upd = await pool.query(
      `UPDATE mobile_users
         SET id_type       = COALESCE($1, id_type),
             id_front_path = $2, id_front_url = $3,
             id_back_path  = $4, id_back_url  = $5,
             status        = CASE WHEN status = 'verified' THEN status ELSE 'pending' END,
             ocr_status    = 'pending',             -- <- add this column (see note below)
             ocr_error     = NULL
       WHERE id = $6
       RETURNING id, status, id_front_path, id_back_path`,
      [idType, front?.relativePath || null, front?.supabaseUrl || null,
              back?.relativePath  || null, back?.supabaseUrl  || null, userId]
    );

    // 2) Respond ASAP (mobile app won’t time out / dashboard can already view)
    res.json({ ok: true, message: 'ID images uploaded', saved: upd.rows[0] });

    // 3) Fire-and-forget OCR — do NOT block the response
    setImmediate(async () => {
      try {
        const results = [];
        for (const p of localPaths) {
          results.push(await processOCRLocalFile(p, idType));
        }

        await pool.query(
          `UPDATE mobile_users
             SET ocr_status = 'ok',
                 ocr_text_front = $1,           -- <- add these columns
                 ocr_text_back  = $2,
                 ocr_match_score= $3,
                 ocr_updated_at = NOW()
           WHERE id = $4`,
          [
            results[0]?.ocrResult || null,
            results[1]?.ocrResult || null,
            Math.max(results[0]?.matchScore || 0, results[1]?.matchScore || 0),
            userId
          ]
        );
      } catch (e) {
        await pool.query(
          `UPDATE mobile_users
             SET ocr_status = 'failed',
                 ocr_error  = $1,
                 ocr_updated_at = NOW()
           WHERE id = $2`,
          [String(e?.message || e), userId]
        );
      } finally {
        for (const lp of localPaths) { try { await fs.promises.unlink(lp); } catch {} }
      }
    });

  } catch (err) {
    console.error('[processOCR] fatal:', err);
    // even on error, try to not lose files — tell client it failed but files might be saved already
    return res.status(500).json({ ok: false, message: 'Upload saved, OCR failed', error: err.message });
  }
}


// async function processOCR(req, res, { localPaths = [] }) {
//   const idType = req.body.idType || req.body.id_type || 'national_id';
//   const results = [];

//   for (const p of localPaths) {
//     try {
//       const r = await processOCRLocalFile(p, idType);
//       results.push(r);
//     } catch (e) {
//       results.push({ ocrResult: '', matched: false, matchedKeyword: null, matchScore: 0, error: e.message });
//     }
//   }

//   // …Update your DB as needed with IDs’ paths/URLs…
//   return res.json({ ok: true, results });
// }


// const processOCR = async (req, res) => {
//   try {
//     if (!req.files || req.files.length === 0) {
//       return res.status(400).json({ error: "No image files uploaded" });
//     }

//     const { idType } = req.body;
//     if (!idType || !ID_KEYWORDS[idType]) {
//       return res.status(400).json({ error: "Invalid or missing ID type" });
//     }

//     let combinedText = "";

//     for (const file of req.files) {
//       const processedBuffer = await sharp(file.path)
//         .grayscale()
//         .normalize()
//         .resize({ width: 1000 })
//         .png()
//         .toBuffer();

//       const {
//         data: { text: rawText = "" },
//       } = await Tesseract.recognize(processedBuffer, "eng", {
//         logger: (m) => console.log("OCR Progress:", m),
//       });

//       combinedText += rawText + "\n";

//       fs.promises.unlink(file.path).catch((err) =>
//         console.warn("Failed to delete original file:", err)
//       );
//     }

//     const cleanedText = cleanText(combinedText);
//     console.log("Cleaned OCR Text:", cleanedText);

//     const { matched, keyword, score } = fuzzyMatchKeywords(cleanedText, idType);

//     return res.status(200).json({
//       text: cleanedText,
//       matched,
//       matchedKeyword: keyword,
//       matchScore: score,
//     });
//   } catch (error) {
//     console.error("OCR processing failed:", error.message || error);
//     res.status(500).json({ error: "OCR processing failed" });
//   }
// };


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
