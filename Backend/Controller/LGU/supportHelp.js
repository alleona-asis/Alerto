// controllers/lguFeedbackController.js
const pool = require('../../PostgreSQL/database');
const path = require('path');

// Submit LGU Feedback
const submitLGUFeedback = async (req, res) => {
  try {
    console.log('Received LGU feedback submission:', req.body);
    console.log('Uploaded files:', req.files);

    const {
      feedbackType,
      messages,
      region,
      province,
      city,
      concernedBarangay
    } = req.body;

    // Basic validation
    if (!feedbackType || !messages || !region || !province || !city || !concernedBarangay) {
      console.log('Validation failed: Missing required fields');
      return res.status(400).json({ error: 'Please fill in all required fields.' });
    }

    // Process uploaded files (if any)
    let images = [];
    let video = null;

    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(file => {
        const fileData = {
          path: file.path,
          url: `${req.protocol}://${req.get('host')}/uploads/feedback/${file.filename}`
        };

        if (file.mimetype.startsWith('image/')) {
          images.push(fileData);
        } else if (file.mimetype.startsWith('video/')) {
          video = fileData; // store only one video, last uploaded
        }
      });
    }

    console.log('Processed images:', images);
    console.log('Processed video:', video);

    // Insert into database
    const query = `
      INSERT INTO lgu_feedbacks
        (feedback_type, messages, region, province, city, concerned_barangay, images, video)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
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
      JSON.stringify(video)
    ];

    const result = await pool.query(query, values);
    console.log('Feedback inserted successfully:', result.rows[0]);

    res.status(201).json({
      message: 'Feedback submitted successfully',
      feedback: result.rows[0]
    });

  } catch (error) {
    console.error('Error submitting LGU feedback:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// ================== Get All LGU Feedback ==================
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

module.exports = { 
    submitLGUFeedback,
    getAllLGUFeedback
};
