const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://dnhgxfhdtvsblubwjmqt.supabase.co'; // From Supabase dashboard
const supabaseKey = process.env.SUPABASE_KEY; // Add to Render env (service_role key)

if (!supabaseKey) {
  throw new Error('❌ SUPABASE_SERVICE_KEY missing - add to env vars');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  global: {
    headers: { Authorization: `Bearer ${supabaseKey}` }, // Service role for server-side
  },
  // Optional: Custom fetch for retries (built-in, but can enhance)
});

async function queryWithRetry(table, options = {}, maxRetries = 3) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const { data, error } = await supabase.from(table).select(options); // Simplified; adjust for full ops
      if (error) throw error;
      return { data };
    } catch (err) {
      retries++;
      if (retries >= maxRetries) throw err;
      console.warn(`Retrying Supabase query (attempt ${retries})...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * retries));
    }
  }
}



module.exports = { supabase, queryWithRetry };