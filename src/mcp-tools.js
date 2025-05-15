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
        }
      },
      "required": ["query"]
    }
  },
  {
    "name": "get-webdna-doc",
    "description": "Retrieves detailed documentation for a specific WebDNA instruction or context by its ID. Returns full documentation including syntax, parameters, examples, and related instructions.",
    "parameters": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "The ID of the WebDNA instruction or context to retrieve documentation for"
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
  }
];

module.exports = {
  mcp_tools
};
