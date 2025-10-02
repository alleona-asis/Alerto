const pool = require('../../PostgreSQL/database');
const {supabase} = require('../../PostgreSQL/supabaseClient');

const allMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ==============================
//  GET TOTAL MOBILE USERS
// ==============================
const getTotalMobileUsers = async (req, res) => {
  try {
    const city = req.user?.city || req.query.city;
    const province = req.user?.province || req.query.province;
    const region = req.user?.region || req.query.region;

    if (!city || !province || !region) {
      return res.status(400).json({ message: "User location not found" });
    }

    // Total mobile users filtered by location
    const totalResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM mobile_users
       WHERE LOWER(TRIM(city)) = LOWER(TRIM($1))
         AND LOWER(TRIM(province)) = LOWER(TRIM($2))
         AND LOWER(TRIM(region)) = LOWER(TRIM($3))`,
      [city, province, region]
    );
    const total = totalResult.rows[0].total;

    const graphResult = await pool.query(
      `WITH months AS (
         SELECT generate_series(1, 12) AS month
       )
       SELECT 
         TO_CHAR(to_date(months.month::text, 'MM'), 'Mon') AS label,
         COALESCE(count(mu.*), 0) AS value
       FROM months
       LEFT JOIN mobile_users mu
         ON EXTRACT(MONTH FROM mu.created_at) = months.month
         AND EXTRACT(YEAR FROM mu.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
         AND LOWER(TRIM(mu.city)) = LOWER(TRIM($1))
         AND LOWER(TRIM(mu.province)) = LOWER(TRIM($2))
         AND LOWER(TRIM(mu.region)) = LOWER(TRIM($3))
       GROUP BY months.month
       ORDER BY months.month`,
      [city, province, region]
    );

    const graphData = graphResult.rows.map(row => ({
      label: row.label,
      value: Number(row.value)
    }));

    res.status(200).json({ total, graphData });

  } catch (error) {
    console.error("Error fetching mobile users:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


// =================================================
//  GET ALL MOBILE USERS
// =================================================
const getMobileUsers = async (req, res) => {
  try {
    const { province, region, city } = req.query;

    if (!province || !region || !city) {
      return res.status(400).json({ message: "User location not found" });
    }

    const { rows: reports } = await pool.query(
      `SELECT *
       FROM mobile_users
       WHERE province = $1
         AND region = $2
         AND city = $3`,
      [province, region, city]
    );

    res.status(200).json(reports);
  } catch (error) {
    console.error("Error fetching incident reports:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// =================================================
//  DELETE MOBILE USER
// =================================================
const deleteMobileUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Mobile user ID is required" });
    }

    // Start a transaction
    await pool.query('BEGIN');

    // Delete notifications related to the mobile user
    await pool.query(
      `DELETE FROM notifications WHERE mobile_user_id = $1`,
      [id]
    );

    // Delete the mobile user
    const result = await pool.query(
      `DELETE FROM mobile_users
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: "Mobile user not found" });
    }

    await pool.query('COMMIT');
    res.status(200).json({ message: "Mobile user deleted successfully", deletedUser: result.rows[0] });

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error("Error deleting mobile user:", error);
    res.status(500).json({ message: "Server Error" });
  }
};



module.exports = {
  getTotalMobileUsers,
  getMobileUsers,
  deleteMobileUser
};