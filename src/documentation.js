const { supabase, cachedQuery } = require('./database');

/**
 * Search for WebDNA documentation based on a query
 * @param {string} query - The search query
 * @param {Object} options - Search options
 * @param {number} options.limit - Maximum number of results (default: 20)
 * @param {number} options.offset - Offset for pagination (default: 0)
 * @param {string} options.category - Filter by category (optional)
 * @returns {Promise<Array>} - Array of matching documentation entries
 */
async function searchDocumentation(query, options = {}) {
  const { limit = 20, offset = 0, category = null } = options;
  
  try {
    // Normalize query
    const normalizedQuery = query.trim().toLowerCase();
    
    // Generate cache key
    const cacheKey = `search:${normalizedQuery}:${limit}:${offset}:${category || 'all'}`;
    
    return await cachedQuery(cacheKey, async () => {
      // First try exact match on instruction name
      let exactMatchQuery = supabase
        .from('documentation')
        .select(`
          id,
          instruction,
          description,
          url,
          webdna_id,
          categories(id, name)
        `)
        .ilike('instruction', `%${normalizedQuery}%`)
        .order('instruction');
        
      // Add category filter if provided
      if (category) {
        exactMatchQuery = exactMatchQuery
          .eq('categories.name', category);
      }
      
      const { data: exactMatches, error: exactError } = await exactMatchQuery;
      
      if (exactError) throw exactError;
      
      // Then try full-text search
      let ftsQuery = supabase
        .from('documentation')
        .select(`
          id,
          instruction,
          description,
          url,
          webdna_id,
          categories(id, name)
        `)
        .textSearch('search_vector', normalizedQuery, {
          type: 'websearch',
          config: 'english'
        });
        
      // Add category filter if provided
      if (category) {
        ftsQuery = ftsQuery
          .eq('categories.name', category);
      }
      
      const { data: ftsMatches, error: ftsError } = await ftsQuery;
      
      if (ftsError) throw ftsError;
      
      // Combine results, removing duplicates
      const seen = new Set();
      const results = [];
      
      // Process exact matches first (higher priority)
      exactMatches.forEach(match => {
        seen.add(match.id);
        results.push({
          id: match.id,
          instruction: match.instruction,
          category: match.categories?.name || 'Uncategorized',
          category_id: match.categories?.id,
          description: match.description,
          url: match.url,
          webdna_id: match.webdna_id,
          match_type: 'exact',
          relevance_score: 1.0 // Highest score for exact matches
        });
      });
      
      // Process full-text search matches with relevance scoring
      ftsMatches.forEach(match => {
        if (!seen.has(match.id)) {
          seen.add(match.id);
          
          // Calculate relevance score based on position of query in text
          // This is a simplified approach - could be more sophisticated
          let relevanceScore = 0.5; // Base score for FTS matches
          
          if (match.instruction.toLowerCase().includes(normalizedQuery)) {
            // Boost score if query appears in instruction name
            relevanceScore += 0.3;
          }
          
          if (match.description?.toLowerCase().includes(normalizedQuery)) {
            // Boost score if query appears in description
            relevanceScore += 0.1;
          }
          
          results.push({
            id: match.id,
            instruction: match.instruction,
            category: match.categories?.name || 'Uncategorized',
            category_id: match.categories?.id,
            description: match.description,
            url: match.url,
            webdna_id: match.webdna_id,
            match_type: 'content',
            relevance_score: relevanceScore
          });
        }
      });
      
      // Sort by relevance score (descending)
      results.sort((a, b) => b.relevance_score - a.relevance_score);
      
      // Apply pagination
      return {
        results: results.slice(offset, offset + limit),
        total_count: results.length,
        offset,
        limit,
        query: normalizedQuery
      };
    }, 5 * 60 * 1000); // Cache for 5 minutes
  } catch (error) {
    console.error('Error searching documentation:', error);
    throw error;
  }
}

/**
 * Get a specific WebDNA documentation entry by ID or name
 * @param {number|string} idOrName - The documentation ID, WebDNA ID, or instruction name
 * @returns {Promise<Object>} - The documentation entry
 */
async function getDocumentationById(idOrName) {
  try {
    // Generate cache key
    const cacheKey = `doc:${idOrName}`;
    
    return await cachedQuery(cacheKey, async () => {
      // Determine if id is numeric (database id), webdna_id, or instruction name
      const isNumeric = /^\d+$/.test(idOrName);
      
      let query = supabase
        .from('documentation')
        .select(`
          *,
          categories(id, name)
        `);
      
      if (isNumeric) {
        query = query.eq('id', idOrName);
      } else {
        // Try webdna_id first, then instruction name
        query = query.eq('webdna_id', idOrName);
      }
      
      let { data, error } = await query.maybeSingle();
      
      // If not found by webdna_id, try instruction name
      if (!data && !isNumeric) {
        ({ data, error } = await supabase
          .from('documentation')
          .select(`
            *,
            categories(id, name)
          `)
          .ilike('instruction', idOrName)
          .maybeSingle());
      }
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        throw error;
      }
      
      if (!data) return null;
      
      // Process related documentation if available
      let relatedDocs = [];
      if (data.related && Array.isArray(data.related) && data.related.length > 0) {
        const { data: related, error: relatedError } = await supabase
          .from('documentation')
          .select('id, instruction, description, url, webdna_id')
          .in('id', data.related);
        
        if (!relatedError && related) {
          relatedDocs = related;
        }
      }
      
      // Format the response
      return {
        ...data,
        category_name: data.categories?.name || 'Uncategorized',
        category_id: data.categories?.id,
        related_docs: relatedDocs
      };
    }, 15 * 60 * 1000); // Cache for 15 minutes
  } catch (error) {
    console.error('Error getting documentation by ID:', error);
    throw error;
  }
}

/**
 * Get all WebDNA documentation categories
 * @returns {Promise<Array>} - Array of categories
 */
async function getCategories() {
  try {
    return await cachedQuery('categories', async () => {
      // Get all categories
      const { data: categories, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (categoriesError) throw categoriesError;
      
      // Get count of instructions per category
      const { data: counts, error: countsError } = await supabase
        .from('documentation')
        .select('category_id, count(*)', { count: 'exact' })
        .group('category_id');
      
      if (countsError) throw countsError;
      
      // Map counts to categories
      const countMap = {};
      counts.forEach(item => {
        countMap[item.category_id] = parseInt(item.count);
      });
      
      // Combine data
      return categories.map(category => ({
        ...category,
        instruction_count: countMap[category.id] || 0
      }));
    }, 30 * 60 * 1000); // Cache for 30 minutes
  } catch (error) {
    console.error('Error getting categories:', error);
    throw error;
  }
}

/**
 * Get random WebDNA documentation entries
 * @param {number} limit - Maximum number of entries to return
 * @returns {Promise<Array>} - Array of random documentation entries
 */
async function getRandomDocumentation(limit = 5) {
  try {
    // Generate new results every time, don't cache
    const { data, error } = await supabase
      .from('documentation')
      .select(`
        id,
        instruction,
        description,
        url,
        webdna_id,
        categories(id, name)
      `)
      .order('id', { ascending: false }) // Using 'random' doesn't work well in RLS
      .limit(limit);
    
    if (error) throw error;
    
    return data.map(doc => ({
      id: doc.id,
      instruction: doc.instruction,
      category: doc.categories?.name || 'Uncategorized',
      category_id: doc.categories?.id,
      description: doc.description,
      url: doc.url,
      webdna_id: doc.webdna_id
    }));
  } catch (error) {
    console.error('Error getting random documentation:', error);
    throw error;
  }
}

/**
 * Get the total count of documentation entries
 * @returns {Promise<number>} - Total count
 */
async function getDocumentationCount() {
  try {
    return await cachedQuery('doc_count', async () => {
      const { count, error } = await supabase
        .from('documentation')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      
      return count || 0;
    }, 60 * 60 * 1000); // Cache for 1 hour
  } catch (error) {
    console.error('Error getting documentation count:', error);
    throw error;
  }
}

module.exports = {
  searchDocumentation,
  getDocumentationById,
  getCategories,
  getRandomDocumentation,
  getDocumentationCount
};