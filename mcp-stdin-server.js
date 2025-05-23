#!/usr/bin/env node

/**
 * WebDNA MCP Server using stdin/stdout for communication
 * This version doesn't require HTTP ports and works directly with Windsurf
 */

require('dotenv').config();
const readline = require('readline');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// Import MCP tools from external file
const { mcp_tools } = require('./src/mcp-tools');

// Import database and documentation modules
const { initializeDatabase } = require('./src/database');
const { 
  searchDocumentation, 
  getDocumentationById, 
  getCategories,
  getRandomDocumentation,
  getDocumentationCount
} = require('./src/documentation');

// Configure logging
const LOG_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const LOG_FILE = path.join(LOG_DIR, `mcp-stdin-server-${new Date().toISOString().split('T')[0]}.log`);
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

// Log to stderr for debugging (won't interfere with stdout communication)
const log = (message, data = null) => {
  const timestamp = new Date().toISOString();
  let logString = `[${timestamp}] ${message}`;
  
  if (data) {
    if (typeof data === 'object') {
      logString += ` ${JSON.stringify(data)}`;
    } else {
      logString += ` ${data}`;
    }
  }
  
  console.error(logString);
  logStream.write(logString + '\n');
};

// Set up readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Track connected status for rate limiting and health monitoring
let isConnected = false;
let messageCount = 0;
let lastMessageTime = Date.now();
const startTime = Date.now();

// Initialize the system
async function initialize() {
  try {
    log('Initializing WebDNA MCP Server (stdin/stdout)...');
    
    // Initialize database
    await initializeDatabase();
    
    isConnected = true;
    log('WebDNA MCP Server (stdin/stdout) initialization complete');
  } catch (error) {
    log(`Error during initialization: ${error.message}`);
  }
}

// Handle incoming messages
rl.on('line', async (line) => {
  messageCount++;
  lastMessageTime = Date.now();
  
  try {
    const message = JSON.parse(line);
    log(`Received message: ${message.type}`);
    
    switch (message.type) {
      case 'init':
        // Respond to initialization
        await initialize();
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
        await handleToolInvocation(message);
        break;
        
      default:
        log(`Unknown message type: ${message.type}`);
    }
  } catch (error) {
    log(`Error processing message: ${error.message}`);
    log(`Problematic line: ${line}`);
    
    // If there's a message ID, send an error response
    try {
      const message = JSON.parse(line);
      if (message.id) {
        sendMessage({
          type: 'tool_error',
          id: message.id,
          error: {
            message: `Error processing request: ${error.message}`
          }
        });
      }
    } catch (parseError) {
      // If we can't parse the message, we can't send a proper error response
      log(`Cannot parse message to send error response: ${parseError.message}`);
    }
  }
});

// Send a message to stdout
function sendMessage(message) {
  console.log(JSON.stringify(message));
}

// Handle tool invocation
async function handleToolInvocation(message) {
  const { tool, id = uuidv4(), params } = message;
  log(`Invoking tool: ${tool} with params:`, params);
  
  try {
    switch (tool) {
      case 'search-webdna-docs':
        const searchResults = await searchDocumentation(
          params.query,
          {
            limit: params.limit,
            offset: params.offset,
            category: params.category
          }
        );
        
        sendMessage({
          type: 'tool_result',
          id,
          result: searchResults
        });
        break;
        
      case 'get-webdna-doc':
        const docResult = await getDocumentationById(params.id);
        
        if (!docResult) {
          sendMessage({
            type: 'tool_error',
            id,
            error: {
              message: `Documentation not found for ID: ${params.id}`
            }
          });
          return;
        }
        
        sendMessage({
          type: 'tool_result',
          id,
          result: {
            doc: docResult
          }
        });
        break;
        
      case 'get-webdna-categories':
        const categories = await getCategories();
        
        sendMessage({
          type: 'tool_result',
          id,
          result: {
            categories
          }
        });
        break;
        
      case 'get-random-webdna-docs':
        const randomDocs = await getRandomDocumentation(params.limit || 5);
        
        sendMessage({
          type: 'tool_result',
          id,
          result: {
            docs: randomDocs
          }
        });
        break;
        
      case 'get-webdna-stats':
        const docCount = await getDocumentationCount();
        const statsCategories = await getCategories();
        
        sendMessage({
          type: 'tool_result',
          id,
          result: {
            total_docs: docCount,
            total_categories: statsCategories.length,
            server_uptime: Math.floor((Date.now() - startTime) / 1000),
            server_version: require('./package.json').version
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
  } catch (error) {
    log(`Error invoking tool ${tool}: ${error.message}`);
    
    sendMessage({
      type: 'tool_error',
      id,
      error: {
        message: `Error invoking tool ${tool}: ${error.message}`
      }
    });
  }
}

// Handle process termination
process.on('SIGINT', () => {
  log('Received SIGINT, shutting down');
  logStream.end();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down');
  logStream.end();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log(`Uncaught exception: ${error.message}`, error.stack);
  // Keep running despite the error
});

// Send a ping every 30 seconds to keep the connection alive
setInterval(() => {
  if (isConnected) {
    sendMessage({
      type: 'ping',
      id: uuidv4(),
      timestamp: Date.now(),
      uptime: Math.floor((Date.now() - startTime) / 1000)
    });
  }
}, 30000);

// Monitor system health
setInterval(() => {
  const timeSinceLastMessage = Date.now() - lastMessageTime;
  log(`Health check: Connected=${isConnected}, Messages=${messageCount}, Last message=${Math.floor(timeSinceLastMessage / 1000)}s ago, Uptime=${Math.floor((Date.now() - startTime) / 1000)}s`);
}, 60000);

log('WebDNA MCP Server (stdin/stdout) starting...');

// Initialize the server
initialize().then(() => {
  log('WebDNA MCP Server (stdin/stdout) ready');
});