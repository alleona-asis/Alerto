const pool = require('../../PostgreSQL/database');
const path = require('path');
const {supabase} = require('../../PostgreSQL/supabaseClient');
const { generateSignedUrl } = require('../../utils/supabase');
// ==============================
//  SUBMIT LGU FEEDBACK
// ==============================

function pick(req, key) {
  const v = req?.body?.[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

function need(v) {
  if (v === undefined || v === null) return false;
  const s = String(v).trim();
  return s.length > 0;
}

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

    const feedbackTypeRaw   = pick(req, 'feedbackType');
    const messages          = pick(req, 'messages');
    const region            = pick(req, 'region');
    const province          = pick(req, 'province');
    const city              = pick(req, 'city');
    const concernedBarangay = pick(req, 'concernedBarangay');

    const feedbackType = normalizeFeedbackType(feedbackTypeRaw);

    // Validate presence of all fields
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

    // Build files from Supabase upload middleware 
    let images = Array.isArray(req.lguFiles?.images) ? req.lguFiles.images : [];
    let video  = req.lguFiles?.video ?? null;

    // only path/type/name are stored, no signed urls
    images = (images || []).map((i) => ({
      path: i.path || '',
      type: i.type || '',
      name: i.name || undefined,
    }));

    if (video && video.path) {
      video = {
        path: video.path,
        type: video.type || '',
        name: video.name || undefined,
      };
    } else {
      video = null;
    }

    if ((!images || images.length === 0) && !video && Array.isArray(fileUrls)) {
      const tmpImages = [];
      let tmpVideo = null;

      for (const url of fileUrls) {
        const lower = String(url).toLowerCase();
        const entry = { path: url }; 

        if (
          lower.endsWith('.mp4') ||
          lower.endsWith('.mov') ||
          lower.endsWith('.avi')
        ) {
          if (!tmpVideo) tmpVideo = entry;
        } else {
          tmpImages.push(entry);
        }
      }

      images = tmpImages;
      video = tmpVideo;
    }

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
      feedback: result.rows[0],
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
    const rows = result.rows || [];

    // Generate fresh signed URLs for images and video each time
    for (const row of rows) {
      // image(s)
      if (Array.isArray(row.images)) {
        row.images = await Promise.all(
          row.images.map(async (img) => {
            const objectKey = img.path || img.url || null;
            let signedUrl = null;
            if (objectKey) {
              try {
                signedUrl = await generateSignedUrl(objectKey);
              } catch (e) {
                console.warn('[LGU FEEDBACK] image sign fail:', objectKey, e?.message || e);
              }
            }
            return {
              ...img,
              url: signedUrl || img.url || null,
            };
          })
        );
      }

      // video(s)
      if (row.video && (row.video.path || row.video.url)) {
        const objectKey = row.video.path || row.video.url;
        let signedUrl = null;
        if (objectKey) {
          try {
            signedUrl = await generateSignedUrl(objectKey);
          } catch (e) {
            console.warn('[LGU FEEDBACK] video sign fail:', objectKey, e?.message || e);
          }
        }
        row.video = {
          ...row.video,
          url: signedUrl || row.video.url || null,
        };
      }
    }

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