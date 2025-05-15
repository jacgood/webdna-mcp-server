#!/usr/bin/env node

/**
 * WebDNA MCP Server using stdin/stdout for communication
 * This version doesn't require HTTP ports and works directly with Windsurf
 */

const readline = require('readline');
const { v4: uuidv4 } = require('uuid');

// Define MCP tools
const mcp_tools = [
  {
    "name": "search-webdna-docs",
    "description": "Searches WebDNA documentation for specific instructions, contexts, or keywords.",
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
    "description": "Retrieves detailed documentation for a specific WebDNA instruction or context by its ID.",
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
    "description": "Retrieves all WebDNA documentation categories with the count of instructions in each category.",
    "parameters": {
      "type": "object",
      "properties": {}
    }
  }
];

// Set up readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Log to stderr for debugging (won't interfere with stdout communication)
const log = (message) => {
  console.error(`[${new Date().toISOString()}] ${message}`);
};

log('WebDNA MCP Server (stdin/stdout) starting...');

// Handle incoming messages
rl.on('line', (line) => {
  try {
    const message = JSON.parse(line);
    log(`Received message: ${message.type}`);
    
    switch (message.type) {
      case 'init':
        // Respond to initialization
        sendMessage({
          type: 'ready'
        });
        break;
        
      case 'list_tools':
        // Send available tools
        sendMessage({
          type: 'tools',
          tools: mcp_tools
        });
        break;
        
      case 'invoke_tool':
        // Handle tool invocation
        handleToolInvocation(message);
        break;
        
      default:
        log(`Unknown message type: ${message.type}`);
    }
  } catch (error) {
    log(`Error processing message: ${error.message}`);
    log(`Problematic line: ${line}`);
  }
});

// Send a message to stdout
function sendMessage(message) {
  console.log(JSON.stringify(message));
}

// Handle tool invocation
function handleToolInvocation(message) {
  const { tool, id, params } = message;
  log(`Invoking tool: ${tool} with params: ${JSON.stringify(params)}`);
  
  switch (tool) {
    case 'search-webdna-docs':
      // Mock implementation - in a real scenario, this would query your database
      sendMessage({
        type: 'tool_result',
        id,
        result: {
          results: [
            { id: 'table', name: 'table', description: 'Creates a database table' },
            { id: 'search', name: 'search', description: 'Searches for records in a database' },
            { id: 'sql', name: 'sql', description: 'Executes SQL queries' }
          ]
        }
      });
      break;
      
    case 'get-webdna-doc':
      // Mock implementation
      sendMessage({
        type: 'tool_result',
        id,
        result: {
          doc: {
            id: params.id || 'unknown',
            name: params.id || 'Unknown',
            description: `Documentation for ${params.id || 'unknown'}`,
            syntax: `[${params.id || 'unknown'}]`,
            examples: `Example usage of [${params.id || 'unknown'}]`
          }
        }
      });
      break;
      
    case 'get-webdna-categories':
      // Mock implementation
      sendMessage({
        type: 'tool_result',
        id,
        result: {
          categories: [
            { id: 1, name: 'Databases & Tables', count: 14 },
            { id: 2, name: 'Text Manipulation', count: 19 },
            { id: 3, name: 'Browser Info', count: 14 }
          ]
        }
      });
      break;
      
    default:
      log(`Unknown tool: ${tool}`);
      sendMessage({
        type: 'tool_error',
        id,
        error: {
          message: `Unknown tool: ${tool}`
        }
      });
  }
}

// Handle process termination
process.on('SIGINT', () => {
  log('Received SIGINT, shutting down');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down');
  process.exit(0);
});

// Send a ping every 30 seconds to keep the connection alive
setInterval(() => {
  sendMessage({
    type: 'ping',
    id: uuidv4()
  });
}, 30000);

log('WebDNA MCP Server (stdin/stdout) ready');
