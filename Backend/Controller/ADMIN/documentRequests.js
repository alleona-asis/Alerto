const pool = require('../../PostgreSQL/database');
const path = require('path');
const fs = require('fs');
const { getIo } = require('../../socket');

const getDocumentRequests = async (req, res) => {
  try {
    const { rows: reports } = await pool.query(
      `SELECT *
       FROM document_requests
       ORDER BY created_at DESC` // latest first
    );

    res.status(200).json(reports);
  } catch (error) {
    console.error("Error fetching document requests:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// =================================================
//  GET TOTAL REPORTS
// =================================================
const getTotalRequests = async (req, res) => {
  try {
    const totalRes = await pool.query('SELECT COUNT(*) AS total FROM document_requests');
    const graphRes = await pool.query(`
      SELECT document_type AS label, COUNT(*)::int AS value 
      FROM document_requests 
      GROUP BY document_type
    `);

    res.status(200).json({
      total: Number(totalRes.rows[0].total),
      graphData: graphRes.rows
    });
  } catch (error) {
    console.error("Error fetching document requests:", error);
    res.status(500).json({ message: "Server Error" });
  }
};







module.exports = {
    getDocumentRequests,
    getTotalRequests
}