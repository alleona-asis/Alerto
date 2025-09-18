const bcrypt = require('bcrypt');
const pool = require('./PostgreSQL/database');

async function seedSuperAdmin() {
    const username = 'root@admin34';
    const firstName = 'Rico';
    const lastName = 'Blanco';
    const password = await bcrypt.hash('root@password34', 10);
    const role = 'Super Admin';

   

    try {
        const exists = await pool.query('SELECT * FROM admin_accounts WHERE username = $1 AND role = $2', [username, role]);
        if (exists.rows.length === 0) {
            await pool.query(
                `INSERT INTO admin_accounts (username, first_name, last_name, password, role, status)
                VALUES ($1, $2, $3, $4, $5, $6)`,
                [username, firstName, lastName, password, role, 'approved']
            );
            console.log('Super Admin Account Created');
        } 
        else {
            console.log('Super Admin Already Exists');
        }
    } 
    catch (err) {
        console.error('Error Creating Super Admin:', err.message);
    }
}

seedSuperAdmin();