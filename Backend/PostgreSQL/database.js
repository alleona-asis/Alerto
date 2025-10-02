// Backend/Database Connection (database.js)
const { Pool } = require('pg');
require('dotenv').config();

// Global Node TLS bypass for Supabase pooler (essential for stubborn self-signed certs)
if (process.env.DB_ENV === 'supabase') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.log('🔓 Global Node TLS Bypass Enabled (Supabase Self-Signed Certs)');
}

let poolConfig;

if (process.env.DB_ENV === 'supabase') {
  console.log('💻 Connecting to Supabase Session Pooler...');
  const url = new URL(process.env.DATABASE_URL || '');
  console.log('DATABASE_URL Host:', url.hostname);
  console.log('DATABASE_URL Port:', url.port);
  console.log('DATABASE_URL SSL Mode:', url.searchParams.get('sslmode'));
  
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    // Aggressive multi-layer SSL bypass
    ssl: {
      rejectUnauthorized: false,     // Core bypass
      ca: false,                     // Skip CA chain
      checkServerIdentity: (host, cert) => {  // Ignore hostname mismatches
        return undefined;  // Allows pooler quirks
      }
    },
    // Render-optimized pool
    max: 15,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000,  // Ample for TLS + cold starts
    allowExitOnIdle: false
  };
  console.log('🔒 Full SSL Bypass Applied: rejectUnauthorized=false + ca=false + checkServerIdentity disabled');
} else {
  console.log('Connecting to Local PostgreSQL...');
  poolConfig = {
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: parseInt(process.env.PG_PORT) || 5432,
    ssl: false,
    max: 10,
    idleTimeoutMillis: 30000
  };
}

const pool = new Pool(poolConfig);

// Robust test with retries (for Render variability)
let testRetries = 0;
const maxRetries = 3;
const testQuery = async () => {
  try {
    const res = await pool.query('SELECT NOW() AS connected');
    console.log('✅ Database connected successfully:', res.rows[0].connected);
    console.log('🔥 Pool ready for Alerto: Auth, uploads (media jsonb), timers, concurrency');
  } catch (err) {
    console.error('❌ DB test error (attempt', ++testRetries, '/', maxRetries, '):', err.code, err.message);
    if (err.code === 'SELF_SIGNED_CERT_IN_CHAIN' && testRetries < maxRetries) {
      console.log('🔄 Retrying DB test (SSL warmup)...');
      setTimeout(testQuery, 3000);  // 3s wait
    } else if (err.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
      console.error('💡 Persistent SSL: Update pg to latest OR migrate to Railway (IPv6 Direct)');
    } else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      console.error('🌐 Network: Supabase "Allow all IPs" + correct password?');
    } else {
      console.error('🛠️ Other error: Check DATABASE_URL/creds');
    }
    // App runs anyway – queries retry
  }
};
testQuery();  // Start test

// Pool error handler (suppresses spam post-fix)
pool.on('error', (err) => {
  if (err.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
    console.log('🔄 Pool SSL retrying...');
  } else {
    console.error('Pool error:', err.code, err.message);
  }
});

module.exports = pool;
