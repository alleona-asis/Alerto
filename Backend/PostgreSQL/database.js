const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dnhgxfhdtvsblubwjmqt.supabase.co'; // Your project URL
const supabaseKey = process.env.SUPABASE_KEY; // Add this env var in Render (from Supabase > Settings > API > project API keys > service_role)

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${supabaseKey}` } },
});

// Test function
async function testConnection() {
  try {
    const { data, error } = await supabase.from('pg_tables').select('tablename').limit(1); // Simple schema check
    if (error) throw error;
    console.log('✅ Supabase connected successfully via JS client');
  } catch (err) {
    console.error('❌ Supabase connection error:', err.message);
  }
}

module.exports = { supabase, testConnection };
