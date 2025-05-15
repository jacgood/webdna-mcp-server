const axios = require('axios');
const cheerio = require('cheerio');
const { supabase, initializeDatabase } = require('./database');

// Base URL for WebDNA documentation
const BASE_URL = 'https://docs.webdna.us';

/**
 * Main function to scrape WebDNA documentation
 */
async function scrapeDocumentation() {
  try {
    console.log('Starting WebDNA documentation scraping...');
    
    // Initialize database
    await initializeDatabase();
    
    // Scrape categories and instructions from "At A Glance" page
    const categories = await scrapeCategories();
    
    // Insert categories into database
    for (const category of categories) {
      const categoryId = await insertCategory(category);
      
      // Scrape and insert instructions for this category
      for (const instruction of category.instructions) {
        await scrapeAndInsertInstruction(instruction, category.name, categoryId);
        // Add a small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log('WebDNA documentation scraping completed successfully!');
  } catch (error) {
    console.error('Error scraping WebDNA documentation:', error);
  }
}

/**
 * Scrape categories and their instructions from the "At A Glance" page
 */
async function scrapeCategories() {
  try {
    console.log('Scraping categories from "At A Glance" page...');
    
    const response = await axios.get(`${BASE_URL}/at-a-glance`);
    const $ = cheerio.load(response.data);
    const categories = [];
    
    // Find all h5 elements (category headers)
    $('h5.card-title').each((index, element) => {
      // Extract category name (removing the icon text)
      const categoryName = $(element).find('.card-title-text').text().trim();
      const instructions = [];
      
      // Find the card-text div that follows this h5
      const cardText = $(element).next('.card-text');
      
      // Find all links within the card-text div
      cardText.find('a').each((i, link) => {
        const instructionName = $(link).text().trim();
        const instructionUrl = $(link).attr('href');
        
        if (instructionName && instructionUrl) {
          // Extract WebDNA ID from URL
          const webdnaId = extractWebDnaId(instructionUrl);
          
          instructions.push({
            name: instructionName,
            url: instructionUrl,
            webdna_id: webdnaId
          });
        }
      });
      
      categories.push({
        name: categoryName,
        instructions
      });
    });
    
    console.log(`Found ${categories.length} categories with a total of ${categories.reduce((sum, cat) => sum + cat.instructions.length, 0)} instructions`);
    return categories;
  } catch (error) {
    console.error('Error scraping categories:', error);
    throw error;
  }
}

/**
 * Scrape an individual instruction page and insert into database
 */
async function scrapeAndInsertInstruction(instruction, categoryName, categoryId) {
  try {
    console.log(`Scraping instruction: ${instruction.name} (${instruction.url})`);
    
    // Check if instruction already exists in database
    const existingInstruction = await checkInstructionExists(instruction.webdna_id);
    if (existingInstruction) {
      console.log(`Instruction ${instruction.name} already exists in database, skipping...`);
      return;
    }
    
    // If categoryId is not provided, try to get it
    if (!categoryId) {
      const fetchedCategoryId = await getCategoryId(categoryName);
      if (!fetchedCategoryId) {
        console.error(`Category ${categoryName} not found in database`);
        return;
      }
      categoryId = fetchedCategoryId;
    }
    
    // Scrape instruction page
    const fullUrl = instruction.url.startsWith('http') ? instruction.url : `${BASE_URL}${instruction.url}`;
    const response = await axios.get(fullUrl);
    const $ = cheerio.load(response.data);
    
    // Extract instruction details
    const description = $('article p').first().text().trim();
    
    // Extract syntax
    let syntax = '';
    $('pre code').each((index, element) => {
      const codeText = $(element).text().trim();
      if (codeText.includes('[') && codeText.includes(']')) {
        syntax = codeText;
        return false; // Break the loop after finding the first syntax block
      }
    });
    
    // Extract parameters
    let parameters = '';
    $('h3').each((index, element) => {
      if ($(element).text().trim().toLowerCase().includes('parameter')) {
        let paramContent = '';
        let currentElement = $(element).next();
        
        while (currentElement.length && !currentElement.is('h3')) {
          paramContent += $.html(currentElement);
          currentElement = currentElement.next();
        }
        
        parameters = paramContent.trim();
        return false; // Break the loop after finding parameters section
      }
    });
    
    // Extract examples
    let examples = '';
    $('h3').each((index, element) => {
      if ($(element).text().trim().toLowerCase().includes('example')) {
        let exampleContent = '';
        let currentElement = $(element).next();
        
        while (currentElement.length && !currentElement.is('h3')) {
          exampleContent += $.html(currentElement);
          currentElement = currentElement.next();
        }
        
        examples = exampleContent.trim();
        return false; // Break the loop after finding examples section
      }
    });
    
    // Insert instruction into database
    await insertInstruction({
      instruction: instruction.name,
      category_id: categoryId,
      description,
      syntax,
      parameters,
      examples,
      url: fullUrl,
      webdna_id: instruction.webdna_id,
      related: []
    });
    
    console.log(`Successfully scraped and inserted instruction: ${instruction.name}`);
  } catch (error) {
    console.error(`Error scraping instruction ${instruction.name}:`, error);
  }
}

/**
 * Insert a category into the database
 */
async function insertCategory(category) {
  try {
    // Check if category already exists
    const { data: existingCategory } = await supabase
      .from('categories')
      .select('id')
      .eq('name', category.name)
      .single();
    
    if (existingCategory) {
      console.log(`Category ${category.name} already exists with ID ${existingCategory.id}`);
      return existingCategory.id;
    }
    
    // Insert new category
    const { data, error } = await supabase
      .from('categories')
      .insert({ name: category.name })
      .select('id')
      .single();
    
    if (error) {
      console.error(`Error inserting category ${category.name}:`, error);
      throw error;
    }
    
    console.log(`Inserted category ${category.name} with ID ${data.id}`);
    return data.id;
  } catch (error) {
    console.error(`Error in insertCategory for ${category.name}:`, error);
    throw error;
  }
}

/**
 * Get a category ID by name
 */
async function getCategoryId(categoryName) {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id')
      .eq('name', categoryName)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw error;
    }
    
    return data ? data.id : null;
  } catch (error) {
    console.error(`Error getting category ID for ${categoryName}:`, error);
    throw error;
  }
}

/**
 * Check if an instruction already exists in the database
 */
async function checkInstructionExists(webdnaId) {
  try {
    const { data, error } = await supabase
      .from('documentation')
      .select('id')
      .eq('webdna_id', webdnaId)
      .maybeSingle();
    
    if (error) throw error;
    
    return data ? true : false;
  } catch (error) {
    console.error(`Error checking if instruction exists for ${webdnaId}:`, error);
    throw error;
  }
}

/**
 * Insert an instruction into the database
 */
async function insertInstruction(instruction) {
  try {
    const { data, error } = await supabase
      .from('documentation')
      .insert({
        instruction: instruction.instruction,
        category_id: instruction.category_id,
        description: instruction.description,
        syntax: instruction.syntax,
        parameters: instruction.parameters,
        examples: instruction.examples,
        url: instruction.url,
        webdna_id: instruction.webdna_id,
        related: instruction.related || []
      })
      .select('id')
      .single();
    
    if (error) {
      console.error(`Error inserting instruction ${instruction.instruction}:`, error);
      throw error;
    }
    
    return data.id;
  } catch (error) {
    console.error(`Error in insertInstruction for ${instruction.instruction}:`, error);
    throw error;
  }
}

/**
 * Extract WebDNA ID from URL
 */
function extractWebDnaId(url) {
  const match = url.match(/\/([^\/]+)\/([^\/]+)$/);
  return match ? match[2] : url;
}

// Run the scraper if this file is executed directly
if (require.main === module) {
  scrapeDocumentation()
    .then(() => {
      console.log('Scraping completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Error during scraping:', error);
      process.exit(1);
    });
}

module.exports = {
  scrapeDocumentation
};
