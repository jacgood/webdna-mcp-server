require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
// You'll need to set these environment variables with your Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Validate required environment variables
if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_KEY environment variables must be set');
  process.exit(1);
}

// Create Supabase client with advanced options
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    // Configure fetch options for all requests
    fetch: (url, options) => {
      const timeout = 30000; // 30 second timeout
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      
      return fetch(url, {
        ...options,
        signal: controller.signal,
      }).finally(() => clearTimeout(id));
    }
  },
  // Configure database options
  db: {
    schema: 'public'
  },
  // Add retry logic
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

/**
 * Test the Supabase connection to verify credentials
 * @returns {Promise<boolean>} Connection status
 */
async function testConnection() {
  try {
    const { data, error } = await supabase.from('categories').select('count(*)', { count: 'exact', head: true });
    
    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error testing Supabase connection:', error);
    return false;
  }
}

module.exports = {
  supabase,
  testConnection
};