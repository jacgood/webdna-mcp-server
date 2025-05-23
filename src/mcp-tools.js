/**
 * MCP Tool definitions for WebDNA documentation
 */
const mcp_tools = [
  {
    "name": "search-webdna-docs",
    "description": "Searches WebDNA documentation for specific instructions, contexts, or keywords. Returns matching documentation entries with descriptions and links to full documentation.",
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "The search query for WebDNA documentation (e.g., 'table', 'database', 'search')"
        },
        "category": {
          "type": "string",
          "description": "Optional: Filter results by category name"
        },
        "limit": {
          "type": "integer",
          "description": "Optional: Maximum number of results to return (default: 20)",
          "default": 20
        },
        "offset": {
          "type": "integer",
          "description": "Optional: Offset for pagination (default: 0)",
          "default": 0
        }
      },
      "required": ["query"]
    }
  },
  {
    "name": "get-webdna-doc",
    "description": "Retrieves detailed documentation for a specific WebDNA instruction or context by its ID or name. Returns full documentation including syntax, parameters, examples, and related instructions.",
    "parameters": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "The ID, WebDNA ID, or instruction name of the WebDNA instruction or context to retrieve documentation for"
        }
      },
      "required": ["id"]
    }
  },
  {
    "name": "get-webdna-categories",
    "description": "Retrieves all WebDNA documentation categories with the count of instructions in each category. Useful for exploring the WebDNA framework structure.",
    "parameters": {
      "type": "object",
      "properties": {}
    }
  },
  {
    "name": "get-random-webdna-docs",
    "description": "Retrieves a random selection of WebDNA documentation entries. Useful for exploration and discovery of WebDNA features.",
    "parameters": {
      "type": "object",
      "properties": {
        "limit": {
          "type": "integer",
          "description": "Optional: Maximum number of random entries to return (default: 5)",
          "default": 5
        }
      }
    }
  },
  {
    "name": "get-webdna-stats",
    "description": "Retrieves statistics about the WebDNA documentation database, including total number of instructions, categories, and recent additions.",
    "parameters": {
      "type": "object",
      "properties": {}
    }
  }
];

module.exports = {
  mcp_tools
};