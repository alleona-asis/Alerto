const pool = require('../../PostgreSQL/database');
const fs = require('fs');
const path = require('path');

// =================================================
// GET ALL PENDING ACCOUNTS
// =================================================
const getPendingAccount = async (req, res) => {
  try {
    console.log('Request to fetch all pending LGU accounts received.');
    const result = await pool.query(
      `SELECT * FROM admin_accounts WHERE LOWER(status) = $1 AND LOWER(role) = $2`,
      ['pending', 'local government unit']
    );

    //console.log('Found pending accounts:', result.rows);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching pending LGU accounts:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// =================================================
// TO MARK AS READ
// =================================================
const markAsRead = async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name } = req.body;
  const adminName = `${first_name} ${last_name}`;

  console.log(`Mark as read request received for account ID: ${id} by admin: ${adminName}`);

  try {
    const result = await pool.query(
    `UPDATE admin_accounts
    SET is_read = TRUE, read_by = $1, read_at = NOW()
    WHERE id = $2
    RETURNING *`,
    [adminName, id]
  );


    if (result.rowCount === 0) {
      console.warn(`No account found with ID: ${id}`);
      return res.status(404).json({ error: 'Account not found' });
    }

    console.log(`Account ID: ${id} marked as read by ${adminName}`, result.rows[0]);
    res.status(200).json({ message: 'Marked as read', data: result.rows[0] });
  } catch (err) {
    console.error('Failed to mark as read:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// =================================================
// DELETE OLD NOTIFICATIONS
// =================================================
const deleteNotification = async (req, res) => {
  const { id } = req.params;

  console.log(`Delete request received for account ID: ${id}`);

  try {
    const result = await pool.query(
      `DELETE FROM admin_accounts WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      console.warn(`No notification found with ID: ${id}`);
      return res.status(404).json({ error: 'Notification not found' });
    }

    console.log(`Notification ID: ${id} deleted from database.`);
    res.status(200).json({ message: 'Notification deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Failed to delete notification:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// =================================================
// UPDATE ACCOUNT STATUS
// =================================================
const updateLGUAccountStatus = async (req, res) => {
  const { id } = req.params;
  const { status, action_by } = req.body;

  try {
    const result = await pool.query(
      `UPDATE admin_accounts
       SET status = $1,
           action_by = $2
       WHERE id = $3
       RETURNING *`,
      [status, action_by, id]
    );

    console.log(`LGU account ${id} ${status} by ${action_by}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating LGU account status:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// =================================================
// GET APPROVED AND REJECTED LGU ACCOUNTS
// =================================================
const getLGUAccounts = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM admin_accounts 
       WHERE LOWER(status) IN ($1, $2) 
       AND LOWER(role) = $3`,
      ['approved', 'rejected', 'local government unit']
    );
    //console.log('🔎 Found LGU accounts (approved + rejected):', result.rows);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching LGU accounts:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// =================================================
// DELETE LGU ACCOUNTS
// =================================================
const deleteLGUAccount = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid ID' });

    const { rows } = await pool.query('SELECT * FROM admin_accounts WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Account not found' });

    const { upload_id_filename: idFile, upload_letter_filename: letterFile } = rows[0];

    [ 
      { file: idFile, folder: 'id' },
      { file: letterFile, folder: 'letter' }
    ].forEach(({ file, folder }) => {
      if (!file) return;
      const filePath = path.join(process.cwd(), 'uploads', folder, file);
      console.log(`🔍 Deleting: ${filePath}`);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Deleted: ${filePath}`);
        } else {
          console.warn(`File not found: ${filePath}`);
        }
      } catch (err) {
        console.error(`Error deleting ${filePath}:`, err);
      }
    });

    await pool.query('DELETE FROM admin_accounts WHERE id = $1', [id]);
    res.status(200).json({ message: 'Account and files deleted successfully' });
  } catch (err) {
    console.error('DELETE ACCOUNT ERROR:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};


const getTotalLGUAccounts = async (req, res) => {
  try {
    // Get total LGU accounts with role = 'Local Government Unit'
    const totalRes = await pool.query(`
      SELECT COUNT(*) AS total 
      FROM "admin_accounts" 
      WHERE role = 'Local Government Unit'
    `);
    //console.log('Total LGU Accounts Result:', totalRes.rows);

    // Get count by status for LGU accounts only
    const statusRes = await pool.query(`
      SELECT status, COUNT(*) AS value
      FROM "admin_accounts"
      WHERE role = 'Local Government Unit'
      GROUP BY status
    `);
    //console.log('LGU Accounts Status Result:', statusRes.rows);

    res.status(200).json({
      total: parseInt(totalRes.rows[0].total),
      graphData: statusRes.rows // [{ status: 'Approved', value: 5 }, ...]
    });
  } catch (error) {
    console.error("Error fetching total LGU accounts:", error);
    res.status(500).json({ message: "Server Error" });
  }
};








module.exports = {
    getPendingAccount,
    markAsRead,
    deleteNotification,
    updateLGUAccountStatus,
    getLGUAccounts,
    deleteLGUAccount,
    getTotalLGUAccounts
};