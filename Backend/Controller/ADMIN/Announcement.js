const pool = require('../../PostgreSQL/database');

const getTotalAnnouncements = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*) AS total FROM announcements');
    res.status(200).json({ total: rows[0].total });
  } catch (error) {
    console.error("Error fetching total reports:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Get all announcements
const getAllAnnouncements = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM announcements ORDER BY created_at DESC'); // assuming you have a created_at column
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching announcements:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

module.exports = {
    getTotalAnnouncements,
    getAllAnnouncements
};