const { supabase } = require('./database');

/**
 * Search for WebDNA documentation based on a query
 * @param {string} query - The search query
 * @returns {Promise<Array>} - Array of matching documentation entries
 */
async function searchDocumentation(query) {
  try {
    // First try exact match on instruction name
    const { data: exactMatches, error: exactError } = await supabase
      .from('documentation')
      .select(`
        id,
        instruction,
        description,
        url,
        webdna_id,
        categories(name)
      `)
      .ilike('instruction', `%${query}%`)
      .order('instruction');
    
    if (exactError) throw exactError;
    
    // Then try full-text search
    const { data: ftsMatches, error: ftsError } = await supabase
      .from('documentation')
      .select(`
        id,
        instruction,
        description,
        url,
        webdna_id,
        categories(name)
      `)
      .textSearch('search_vector', query, {
        type: 'websearch',
        config: 'english'
      });
    
    if (ftsError) throw ftsError;
    
    // Combine results, removing duplicates
    const seen = new Set();
    const results = [];
    
    // Process exact matches
    exactMatches.forEach(match => {
      seen.add(match.id);
      results.push({
        id: match.id,
        instruction: match.instruction,
        category: match.categories?.name || 'Uncategorized',
        description: match.description,
        url: match.url,
        webdna_id: match.webdna_id,
        match_type: 'exact'
      });
    });
    
    // Process full-text search matches
    ftsMatches.forEach(match => {
      if (!seen.has(match.id)) {
        seen.add(match.id);
        results.push({
          id: match.id,
          instruction: match.instruction,
          category: match.categories?.name || 'Uncategorized',
          description: match.description,
          url: match.url,
          webdna_id: match.webdna_id,
          match_type: 'content'
        });
      }
    });
    
    return results;
  } catch (error) {
    console.error('Error searching documentation:', error);
    throw error;
  }
}

/**
 * Get a specific WebDNA documentation entry by ID
 * @param {number|string} id - The documentation ID or WebDNA ID
 * @returns {Promise<Object>} - The documentation entry
 */
async function getDocumentationById(id) {
  try {
    // Check if id is numeric (database id) or string (webdna_id)
    const isNumeric = /^\d+$/.test(id);
    
    let query = supabase
      .from('documentation')
      .select(`
        *,
        categories(name)
      `);
    
    if (isNumeric) {
      query = query.eq('id', id);
    } else {
      query = query.eq('webdna_id', id);
    }
    
    const { data, error } = await query.single();
    
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
        .select('id, instruction, url, webdna_id')
        .in('id', data.related);
      
      if (!relatedError) {
        relatedDocs = related;
      }
    }
    
    // Format the response
    return {
      ...data,
      category_name: data.categories?.name || 'Uncategorized',
      related_docs: relatedDocs
    };
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
    // Get all categories
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('*');
    
    if (categoriesError) throw categoriesError;
    
    // Get count of instructions per category
    const { data: counts, error: countsError } = await supabase
      .from('documentation')
      .select('category_id, count')
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
  } catch (error) {
    console.error('Error getting categories:', error);
    throw error;
  }
}

module.exports = {
  searchDocumentation,
  getDocumentationById,
  getCategories
};
