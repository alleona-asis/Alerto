// Backend/Database Connection 
const { Pool } = require('pg');
require('dotenv').config();

if (process.env.DB_ENV === 'supabase') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.log('🔓 Global Node TLS Bypass Enabled for Supabase Pooler');
}

let poolConfig;

if (process.env.DB_ENV === 'supabase') {
  console.log('Connecting to Supabase Session Pooler...');
  const url = new URL(process.env.DATABASE_URL || '');
  // console.log('DATABASE_URL Host:', url.hostname);
  // console.log('DATABASE_URL Port:', url.port);
  // console.log('DATABASE_URL SSL Mode:', url.searchParams.get('sslmode'));
  
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
      ca: false,
      checkServerIdentity: (host, cert) => undefined  
    },
    max: 10,                 
    min: 2,                  
    idleTimeoutMillis: 60000, 
    connectionTimeoutMillis: 30000,  
    acquireTimeoutMillis: 60000,     
    createTimeoutMillis: 30000,     
    destroyTimeoutMillis: 5000,     
    reapIntervalMillis: 1000,        
    allowExitOnIdle: false,
    Promise: global.Promise  
  };
  console.log('SSL Bypass + Network Resilience: Timeouts tuned, min=2 connections');
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

// Initial test (silent after first success)
let testRetries = 0;
const maxRetries = 5;
let hasConnected = false;
const testDB = async () => {
  if (hasConnected) return;  // Skip if already successful
  try {
    const res = await pool.query('SELECT NOW() AS connected');
    console.log('✅ DB Connected:', res.rows[0].connected);
    // console.log('🚀 Alerto Ready: Auth, uploads (media jsonb), timers, concurrency');
    hasConnected = true;
    testRetries = 0;
  } catch (err) {
    console.error('❌ DB Test Fail (Retry', ++testRetries, '/', maxRetries, '):', err.code, err.message);
    if ((err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') && testRetries < maxRetries) {
      console.log(' Network Retry (Verify Supabase "Allow all IPs")...');
      setTimeout(testDB, 5000);
    } else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      console.error('Network Issue: Enable Supabase "Allow all IPs" or migrate to Railway (IPv6 Direct)');
    } else {
      console.error('Other Error: Check DATABASE_URL/creds');
    }
  }
};
testDB();

// Pool event handlers (minimal logging)
pool.on('error', (err) => {
  console.error('Pool Error:', err.code, err.message);
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    console.log('🔄 Pool attempting reconnect on network fail...');
    // Optional full reset (uncomment for aggressive recovery):
    // pool.end().then(() => {
    //   console.log('🔄 Pool reset complete');
    //   const newPool = new Pool(poolConfig);
    //   Object.keys(newPool).forEach(key => { if (key !== 'config') module.exports[key] = newPool[key]; });
    // });
  }
});


module.exports = pool;
