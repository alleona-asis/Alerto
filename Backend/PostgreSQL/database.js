// Backend/Database Connection (db.js or pool.js)
const { Pool } = require('pg');
require('dotenv').config(); // Load environment variables

let poolConfig;

if (process.env.DB_ENV === 'supabase') {
  console.log('Connecting to Supabase database...');
    const url = new URL(process.env.DATABASE_URL);
      console.log('DATABASE_URL Host:', url.hostname);
      console.log('DATABASE_URL Port:', url.port);
      console.log('DATABASE_URL Params:', url.search);  
    poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },  // Required for Supabase
  };
} else {
  console.log('Connecting to Local PostgreSQL...');
  poolConfig = {
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: parseInt(process.env.PG_PORT) || 5432,
    ssl: false, // local DB usually doesn’t need SSL
  };
}

const pool = new Pool(poolConfig);

// for test connection
pool.connect()
  .then(() => console.log('Database connected successfully'))
  .catch(err => console.error('Database connection error:', err.message));
  pool.on('connect', () => console.log('✅ Pool Connection Established'));
     pool.on('error', (err) => {
       console.error('❌ Pool Error:', err.code, err.message);
       if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
         console.error('💡 Check Supabase IP allowlist and direct host');
       }
     });
     // Startup test (should log success now)
     (async () => {
       console.log('🧪 Running startup DB test...');
       try {
         const client = await pool.connect();
         const res = await client.query('SELECT NOW() as time, version() as pg_version');
         console.log('🕐 Direct Connection Success - Time:', res.rows[0].time);
         console.log('📋 Postgres Version:', res.rows[0].pg_version);
         client.release();
       } catch (err) {
         console.error('🚨 Startup Test Failed:', err.message);
         console.log('Masked URL:', process.env.DATABASE_URL?.replace(/:(?!\/\/)[^@]+@/, ':[MASKED]@'));
       }
     })();
     module.exports = pool;