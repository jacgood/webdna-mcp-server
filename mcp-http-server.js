#!/usr/bin/env node

/**
 * WebDNA MCP HTTP Server
 * This server exposes the MCP stdin/stdout protocol via HTTP endpoints
 * It acts as a bridge between HTTP clients and the MCP stdin/stdout server
 */

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Set up port from env or default
const PORT = process.env.PORT || 3000;

// Start the MCP server as a child process
const mcpProcess = spawn('node', ['mcp-stdin-server.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Keep track of pending requests with their callbacks
const pendingResponses = new Map();

// Log process output for debugging
mcpProcess.stderr.on('data', (data) => {
  console.error(`[MCP stderr]: ${data.toString()}`);
});

// Handle messages from MCP server
mcpProcess.stdout.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  
  for (const line of lines) {
    try {
      const message = JSON.parse(line);
      console.log(`Received from MCP: ${JSON.stringify(message)}`);
      
      // Match response to pending request
      if (message.id && pendingResponses.has(message.id)) {
        const res = pendingResponses.get(message.id);
        pendingResponses.delete(message.id);
        res.json(message);
      } else if (message.type === 'ready') {
        // Handle ready message
        console.log('MCP server is ready');
      } else if (message.type === 'ping') {
        // Handle ping (no response needed)
      } else {
        console.log(`Unhandled message: ${JSON.stringify(message)}`);
      }
    } catch (error) {
      console.error(`Error processing MCP response: ${error.message}`);
      console.error(`Problematic line: ${line}`);
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'WebDNA MCP HTTP Server is running' });
});

// Initialize MCP endpoint
app.post('/mcp/init', (req, res) => {
  console.log('Received init request');
  
  // Send init message to MCP
  mcpProcess.stdin.write(JSON.stringify({ type: 'init' }) + '\n');
  
  // Respond immediately
  res.status(200).json({ type: 'ready' });
});

// List tools endpoint
app.post('/mcp/list_tools', (req, res) => {
  console.log('Received list_tools request');
  
  // Send list_tools message to MCP
  mcpProcess.stdin.write(JSON.stringify({ type: 'list_tools' }) + '\n');
  
  // Store response callback
  const id = uuidv4();
  pendingResponses.set(id, res);
  
  // Set timeout to clean up if no response
  setTimeout(() => {
    if (pendingResponses.has(id)) {
      pendingResponses.delete(id);
      res.status(504).json({ error: 'Timeout waiting for MCP response' });
    }
  }, 5000);
});

// Invoke tool endpoint
app.post('/mcp/invoke_tool', (req, res) => {
  const { tool, params } = req.body;
  console.log(`Received invoke_tool request for ${tool}`);
  
  if (!tool) {
    return res.status(400).json({ error: 'Missing tool parameter' });
  }
  
  // Create a unique ID for this request
  const id = uuidv4();
  
  // Send invoke_tool message to MCP
  mcpProcess.stdin.write(
    JSON.stringify({
      type: 'invoke_tool',
      tool,
      params: params || {},
      id
    }) + '\n'
  );
  
  // Store response callback
  pendingResponses.set(id, res);
  
  // Set timeout to clean up if no response
  setTimeout(() => {
    if (pendingResponses.has(id)) {
      pendingResponses.delete(id);
      res.status(504).json({ 
        type: 'tool_error',
        id,
        error: { 
          message: 'Timeout waiting for MCP response' 
        } 
      });
    }
  }, 30000); // 30 second timeout
});

// Start the server
app.listen(PORT, () => {
  console.log(`WebDNA MCP HTTP Server running on port ${PORT}`);
  
  // Initialize MCP server
  mcpProcess.stdin.write(JSON.stringify({ type: 'init' }) + '\n');
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down');
  mcpProcess.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down');
  mcpProcess.kill('SIGTERM');
  process.exit(0);
});