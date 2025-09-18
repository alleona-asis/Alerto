const pool = require('../../PostgreSQL/database');
const fs = require('fs');
const path = require('path');

// =================================================
//  GET ALL BARANGAY REPORT
// =================================================

const getAllPins = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM incident_reports');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching pins:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


const getBarangayReports = async (req, res) => {
  try {
    const { rows: reports } = await pool.query(
      `SELECT *
       FROM incident_reports
       ORDER BY incident_date DESC`
    );

    res.status(200).json(reports);
  } catch (error) {
    console.error("Error fetching incident reports:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// =================================================
//  GET TOTAL REPORTS
// =================================================
const allMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const getTotalReports = async (req, res) => {
  try {
    const { rows: totalRows } = await pool.query('SELECT COUNT(*) AS total FROM incident_reports');

    const { rows: monthRows } = await pool.query(`
      SELECT TO_CHAR(incident_date, 'Mon') AS label,
             COUNT(*) AS value
      FROM incident_reports
      GROUP BY TO_CHAR(incident_date, 'Mon')
    `);

    // Map DB results to include all months, even with 0
    const graphData = allMonths.map(month => {
      const existing = monthRows.find(r => r.label === month);
      return existing ? { label: month, value: Number(existing.value) } : { label: month, value: 0 };
    });

    res.status(200).json({ total: totalRows[0].total, graphData });

  } catch (error) {
    console.error("Error fetching total reports:", error);
    res.status(500).json({ message: "Server Error" });
  }
};








module.exports = {
    getAllPins,
    getBarangayReports,
    getTotalReports
};