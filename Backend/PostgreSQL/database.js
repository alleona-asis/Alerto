// Backend/Database Connection (db.js or pool.js)
const { Pool } = require('pg');
require('dotenv').config(); // Load environment variables

let poolConfig;

if (process.env.DB_ENV === 'supabase') {
  console.log('Connecting to Supabase database...');
    const url = new URL(process.env.DATABASE_URL);
      console.log('DATABASE_URL Host:', url.hostname);
      console.log('DATABASE_URL Port:', url.port);
  console.log('DATABASE_URL SSL Mode:', url.searchParams.get('sslmode'));
    poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { 
      rejectUnauthorized: false 
    },  // Required for Supabase
        // Pooler tweaks for Alerto concurrency
    max: 15,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,  // Longer for SSL handshake (Render cold starts)
    allowExitOnIdle: false
  };
    console.log('SSL Config Applied: rejectUnauthorized = false');
} else {
  console.log('Connecting to Local PostgreSQL...');
  poolConfig = {
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: parseInt(process.env.PG_PORT) || 5432,
    ssl: false, 
  };
}

const pool = new Pool(poolConfig);

// // for test connection
// pool.connect()
//   .then(() => console.log('Database connected successfully'))
//   .catch(err => console.error('Database connection error:', err.message));
  
// Enhanced test: Query with SSL handling
pool.query('SELECT NOW() AS connected')
  .then((res) => {
    console.log('✅ Database connected successfully:', res.rows[0].connected);
    console.log('Pool ready for Alerto (auth, uploads, timers)');
  })
  .catch((err) => {
    console.error('❌ Database connection/query error:', err.code, err.message);
    if (err.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
      console.error('SSL Issue: Ensure ssl: { rejectUnauthorized: false } in poolConfig');
    } else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      console.error('Network/Auth: Check Supabase network restrictions/password');
    }
    // App continues – pool retries on next query
  });
// Pool error listener (catches SSL/runtime issues)
pool.on('error', (err) => {
  console.error('Pool error (e.g., SSL or overload):', err.code, err.message);
});

module.exports = pool;