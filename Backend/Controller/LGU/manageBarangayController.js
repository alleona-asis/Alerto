const pool = require('../../PostgreSQL/database');
const bcrypt = require('bcrypt'); 

// =================================================
//  ADDING BARANGAY
// =================================================
  const addBarangay = async (req, res) => {
  const {
    lgu_id,
    region,
    province,
    city,
    created_by,
    barangay_name,
    barangay_captain,
    phone_number,
    barangay_address,
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO barangays (
        lgu_id,
        region,
        province,
        city_or_municipality,
        created_by,
        barangay_name,
        barangay_captain,
        phone_number,
        barangay_address,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
      ) RETURNING *`,
      [
        lgu_id,
        region,
        province,
        city,
        created_by,
        barangay_name,
        barangay_captain,
        phone_number,
        barangay_address,
      ]
    );

    console.log('✅ Barangay added:', result.rows[0]);
    res.status(201).json({ barangay: result.rows[0] });
  } catch (error) {
    console.error('❌ Error adding barangay:', error.message);
    res.status(500).json({ error: 'Failed to add barangay.' });
  }
};

// =================================================
//  GET ALL BARANGAYS
// =================================================
const getAllBarangays = async (req, res) => {
  const { region, province, city } = req.query;

  if (!region || !province || !city) {
    return res.status(400).json({ message: 'Missing region, province, or city' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM barangays WHERE region = $1 AND province = $2 AND city_or_municipality = $3 ORDER BY barangay_name ASC',
      [region, province, city]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching barangays:', error);
    res.status(500).json({ message: 'Failed to retrieve barangays' });
  }
};

// =================================================
//  DELETE BARANGAY
// =================================================
const deleteBarangay = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: 'Barangay ID is required' });
  }

  try {
    // Step 1: Get the barangay name before deleting it
    const barangayResult = await pool.query('SELECT barangay_name FROM barangays WHERE id = $1', [id]);
    
    if (barangayResult.rowCount === 0) {
      return res.status(404).json({ message: 'Barangay not found' });
    }

    const barangayName = barangayResult.rows[0].barangay_name;

    // Step 2: Delete barangay user accounts first
    await pool.query('DELETE FROM barangay_accounts WHERE barangay = $1', [barangayName]);

    // Step 3: Delete the barangay itself
    const deleteResult = await pool.query('DELETE FROM barangays WHERE id = $1 RETURNING *', [id]);

    res.status(200).json({ message: 'Barangay and its user accounts deleted successfully' });

  } catch (error) {
    console.error('Error deleting barangay and user accounts:', error);
    res.status(500).json({ message: 'Failed to delete barangay' });
  }
};


// ==============================
// ADD BARANGAY ACCOUNT
// ==============================
const addBarangayUserAccount = async (req, res) => {
  const {
    username,
    firstName,
    lastName,
    password,
    phonenumber,
    position,
    lguId,
    region,
    province,
    city,
    barangay,
    created_by,
  } = req.body;

  // Basic validation
  if (
    !username || !firstName || !lastName || !password || !phonenumber || !position ||
    !lguId || !region || !province || !city || !barangay || !created_by
  ) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    // Check if username already exists
    const existing = await pool.query(
      'SELECT * FROM barangay_accounts WHERE username = $1',
      [username]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username already exists.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert into database
    const result = await pool.query(
      `INSERT INTO barangay_accounts (
        username, first_name, last_name, password, phone_number, position, lgu_id,
        region, province, city, barangay, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        username,
        firstName,
                lastName,
        hashedPassword,
        phonenumber,
        position,
        lguId,
        region,
        province,
        city,
        barangay,
        created_by,
      ]
    );

    res.status(201).json({
      message: 'Barangay account created successfully.',
      account: result.rows[0]
    });
  } catch (error) {
    console.error('Error inserting barangay account:', error);
    res.status(500).json({ error: 'Failed to create barangay account.' });
  }
};



// ==============================
// VIEW CREATED ACCOUNTS BY LGU
// ==============================
const viewCreatedBarangayAccounts = async (req, res) => {
  const { lguId, barangay } = req.params;
  console.log('[DEBUG] Received params:', { lguId, barangay });

  try {
    const query = `SELECT * FROM barangay_accounts WHERE lgu_id = $1 AND barangay = $2`;
    console.log('[DEBUG] Executing SQL:', query);
    const result = await pool.query(query, [lguId, barangay]);

    console.log('[DEBUG] Query result:', result.rows);
    res.json(result.rows);
  } catch (err) {
    console.error('[ERROR] Error fetching barangay accounts:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};


const editBarangayDetails = async (req, res) => {
  const { id } = req.params;
  const {
    barangay_name,
    barangay_captain,
    phone_number,
    barangay_address,
    created_by,
    lgu_id,
  } = req.body;

  try {
    await pool.query(
      `UPDATE barangays 
       SET barangay_name = $1, 
           barangay_captain = $2, 
           phone_number = $3, 
           barangay_address = $4, 
           created_by = $5, 
           lgu_id = $6
       WHERE id = $7`,
      [
        barangay_name,
        barangay_captain,
        phone_number,
        barangay_address,
        created_by,
        lgu_id,
        id,
      ]
    );
    res.json({ message: 'Barangay updated successfully.' });
  } catch (err) {
    console.error('Error updating barangay:', err);
    res.status(500).json({ message: 'Update failed' });
  }
};


// =================================================
//  CALL BARANGAY ASSISTANCE (BY ID or LOCATION)
// =================================================
const callBarangayAssistance = async (req, res) => {
  const { barangay_id, region, province, city, barangay } = req.body;

  try {
    let query, values;

    if (barangay_id) {
      query = `
        SELECT phone_number, barangay_name, city_or_municipality, province, region
        FROM barangays
        WHERE id = $1
      `;
      values = [barangay_id];
      console.log("📡 Querying by ID:", values);
    } else if (region && province && city && barangay) {
      query = `
        SELECT phone_number, barangay_name, city_or_municipality, province, region
        FROM barangays
        WHERE region = $1 AND province = $2 AND city_or_municipality = $3 AND barangay_name = $4
        LIMIT 1
      `;
      values = [region, province, city, barangay];
      console.log("📡 Querying by Location:", values);
    } else {
      return res.status(400).json({ message: "Provide either barangay_id or location details." });
    }

    const result = await pool.query(query, values);
    console.log("✅ Query result:", result.rows);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Barangay not found.", criteria: values });
    }

    const {
      phone_number,
      barangay_name: brgyName,
      city_or_municipality,
      province: prov,
      region: reg,
    } = result.rows[0];

    return res.status(200).json({
      barangay_name: brgyName,
      phone_number,
      city: city_or_municipality,
      province: prov,
      region: reg,
      message: `Use this number to call the barangay assistance: ${phone_number}`,
    });
  } catch (error) {
    console.error("❌ Error fetching barangay info:", error);
    return res.status(500).json({ message: "Failed to retrieve barangay information." });
  }
};





module.exports = { 
  addBarangay,
  getAllBarangays,
  deleteBarangay,
  addBarangayUserAccount,
  viewCreatedBarangayAccounts,
  editBarangayDetails,
  callBarangayAssistance
};
