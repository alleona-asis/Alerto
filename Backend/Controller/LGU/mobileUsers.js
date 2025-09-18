const pool = require('../../PostgreSQL/database');

const allMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const getTotalMobileUsers = async (req, res) => {
  try {
    // Accept filters from req.user or query params
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

    // Generate monthly data with 0 for months with no users
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

module.exports = {
  getTotalMobileUsers
};
