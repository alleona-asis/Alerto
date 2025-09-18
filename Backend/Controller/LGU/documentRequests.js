const pool = require('../../PostgreSQL/database');
const path = require('path');
const fs = require('fs');
const { getIo } = require('../../socket');

const getDocumentRequests = async (req, res) => {
  try {
    const { province, region, city } = req.query;

    if (!province || !region || !city) {
      return res.status(400).json({ message: "User location not found" });
    }

    const { rows: reports } = await pool.query(
      `SELECT *
       FROM document_requests
       WHERE province = $1
         AND region = $2
         AND city = $3
       ORDER BY document_type DESC`,
      [province, region, city]
    );

    res.status(200).json(reports);
  } catch (error) {
    console.error("Error fetching incident reports:", error);
    res.status(500).json({ message: "Server Error" });
  }
};



// ✅ Delete Document Request
const deleteDocumentRequest = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Request ID is required" });
    }

    // Check if document exists
    const { rows } = await pool.query(
      `SELECT * FROM document_requests WHERE id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Document request not found" });
    }

    // If there’s an uploaded file path, delete it from filesystem
    if (rows[0].file_path) {
      const filePath = path.join(__dirname, "../../uploads", rows[0].file_path);
      fs.unlink(filePath, (err) => {
        if (err) {
          console.warn("File not found or already deleted:", filePath);
        }
      });
    }

    // Delete from DB
    await pool.query(`DELETE FROM document_requests WHERE id = $1`, [id]);

    // Emit socket update if needed
    const io = getIo();
    io.emit("documentRequestDeleted", { id });

    res.status(200).json({ message: "Document request deleted successfully" });
  } catch (error) {
    console.error("Error deleting document request:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


module.exports = {
    getDocumentRequests,
    deleteDocumentRequest
}