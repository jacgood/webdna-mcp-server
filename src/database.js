require('dotenv').config();
const { supabase } = require('./supabase');

/**
 * Execute SQL query directly on Supabase PostgreSQL database
 * @param {string} query - SQL query to execute
 * @param {Object} params - Query parameters to prevent SQL injection
 * @returns {Promise<Object>} - Query result
 */
async function executeSql(query, params = {}) {
  try {
    const { data, error } = await supabase.rpc('execute_sql', { 
      query,
      params: JSON.stringify(params)
    });
    
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
 * Check if a table exists
 * @param {string} tableName - Name of the table to check
 * @returns {Promise<boolean>} - Whether the table exists
 */
async function tableExists(tableName) {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      if (error.code === 'PGRST116' || error.code === '42P01') {
        return false; // Table doesn't exist
      }
      throw error;
    }
    
    return true;
  } catch (error) {
    if (error.code === 'PGRST116' || error.code === '42P01') {
      return false; // Table doesn't exist
    }
    console.error(`Error checking if table ${tableName} exists:`, error);
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
    const categoryTableExists = await tableExists('categories');
    const documentationTableExists = await tableExists('documentation');
    
    if (!categoryTableExists || !documentationTableExists) {
      console.log('Tables missing, running migration scripts...');
      try {
        const fs = require('fs');
        const path = require('path');
        const migrationPath = path.join(__dirname, '../migrations/01_initial_setup.sql');
        
        if (fs.existsSync(migrationPath)) {
          const migrationSql = fs.readFileSync(migrationPath, 'utf8');
          await executeSql(migrationSql);
          console.log('Migration completed successfully');
        } else {
          console.error('Migration file not found at:', migrationPath);
        }
      } catch (migrationError) {
        console.error('Error running migration:', migrationError);
      }
    }
    
    // Get current tables state
    if (categoryTableExists) {
      const { count: categoriesCount } = await supabase
        .from('categories')
        .select('*', { count: 'exact', head: true });
      
      console.log(`Categories table exists with ${categoriesCount} rows`);
    }
    
    if (documentationTableExists) {
      const { count: docsCount } = await supabase
        .from('documentation')
        .select('*', { count: 'exact', head: true });
      
      console.log(`Documentation table exists with ${docsCount} rows`);
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

// Create a cache for frequently used queries
const queryCache = new Map();

/**
 * Executes a cached database query
 * @param {string} cacheKey - Unique key for caching
 * @param {Function} queryFn - Function that returns a Supabase query promise
 * @param {number} ttl - Cache TTL in milliseconds (default: 5 minutes)
 * @returns {Promise<any>} - Query result
 */
async function cachedQuery(cacheKey, queryFn, ttl = 5 * 60 * 1000) {
  const now = Date.now();
  
  if (queryCache.has(cacheKey)) {
    const { data, timestamp } = queryCache.get(cacheKey);
    
    // Return cached data if still valid
    if (now - timestamp < ttl) {
      return data;
    }
  }
  
  // Execute the query function
  const data = await queryFn();
  
  // Cache the result
  queryCache.set(cacheKey, {
    data,
    timestamp: now
  });
  
  return data;
}

/**
 * Clear the query cache
 * @param {string} cacheKey - Optional specific cache key to clear
 */
function clearQueryCache(cacheKey = null) {
  if (cacheKey) {
    queryCache.delete(cacheKey);
  } else {
    queryCache.clear();
  }
}

module.exports = {
  initializeDatabase,
  getDb,
  closeDatabase,
  supabase,
  executeSql,
  cachedQuery,
  clearQueryCache,
  tableExists
};