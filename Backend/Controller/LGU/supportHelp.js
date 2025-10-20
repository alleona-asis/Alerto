// controllers/lguFeedbackController.js
const pool = require('../../PostgreSQL/database');
const path = require('path');
const {supabase} = require('../../PostgreSQL/supabaseClient');
// ==============================
//  SUBMIT LGU FEEDBACK
// ==============================
// const submitLGUFeedback = async (req, res) => {
//   try {
//     console.log('Received LGU feedback submission:', req.body);
//     console.log('Uploaded files:', req.files);

//     const {
//       feedbackType,
//       messages,
//       region,
//       province,
//       city,
//       concernedBarangay,
//       firstName,
//       middleName,
//       lastName
//     } = req.body;

//     if (!feedbackType || !messages || !region || !province || !city || !concernedBarangay || !firstName || !middleName || !lastName) {
//       console.log('Validation failed: Missing required fields');
//       return res.status(400).json({ error: 'Please fill in all required fields.' });
//     }

//     let images = [];
//     let video = null;

//     if (req.files && Array.isArray(req.files)) {
//       req.files.forEach(file => {
//         const fileData = {
//           path: file.path,
//           url: `${req.protocol}://${req.get('host')}/uploads/feedback/${file.filename}`
//         };

//         if (file.mimetype.startsWith('image/')) {
//           images.push(fileData);
//         } else if (file.mimetype.startsWith('video/')) {
//           video = fileData;
//         }
//       });
//     }

//     console.log('Processed images:', images);
//     console.log('Processed video:', video);

//     const query = `
//       INSERT INTO lgu_feedbacks
//         (feedback_type, messages, region, province, city, concerned_barangay, images, video,
//          first_name, middle_name, last_name)
//       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11)
//       RETURNING *;
//     `;

//     const values = [
//       feedbackType,
//       messages,
//       region,
//       province,
//       city,
//       concernedBarangay,
//       JSON.stringify(images),
//       JSON.stringify(video),
//       firstName,
//       middleName,
//       lastName
//     ];

//     const result = await pool.query(query, values);
//     console.log('Feedback inserted successfully:', result.rows[0]);

//     res.status(201).json({
//       message: 'Feedback submitted successfully',
//       feedback: result.rows[0]
//     });

//   } catch (error) {
//     console.error('Error submitting LGU feedback:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// };

// Helper: extract a single string from req.body (handles arrays/undefined)
function pick(req, key) {
  const v = req?.body?.[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

// Helper: "non-empty?" check for strings
function need(v) {
  if (v === undefined || v === null) return false;
  const s = String(v).trim();
  return s.length > 0;
}

// Optional: normalize feedbackType to a canonical set
function normalizeFeedbackType(ft) {
  if (!ft) return '';
  const s = String(ft).trim().toLowerCase();
  const map = {
    complaint: 'Complaint',
    compliment: 'Compliment',
    suggestion: 'Suggestion',
    other: 'Other',
  };
  return map[s] || s.charAt(0).toUpperCase() + s.slice(1);
}

const submitLGUFeedback = async (req, res, { fileUrls } = {}) => {
  try {
    // Extract & normalize text fields robustly
    const feedbackTypeRaw   = pick(req, 'feedbackType');
    const messages          = pick(req, 'messages');
    const region            = pick(req, 'region');
    const province          = pick(req, 'province');
    const city              = pick(req, 'city');
    const concernedBarangay = pick(req, 'concernedBarangay');

    const feedbackType = normalizeFeedbackType(feedbackTypeRaw);

    // Validate presence
    const missing = [];
    if (!need(feedbackType))       missing.push('feedbackType');
    if (!need(messages))           missing.push('messages');
    if (!need(region))             missing.push('region');
    if (!need(province))           missing.push('province');
    if (!need(city))               missing.push('city');
    if (!need(concernedBarangay))  missing.push('concernedBarangay');

    if (missing.length) {
      return res.status(400).json({
        error: `Please fill in all required fields.`,
        missing
      });
    }

    // Build files from Supabase upload middleware (prefer detailed objects if you have them)
    // Option A: you already prepared req.lguFiles in the route:
    const images = Array.isArray(req.lguFiles?.images) ? req.lguFiles.images : [];
    const video  = req.lguFiles?.video ?? null;

    // Option B: if route passed simple URLs via { fileUrls }, fall back to that:
    if ((!images || images.length === 0) && !video && Array.isArray(fileUrls)) {
      for (const url of fileUrls) {
        const lower = String(url).toLowerCase();
        const entry = { url };
        if (lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.avi')) {
          // first video wins
          if (!video) video = entry;
        } else {
          images.push(entry);
        }
      }
    }

    // Insert
    const query = `
      INSERT INTO lgu_feedbacks
        (feedback_type, messages, region, province, city, concerned_barangay, images, video)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
      RETURNING *;
    `;
    const values = [
      feedbackType,
      String(messages).trim(),
      String(region).trim(),
      String(province).trim(),
      String(city).trim(),
      String(concernedBarangay).trim(),
      JSON.stringify(images || []),
      JSON.stringify(video || null),
    ];

    const result = await pool.query(query, values);
    return res.status(201).json({
      message: 'Feedback submitted successfully',
      feedback: result.rows[0]
    });
  } catch (error) {
    console.error('Error submitting LGU feedback:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};


// ==============================
//  GET ALL LGU FEEDBACK
// ==============================
const getAllLGUFeedback = async (req, res) => {
  try {
    const query = `
      SELECT * 
      FROM lgu_feedbacks
      ORDER BY submitted_at DESC;
    `;

    const result = await pool.query(query);

    res.status(200).json({
      message: 'Feedback fetched successfully',
      feedbacks: result.rows
    });
  } catch (error) {
    console.error('Error fetching LGU feedback:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==============================
//  DELETE LGU FEEDBACK
// ==============================
const deleteLGUFeedback = async (req, res) => {
  const { id } = req.params;

  if (!id) return res.status(400).json({ error: 'Feedback ID is required' });

  try {
    const query = `
      DELETE FROM lgu_feedbacks
      WHERE id = $1
      RETURNING *;
    `;
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    res.status(200).json({
      message: 'Feedback deleted successfully',
      feedback: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting LGU feedback:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};



module.exports = { 
    submitLGUFeedback,
    getAllLGUFeedback,
    deleteLGUFeedback
};