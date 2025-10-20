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

const submitLGUFeedback = async (req, res, { fileUrls } = {}) => {  // Accept fileUrls param
  try {
    console.log('Received LGU feedback submission:', req.body);
    console.log('Supabase files:', req.supabaseFiles?.files);
    // Extract body fields (now parsed by express.urlencoded)
    const {
      feedbackType,
      messages,
      region,
      province,
      city,
      concernedBarangay,
      firstName,
      middleName,
      lastName
    } = req.body;
    if (!feedbackType || !messages || !region || !province || !city || !concernedBarangay || !firstName || !middleName || !lastName) {
      console.log('Validation failed: Missing required fields');
      return res.status(400).json({ error: 'Please fill in all required fields.' });
    }
    // Process Supabase files using fileUrls
    let images = [];
    let video = null;

        fileUrls.forEach(url => {
      // Basic type detection (improve if needed by passing mimetype from middleware)
      const isVideo = url.includes('.mp4') || url.includes('.mov') || url.includes('.avi');
      const fileData = { url };  // Use Supabase signed URL
      if (isVideo) {
        video = fileData;
      } else {
        images.push(fileData);
      }
    });
    console.log('Processed images:', images);
    console.log('Processed video:', video);
    const query = `
      INSERT INTO lgu_feedbacks
        (feedback_type, messages, region, province, city, concerned_barangay, images, video,
         first_name, middle_name, last_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11)
      RETURNING *;
    `;

        const values = [
      feedbackType,
      messages,
      region,
      province,
      city,
      concernedBarangay,
      JSON.stringify(images),
      JSON.stringify(video),
      firstName,
      middleName,
      lastName
    ];
    const result = await pool.query(query, values);
    console.log('Feedback inserted successfully:', result.rows[0]);
    res.status(201).json({
      message: 'Feedback submitted successfully',
      feedback: result.rows[0]
    });
  } catch (error) {
    console.error('Error submitting LGU feedback:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error', details: error.message });
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