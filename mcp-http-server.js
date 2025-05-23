#!/usr/bin/env node

/**
 * WebDNA MCP HTTP Server
 * This server exposes the MCP stdin/stdout protocol via HTTP endpoints
 * It acts as a bridge between HTTP clients and the MCP stdin/stdout server
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// Create Express app
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Set up port from env or default
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Configure logging
const LOG_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const LOG_FILE = path.join(LOG_DIR, `mcp-http-server-${new Date().toISOString().split('T')[0]}.log`);
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

function logMessage(level, message, data = null) {
  const timestamp = new Date().toISOString();
  let logString = `[${timestamp}] [${level}] ${message}`;
  
  if (data) {
    if (typeof data === 'object') {
      logString += ` ${JSON.stringify(data)}`;
    } else {
      logString += ` ${data}`;
    }
  }
  
  logStream.write(logString + '\n');
  
  // In development mode, log to console as well
  if (NODE_ENV === 'development') {
    console[level.toLowerCase()](logString);
  }
}

const log = {
  info: (message, data) => logMessage('INFO', message, data),
  error: (message, data) => logMessage('ERROR', message, data),
  warn: (message, data) => logMessage('WARN', message, data),
  debug: (message, data) => NODE_ENV === 'development' && logMessage('DEBUG', message, data)
};

// Error handling middleware
app.use((err, req, res, next) => {
  log.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(500).json({
    type: 'error',
    error: {
      message: 'An unexpected error occurred',
      code: 'INTERNAL_SERVER_ERROR'
    }
  });
});

// Store child process references
let mcpProcess = null;

// Start MCP process function
function startMcpProcess() {
  if (mcpProcess) {
    try {
      mcpProcess.kill();
    } catch (e) {
      log.warn('Error killing existing MCP process', e);
    }
  }
  
  log.info('Starting MCP child process...');
  
  // Start the MCP server as a child process
  mcpProcess = spawn('node', [path.join(__dirname, 'mcp-stdin-server.js')], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env
  });
  
  // Keep track of pending requests with their callbacks
  const pendingResponses = new Map();
  
  // Log process output for debugging
  mcpProcess.stderr.on('data', (data) => {
    log.debug(`[MCP stderr]: ${data.toString().trim()}`);
  });
  
  // Handle messages from MCP server
  mcpProcess.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    
    for (const line of lines) {
      try {
        const message = JSON.parse(line);
        log.debug(`Received from MCP:`, message);
        
        // Match response to pending request
        if (message.id && pendingResponses.has(message.id)) {
          const { res, startTime, timeoutId } = pendingResponses.get(message.id);
          pendingResponses.delete(message.id);
          
          // Clear timeout
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          
          // Log response time
          const responseTime = Date.now() - startTime;
          log.info(`Request completed in ${responseTime}ms`);
          
          res.json(message);
        } else if (message.type === 'ready') {
          // Handle ready message
          log.info('MCP server is ready');
        } else if (message.type === 'ping') {
          // Handle ping (no response needed)
          log.debug('Received ping from MCP');
        } else {
          log.warn(`Unhandled message from MCP:`, message);
        }
      } catch (error) {
        log.error(`Error processing MCP response: ${error.message}`, { line });
      }
    }
  });
  
  // Handle process exit
  mcpProcess.on('exit', (code, signal) => {
    log.warn(`MCP process exited with code ${code} and signal ${signal}`);
    
    // Fail all pending requests
    for (const [id, { res, timeoutId }] of pendingResponses.entries()) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      res.status(500).json({ 
        type: 'tool_error',
        id,
        error: { 
          message: 'MCP process terminated unexpectedly' 
        } 
      });
    }
    
    pendingResponses.clear();
    
    // Restart the process after a delay
    setTimeout(() => {
      log.info('Attempting to restart MCP process...');
      startMcpProcess();
    }, 5000);
  });
  
  // Create an init request function
  const initMcp = () => {
    mcpProcess.stdin.write(JSON.stringify({ type: 'init' }) + '\n');
  };
  
  // Initialize MCP server
  initMcp();
  
  // Return API for interacting with the MCP process
  return {
    send: (message, res, timeout = 30000) => {
      const id = message.id || uuidv4();
      message.id = id;
      
      const startTime = Date.now();
      log.debug(`Sending to MCP:`, message);
      
      // Set timeout for response
      const timeoutId = setTimeout(() => {
        if (pendingResponses.has(id)) {
          const { res } = pendingResponses.get(id);
          pendingResponses.delete(id);
          
          log.warn(`Request timed out after ${timeout}ms`, { id });
          
          res.status(504).json({ 
            type: 'tool_error',
            id,
            error: { 
              message: 'Timeout waiting for MCP response',
              code: 'TIMEOUT'
            } 
          });
        }
      }, timeout);
      
      // Store the response object and timeout ID
      pendingResponses.set(id, { res, startTime, timeoutId });
      
      // Send the message to the MCP process
      mcpProcess.stdin.write(JSON.stringify(message) + '\n');
      
      return id;
    },
    
    init: initMcp,
    
    kill: () => {
      if (mcpProcess) {
        mcpProcess.kill();
        mcpProcess = null;
      }
    }
  };
}

// Start the MCP process
const mcp = startMcpProcess();

// Health check endpoint
app.get('/health', (req, res) => {
  log.debug('Health check request received');
  
  // Simple health check that also reports uptime
  res.status(200).json({ 
    status: 'ok', 
    message: 'WebDNA MCP HTTP Server is running',
    uptime: process.uptime(),
    environment: NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Documentation endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'WebDNA MCP Server',
    description: 'MCP server for WebDNA documentation',
    version: require('./package.json').version,
    endpoints: {
      '/': 'This documentation',
      '/health': 'Health check endpoint',
      '/mcp/init': 'Initialize MCP connection',
      '/mcp/list_tools': 'List available MCP tools',
      '/mcp/invoke_tool': 'Invoke an MCP tool with parameters'
    }
  });
});

// Initialize MCP endpoint
app.post('/mcp/init', (req, res) => {
  log.info('Received init request');
  
  // Send init message to MCP
  mcp.init();
  
  // Respond immediately
  res.status(200).json({ type: 'ready' });
});

// List tools endpoint
app.post('/mcp/list_tools', (req, res) => {
  log.info('Received list_tools request');
  
  // Send list_tools message to MCP
  mcp.send({ type: 'list_tools' }, res, 5000);
});

// Invoke tool endpoint
app.post('/mcp/invoke_tool', (req, res) => {
  const { tool, params } = req.body;
  log.info(`Received invoke_tool request for ${tool}`, { params });
  
  if (!tool) {
    return res.status(400).json({ 
      type: 'tool_error',
      error: {
        message: 'Missing tool parameter',
        code: 'MISSING_PARAMETER'
      } 
    });
  }
  
  // Send invoke_tool message to MCP with a longer timeout
  mcp.send({
    type: 'invoke_tool',
    tool,
    params: params || {}
  }, res, 60000);
});

// Start the server
const server = app.listen(PORT, () => {
  log.info(`WebDNA MCP HTTP Server running on port ${PORT} in ${NODE_ENV} mode`);
});

// Graceful shutdown
function gracefulShutdown() {
  log.info('Received termination signal, shutting down gracefully...');
  
  // Close the HTTP server
  server.close(() => {
    log.info('HTTP server closed');
    
    // Kill the MCP process
    if (mcp) {
      mcp.kill();
    }
    
    // Close the log stream
    logStream.end(() => {
      log.info('Log stream closed');
      process.exit(0);
    });
  });
  
  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    log.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

// Handle process termination
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception', { error: error.stack });
  gracefulShutdown();
});
