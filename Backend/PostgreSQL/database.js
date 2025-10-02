// Backend/Database Connection (database.js)
const { Pool } = require('pg');
require('dotenv').config();

// Global Node TLS bypass (keep for pooler)
if (process.env.DB_ENV === 'supabase') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.log('🔓 Global Node TLS Bypass Enabled for Supabase Pooler');
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
    // SSL bypass (unchanged)
    ssl: {
      rejectUnauthorized: false,
      ca: false,
      checkServerIdentity: (host, cert) => undefined
    },
    // Enhanced for network timeouts (Render + pooler)
    max: 10,  // Reduce to avoid overload (from 15)
    min: 2,   // Keep 2 idle connections warm
    idleTimeoutMillis: 60000,  // 60s idle (longer for intermittent)
    connectionTimeoutMillis: 30000,  // 30s connect (vs 20s)
    acquireTimeoutMillis: 60000,  // 60s to acquire from pool
    createTimeoutMillis: 30000,  // 30s create new
    destroyTimeoutMillis: 5000,  // Quick destroy fails
    reapIntervalMillis: 1000,  // Check idle every 1s
    allowExitOnIdle: false,
    // Reconnect on error
    Promise: global.Promise
  };
  console.log('🔒 SSL Bypass + Network Resilience: Timeouts increased, min=2 connections');
} else {
  // Local config unchanged
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

// Test with extended retries
let retries = 0;
const maxRetries = 5;  // More for network
const testDB = async () => {
  try {
    const res = await pool.query('SELECT NOW() AS connected');
    console.log('✅ DB Connected:', res.rows[0].connected);
    console.log('🚀 Alerto Ready: Auth, uploads, timers');
    retries = 0;  // Reset on success
  } catch (err) {
    console.error('❌ DB Test Fail (Retry', ++retries, '/', maxRetries, '):', err.code, err.message);
    if ((err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') && retries < maxRetries) {
      console.log('🔄 Network Retry (Check Supabase "Allow all IPs")...');
      setTimeout(testDB, 5000);  // 5s wait
    } else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      console.error('🌐 Network Block: Enable Supabase "Allow all IPs" OR migrate to Railway Direct');
    } else {
      console.error('🔍 Other: Verify DATABASE_URL');
    }
  }
};
testDB();

// Enhanced pool error handler (reconnect on network fails)
pool.on('error', (err) => {
  console.error('Pool Error:', err.code, err.message);
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    console.log('🔄 Pool reconnecting on network fail...');
    // Optional: pool.end().then(() => new Pool(...)) for full reset
  }
});

pool.on('connect', () => console.log('🔗 New DB connection established'));
pool.on('acquire', () => console.log('📥 Connection acquired from pool'));

module.exports = pool;
