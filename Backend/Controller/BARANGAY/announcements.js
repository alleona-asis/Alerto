const pool = require('../../PostgreSQL/database');
const path = require('path');
const fs = require('fs');
const { getIo } = require('../../socket');

// Replace with your computer's LAN IP so mobile devices can access it
// const LAN_IP = process.env.LAN_IP || "192.168.1.2"; 
 const PORT = process.env.PORT || 5000;
// const BASE_URL = `http://${LAN_IP}:${PORT}`;

// =========================
// CREATE ANNOUNCEMENT
// =========================
const createAnnouncement = async (req, res) => {
    //console.log('📥 Incoming Announcement Creation Request');
    //console.log('📝 Form Data:', req.body);
    //console.log('📎 Files:', req.files);

    const { 
        title, 
        text, 
        posted_by_id, 
        posted_by_name,
        region,
        province,
        city,
        barangay 
    } = req.body;

    if (!title || !text) {
        return res.status(400).json({ message: 'Title and text are required' });
    }

    if (!posted_by_id || !posted_by_name) {
        return res.status(400).json({ message: 'Poster ID and name are required' });
    }

    const files = req.files || [];

    //const filenames = files.map(f => f.filename);
    //const urls = files.map(f => `${req.protocol}://${req.get('host')}/uploads/announcements/${f.filename}`);

    // Save filenames and generate mobile-accessible URLs
    const filenames = files.map(f => f.filename);
    const urls = files.map(f => `${BASE_URL}/uploads/announcements/${f.filename}`);

    try {
        const result = await pool.query(
        `INSERT INTO announcements 
            (title, text, image_filenames, image_urls, posted_by_id, posted_by_name, region, province, city, barangay)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *;`,
        [
            title, 
            text, 
            JSON.stringify(filenames), 
            JSON.stringify(urls), 
            posted_by_id, 
            posted_by_name,
            region || '',
            province || '',
            city || '',
            barangay || ''
        ]
      );

      const createdAnnouncement = result.rows[0];

      // -----------------------------
      // Send notifications to ALL users in the same location
      // -----------------------------
      try {
        // 1. Find users in the same location
        const usersQuery = `
          SELECT id 
          FROM mobile_users
          WHERE region = $1
            AND province = $2
            AND city = $3
            AND barangay = $4
        `;

        const usersResult = await pool.query(usersQuery, [
          region || '',
          province || '',
          city || '',
          barangay || ''
        ]);

        const userIds = usersResult.rows.map(r => r.id);

        if (userIds.length > 0) {
          const notificationQuery = `
            INSERT INTO mobile_notifications (mobile_user_id, type, status)
            VALUES ($1, $2, $3)
            RETURNING *
          `;

          for (const userId of userIds) {
            await pool.query(notificationQuery, [
              userId,
              'broadcast_announcements',
              'created'
            ]);
          }

          console.log(`📲 Notifications sent to ${userIds.length} users in ${barangay}, ${city}`);
        } else {
          console.log("⚠️ No users found in this location for notification.");
        }

      } catch (err) {
        console.error("❌ Failed to save notifications:", err.message);
        console.error("Full error:", err);
      }


      // -----------------------------
      // Emit to everyone
      // -----------------------------
      const io = getIo();
      console.log("📡 Emitting announcementUpdate:", createdAnnouncement);

      io.emit("announcementUpdate", {
        id: createdAnnouncement.id,
        title: createdAnnouncement.title,
        text: createdAnnouncement.text,
        posted_by_id: createdAnnouncement.posted_by_id,
        posted_by_name: createdAnnouncement.posted_by_name,
        region: createdAnnouncement.region,
        province: createdAnnouncement.province,
        city: createdAnnouncement.city,
        barangay: createdAnnouncement.barangay,
        created_at: createdAnnouncement.created_at,
      });




      // -----------------------------
      // Final response
      // -----------------------------
      return res.status(201).json({
        message: 'Announcement created successfully!',
        announcement: createdAnnouncement,
      });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create announcement', error: error.message });
    }
};


// =========================
// DELETE ANNOUNCEMENT
// =========================
const deleteAnnouncement = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "Announcement ID is required" });
  }

  try {
    // 1. Get announcement (to know images before deleting)
    const findResult = await pool.query(
      `SELECT * FROM announcements WHERE id = $1`,
      [id]
    );

    if (findResult.rowCount === 0) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    const announcement = findResult.rows[0];

    // 2. Delete announcement
    await pool.query(`DELETE FROM announcements WHERE id = $1`, [id]);

    // 3. Delete related notifications
    await pool.query(
      `DELETE FROM mobile_notifications 
       WHERE type = 'broadcast_announcements' 
         AND mobile_user_id IN (
           SELECT id FROM mobile_users 
           WHERE region = $1 AND province = $2 AND city = $3 AND barangay = $4
         )`,
      [
        announcement.region,
        announcement.province,
        announcement.city,
        announcement.barangay,
      ]
    );

    // 4. Delete image files from server
    try {
      let filenames = [];

      if (Array.isArray(announcement.image_filenames)) {
        // Case: already stored as array in DB
        filenames = announcement.image_filenames;
      } else if (
        typeof announcement.image_filenames === "string" &&
        announcement.image_filenames.trim() !== ""
      ) {
        // Case: stored as JSON string in DB
        filenames = JSON.parse(announcement.image_filenames);
      }

      if (!Array.isArray(filenames)) filenames = [];

      filenames.forEach((file) => {
        const filePath = path.join(
          __dirname,
          "../../uploads/announcements",
          file
        );
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    } catch (err) {
      console.warn("⚠️ Failed to delete some image files:", err.message);
    }

    // 5. Emit socket event for real-time UI update
    const io = getIo();
    console.log("📡 Emitting announcementDeleted:", id);

    io.emit("announcementDeleted", { id });

    // 6. Final response
    return res
      .status(200)
      .json({ message: "Announcement deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting announcement:", error.message);
    return res.status(500).json({
      message: "Failed to delete announcement",
      error: error.message,
    });
  }
};





// =========================
// GET ANNOUNCEMENTS
// =========================
const getAnnouncements = async (req, res) => {
    try {
        const { barangay } = req.query; // optional filter by barangay

        let query = 'SELECT * FROM announcements';
        const params = [];

        if (barangay) {
            query += ' WHERE barangay = $1';
            params.push(barangay);
        }

        query += ' ORDER BY created_at DESC'; // latest first

        const result = await pool.query(query, params);

        return res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to fetch announcements', error: error.message });
    }
};


const getAnnouncementByUserLocation = async (req, res) => {
  try {
    const userId = req.params.id;

    // Get user profile including followed barangays
    const userResult = await pool.query(
      `SELECT region, province, city, barangay, followed_barangays
       FROM mobile_users WHERE id = $1`,
      [userId]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const { region, province, city, barangay, followed_barangays } = userResult.rows[0];

    // Parse followed barangays safely
    let followed = [];
    if (followed_barangays) {
      if (typeof followed_barangays === "string") {
        try {
          followed = JSON.parse(followed_barangays);
        } catch {
          followed = [];
        }
      } else if (Array.isArray(followed_barangays)) {
        followed = followed_barangays;
      }
    }

    // Include user's own barangay + followed barangays
    const allBarangays = [barangay, ...followed.map(f => f.brgyDesc)];

    //console.log("All barangays to fetch:", allBarangays);

    // Fetch announcements from own + followed barangays
    const announcementResult = await pool.query(
      `SELECT *
       FROM announcements
       WHERE region = $1 AND province = $2 AND city = $3
         AND barangay = ANY($4::text[])
       ORDER BY created_at DESC`,
      [region, province, city, allBarangays]
    );

    //console.log(`Announcements fetched: ${announcementResult.rows.length}`);
    res.json(announcementResult.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};


// =========================
// FOLLOW OTHER BARANGAY
// =========================

const followOtherBarangay = async (req, res) => {
  const { userId, brgyCode, brgyDesc } = req.body;

  try {
    // Get current follows
    const result = await pool.query(
      "SELECT followed_barangays FROM mobile_users WHERE id = $1",
      [userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let follows = result.rows[0].followed_barangays || [];

    // Parse if stored as string
    if (typeof follows === "string") {
      try {
        follows = JSON.parse(follows);
      } catch {
        follows = [];
      }
    }

    // Ensure follows is an array
    if (!Array.isArray(follows)) follows = [];

    // Avoid duplicates
    const alreadyFollowed = follows.some(f => f.brgyCode === brgyCode);
    if (!alreadyFollowed) {
      follows.push({ brgyCode, brgyDesc });
    }

    // Save back as JSON string
    await pool.query(
      "UPDATE mobile_users SET followed_barangays = $1 WHERE id = $2",
      [JSON.stringify(follows), userId]
    );

    res.json({ success: true, follows });
  } catch (error) {
    console.error("Follow error:", error);
    res.status(500).json({ success: false, error: "Something went wrong" });
  }
};




// =========================
// TOGGLE ANNOUNCEMENT LIKE
// =========================
const toggleLikeAnnouncement = async (req, res) => {
  const { userId, announcementId } = req.body;

  if (!userId || !announcementId) {
    return res.status(400).json({ message: "Missing userId or announcementId" });
  }

  try {
    // Check if already liked
    const check = await pool.query(
      "SELECT * FROM announcement_likes WHERE user_id = $1 AND announcement_id = $2",
      [userId, announcementId]
    );

    if (check.rows.length > 0) {
      // Already liked → remove like
      await pool.query(
        "DELETE FROM announcement_likes WHERE user_id = $1 AND announcement_id = $2",
        [userId, announcementId]
      );
    } else {
      // Not liked → insert like
      await pool.query(
        "INSERT INTO announcement_likes (announcement_id, user_id) VALUES ($1, $2)",
        [announcementId, userId]
      );
    }

    // Get updated like count
    const countResult = await pool.query(
      "SELECT COUNT(*) AS likes_count FROM announcement_likes WHERE announcement_id = $1",
      [announcementId]
    );

    // Optional: get all users who liked this announcement
    const usersResult = await pool.query(
      `SELECT u.id, u.first_name, u.last_name
       FROM mobile_users u
       JOIN announcement_likes al ON al.user_id = u.id
       WHERE al.announcement_id = $1`,
      [announcementId]
    );

    const liked = check.rows.length === 0; // if inserted now, liked = true
    const likesCount = parseInt(countResult.rows[0].likes_count);

    return res.json({ liked, likesCount, users: usersResult.rows });
  } catch (error) {
    console.error("Toggle like error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


// =========================
// GET ANNOUNCEMENT LIKES COUNT
// =========================
const getAnnouncementLikes = async (req, res) => {
  const { announcementId, userId } = req.params;

  try {
    // Total likes for everyone
    const countResult = await pool.query(
      "SELECT COUNT(*) AS likes_count FROM announcement_likes WHERE announcement_id = $1",
      [announcementId]
    );
    const likesCount = parseInt(countResult.rows[0].likes_count);

    // Whether this specific user liked it
    let liked = false;
    if (userId) {
      const userCheck = await pool.query(
        "SELECT 1 FROM announcement_likes WHERE announcement_id = $1 AND user_id = $2",
        [announcementId, userId]
      );
      liked = userCheck.rows.length > 0;
    }

    return res.json({
      liked,
      likesCount
    });
  } catch (error) {
    console.error("Get likes error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


// =========================
// ADD COMMENT TO ANNOUNCEMENT
// =========================
const addComment = async (req, res) => {
    const { userId, announcementId, commentText } = req.body;

    if (!userId || !announcementId || !commentText) {
        return res.status(400).json({ message: "Missing userId, announcementId, or commentText" });
    }

    try {
        // Insert comment
        const result = await pool.query(
            `INSERT INTO announcement_comments (announcement_id, user_id, comment_text)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [announcementId, userId, commentText]
        );

        return res.status(201).json({
            message: "Comment added successfully!",
            comment: result.rows[0]
        });
    } catch (error) {
        console.error("Add comment error:", error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};


// =========================
// GET COMMENTS FOR ANNOUNCEMENT
// =========================
const getComments = async (req, res) => {
    const { announcementId } = req.params;

    try {
        const result = await pool.query(
            `SELECT ac.id, ac.comment_text, ac.created_at, u.id AS user_id, u.first_name, u.last_name
             FROM announcement_comments ac
             JOIN mobile_users u ON u.id = ac.user_id
             WHERE ac.announcement_id = $1
             ORDER BY ac.created_at ASC`,
            [announcementId]
        );

        return res.json(result.rows);
    } catch (error) {
        console.error("Get comments error:", error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};


// =========================
// DELETE COMMENT
// =========================
const deleteComment = async (req, res) => {
    const { commentId, userId } = req.body;

    try {
        // Optional: Only allow the comment owner to delete
        const check = await pool.query(
            `SELECT * FROM announcement_comments WHERE id = $1 AND user_id = $2`,
            [commentId, userId]
        );

        if (!check.rows.length) {
            return res.status(403).json({ message: "You can only delete your own comment" });
        }

        await pool.query(`DELETE FROM announcement_comments WHERE id = $1`, [commentId]);

        return res.json({ message: "Comment deleted successfully" });
    } catch (error) {
        console.error("Delete comment error:", error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};




// =========================
// BARANGAY OFFICIALS
// =========================
const createOfficial = async (req, res) => {
  //console.log("📥 Incoming Official Creation Request");
  //console.log("📝 Data:", req.body);
  //console.log("📎 File:", req.file);

  const { 
    name, 
    position, 
    contact_number, 
    region, 
    province, 
    city, 
    barangay, 
    created_by 
  } = req.body;

  if (!name || !position || !contact_number || !region || !province || !city || !barangay || !created_by) {
    return res.status(400).json({ 
      message: "All required fields must be provided (name, position, contact_number, region, province, city, barangay, created_by)" 
    });
  }

  let profilePicture = null;
if (req.file) {
  profilePicture = {
    path: `uploads/officials/${req.file.filename}`,
    url: `${BASE_URL}/uploads/officials/${req.file.filename}` // use LAN IP here
  };
}


  try {
    const result = await pool.query(
      `INSERT INTO barangay_officials 
        (name, position, contact_number, profile_picture, region, province, city, barangay, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        name, 
        position, 
        contact_number, 
        profilePicture, // directly insert JSON (use json/jsonb column in DB)
        region,
        province,
        city,
        barangay,
        created_by
      ]
    );

    res.status(201).json({
      message: "✅ Official added successfully!",
      official: result.rows[0]
    });
  } catch (error) {
    console.error("❌ Create official error:", error);
    res.status(500).json({ message: "Failed to create official", error: error.message });
  }
};



// =========================
// GET ALL BARANGAY OFFICIALS
// =========================
const getOfficials = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM barangay_officials ORDER BY created_at DESC`
    );

    // No need to parse if stored as JSONB, just ensure null if empty
    const officials = result.rows.map(o => ({
      ...o,
      profile_picture: o.profile_picture || null
    }));

    res.status(200).json(officials);
  } catch (error) {
    console.error("❌ Fetch officials error:", error);
    res.status(500).json({ message: "Failed to fetch officials", error: error.message });
  }
};


// =========================
// DELETE OFFICIAL
// =========================
const deleteOfficial = async (req, res) => {
  const officialId = req.params.id;

  if (!officialId) {
    return res.status(400).json({ message: "officialId is required" });
  }

  try {
    await pool.query(`DELETE FROM barangay_officials WHERE id = $1`, [officialId]);
    res.json({ message: "✅ Official deleted successfully!" });
  } catch (error) {
    console.error("❌ Delete official error:", error);
    res.status(500).json({ message: "Failed to delete official", error: error.message });
  }
};


// =========================
// GET BARANGAY OFFICIALS (FILTERABLE)
// =========================
const getBarangayOfficialsForMobile = async (req, res) => {
  try {
    const { region, province, city, barangay } = req.query;
    console.log("📌 Incoming query params:", req.query);

    let query = 'SELECT * FROM barangay_officials';
    const params = [];
    const conditions = [];

    if (region) {
      params.push(region);
      conditions.push(`region = $${params.length}`);
    }
    if (province) {
      params.push(province);
      conditions.push(`province = $${params.length}`);
    }
    if (city) {
      params.push(city);
      conditions.push(`city = $${params.length}`);
    }
    if (barangay) {
      params.push(barangay);
      conditions.push(`barangay = $${params.length}`);
    }

    if (conditions.length) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    console.log("📌 Executing query:", query);
    console.log("📌 With params:", params);

    const result = await pool.query(query, params);
    console.log("✅ Fetched rows count:", result.rows.length);

    const officials = result.rows.map(o => ({
      ...o,
      profile_picture: o.profile_picture || null
    }));

    console.log("📌 Officials data:", officials);

    res.status(200).json(officials);
  } catch (error) {
    console.error("❌ Fetch officials error:", error);
    res.status(500).json({ message: "Failed to fetch officials", error: error.message });
  }
};


// =========================
// UNFOLLOW BARANGAY
// =========================
const unfollowBarangay = async (req, res) => {
  const { userId, brgyCode } = req.body;

  if (!userId || !brgyCode) {
    return res.status(400).json({ success: false, message: "userId and brgyCode are required" });
  }

  try {
    // Get current followed barangays
    const result = await pool.query(
      "SELECT followed_barangays FROM mobile_users WHERE id = $1",
      [userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let follows = result.rows[0].followed_barangays || [];

    // Parse if stored as string
    if (typeof follows === "string") {
      try {
        follows = JSON.parse(follows);
      } catch {
        follows = [];
      }
    }

    // Ensure follows is an array
    if (!Array.isArray(follows)) follows = [];

    // Remove the barangay with matching brgyCode
    const updatedFollows = follows.filter(f => f.brgyCode !== brgyCode);

    // Save back to DB
    await pool.query(
      "UPDATE mobile_users SET followed_barangays = $1 WHERE id = $2",
      [JSON.stringify(updatedFollows), userId]
    );

    res.json({ success: true, follows: updatedFollows });
  } catch (error) {
    console.error("Unfollow error:", error);
    res.status(500).json({ success: false, error: "Something went wrong" });
  }
};










module.exports = {
    createAnnouncement,
    getAnnouncements,
    getAnnouncementByUserLocation,
    followOtherBarangay,
    toggleLikeAnnouncement,
    getAnnouncementLikes,
    addComment,
    getComments,
    deleteComment,
    createOfficial,
    getOfficials,
    deleteOfficial,
    getBarangayOfficialsForMobile,
    unfollowBarangay,
    deleteAnnouncement
}