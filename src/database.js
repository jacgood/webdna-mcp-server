require('dotenv').config();
const { supabase } = require('./supabase');

/**
 * Execute SQL query directly on Supabase PostgreSQL database
 * @param {string} query - SQL query to execute
 * @returns {Promise<Object>} - Query result
 */
async function executeSql(query) {
  try {
    const { data, error } = await supabase.rpc('execute_sql', { query });
    
    if (error) {
      console.error('SQL execution failed:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error executing SQL:', error);
    throw error;
  }
}

/**
 * Initialize the database and create tables if they don't exist
 */
async function initializeDatabase() {
  try {
    console.log('Setting up Supabase database...');
    
    // Check if tables exist
    try {
      // Check categories table
      const { count: categoriesCount, error: categoriesError } = await supabase
        .from('categories')
        .select('*', { count: 'exact', head: true });
      
      if (categoriesError) {
        console.error('Error checking categories table:', categoriesError);
      } else {
        console.log(`Categories table exists with ${categoriesCount} rows`);
      }
      
      // Check documentation table
      const { count: docsCount, error: docsError } = await supabase
        .from('documentation')
        .select('*', { count: 'exact', head: true });
      
      if (docsError) {
        console.error('Error checking documentation table:', docsError);
      } else {
        console.log(`Documentation table exists with ${docsCount} rows`);
      }
    } catch (error) {
      console.error('Error checking tables:', error);
    }
    
    console.log('Supabase database setup completed successfully');
    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

/**
 * Get database instance (for compatibility with previous code)
 */
function getDb() {
  return supabase;
}

/**
 * Close database connection (no-op for Supabase, included for compatibility)
 */
async function closeDatabase() {
  console.log('No need to close Supabase connection');
  return true;
}

module.exports = {
  initializeDatabase,
  getDb,
  closeDatabase,
  supabase,
  executeSql
};
