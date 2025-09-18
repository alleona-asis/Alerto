const pool = require('../../PostgreSQL/database');
const fs = require('fs');
const path = require('path');

// =================================================
//  GET ALL BARANGAY REPORT
// =================================================

const getAllPins = async (req, res) => {
  try {
    const city = req.user?.city || req.query.city;
    const province = req.user?.province || req.query.province;
    const region = req.user?.region || req.query.region;

    if (!city || !province || !region) {
      return res.status(400).json({ message: "User location not found" });
    }

    const { rows } = await pool.query(
      `SELECT *
       FROM incident_reports
       WHERE LOWER(TRIM(city)) = LOWER(TRIM($1))
         AND LOWER(TRIM(province)) = LOWER(TRIM($2))
         AND LOWER(TRIM(region)) = LOWER(TRIM($3))
       ORDER BY incident_date DESC`,
      [city, province, region]
    );

    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching pins:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


const getBarangayReports = async (req, res) => {
  try {
    const { province, region, city } = req.query;

    if (!province || !region || !city) {
      return res.status(400).json({ message: "User location not found" });
    }

    const { rows: reports } = await pool.query(
      `SELECT *
       FROM incident_reports
       WHERE province = $1
         AND region = $2
         AND city = $3
       ORDER BY incident_date DESC`,
      [province, region, city]
    );

    res.status(200).json(reports);
  } catch (error) {
    console.error("Error fetching incident reports:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// =================================================
//  GET TOTAL REPORTS (FILTERED BY USER LOCATION)
// =================================================
const allMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const getTotalReports = async (req, res) => {
  try {
    const city = req.user?.city || req.query.city;
    const province = req.user?.province || req.query.province;
    const region = req.user?.region || req.query.region;

    if (!city || !province || !region) {
      return res.status(400).json({ message: "User location not found" });
    }

    // =============================
    // TOTAL REPORTS (LOCATION FILTER)
    // =============================
    const { rows: totalRows } = await pool.query(
      `SELECT COUNT(*) AS total
       FROM incident_reports
       WHERE LOWER(TRIM(city)) = LOWER(TRIM($1))
         AND LOWER(TRIM(province)) = LOWER(TRIM($2))
         AND LOWER(TRIM(region)) = LOWER(TRIM($3))`,
      [city, province, region]
    );

    // =============================
    // REPORTS PER MONTH × BARANGAY
    // =============================
    const { rows: monthBarangayRows } = await pool.query(
      `SELECT 
          TO_CHAR(incident_date, 'Mon') AS month,
          barangay,
          COUNT(*) AS total
       FROM incident_reports
       WHERE LOWER(TRIM(city)) = LOWER(TRIM($1))
         AND LOWER(TRIM(province)) = LOWER(TRIM($2))
         AND LOWER(TRIM(region)) = LOWER(TRIM($3))
       GROUP BY month, barangay
       ORDER BY month, barangay`,
      [city, province, region]
    );

    // Find all distinct barangays
    const allBarangays = [...new Set(monthBarangayRows.map(r => r.barangay))];

    // Build graphData: one object per month with barangay counts
    const graphData = allMonths.map(month => {
      const row = { label: month };
      allBarangays.forEach(b => {
        const found = monthBarangayRows.find(r => r.month === month && r.barangay === b);
        row[b] = found ? Number(found.total) : 0;
      });
      return row;
    });

    // =============================
    // DEBUG LOGGING
    // =============================
    console.log("=== Debug: Reports Per Month × Barangay ===");
    graphData.forEach(row => {
      console.log(row);
    });
    console.log("===========================================");

    res.status(200).json({ 
      total: totalRows[0].total, 
      graphData,
      barangays: allBarangays
    });

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