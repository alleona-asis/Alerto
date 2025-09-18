const pool = require('../../PostgreSQL/database');

// Get all mobile users
const getMobileUsers = async (req, res) => {
  try {
    const { rows: users } = await pool.query(
      `SELECT * FROM mobile_users`
    );

    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching mobile users:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Delete mobile user by ID
const deleteMobileUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Delete notifications tied to this user
    await pool.query(`DELETE FROM notifications WHERE mobile_user_id = $1`, [id]);

    // Now delete the user
    const result = await pool.query(
      `DELETE FROM mobile_users WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User deleted successfully", user: result.rows[0] });
  } catch (error) {
    console.error("Error deleting mobile user:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

const getTotalMobileUsers = async (req, res) => {
  try {
    // Total mobile users
    const totalResult = await pool.query('SELECT COUNT(*) AS total FROM mobile_users');
    const total = totalResult.rows[0].total;

    // Generate monthly data with 0 for months with no users
    const graphResult = await pool.query(`
      WITH months AS (
        SELECT generate_series(1, 12) AS month
      )
      SELECT 
        TO_CHAR(to_date(months.month::text, 'MM'), 'Mon') AS label,
        COALESCE(count(mu.*), 0) AS value
      FROM months
      LEFT JOIN mobile_users mu
        ON EXTRACT(MONTH FROM mu.created_at) = months.month
        AND EXTRACT(YEAR FROM mu.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
      GROUP BY months.month
      ORDER BY months.month;
    `);

    const graphData = graphResult.rows;

    res.status(200).json({ total, graphData });

  } catch (error) {
    console.error("Error fetching mobile users:", error);
    res.status(500).json({ message: "Server Error" });
  }
};




module.exports = {
  getMobileUsers,
  deleteMobileUser,
  getTotalMobileUsers
};
