#!/usr/bin/env node

// Simple wrapper script to start the WebDNA MCP server
// This allows Windsurf to launch the server directly
//
// USAGE:
//   - For local Windsurf integration, this script launches the stdin/stdout MCP server (mcp-stdin-server.js)
//   - For HTTP testing, use simple-mcp-server.js or src/index.js directly (not recommended for local Windsurf)
//
// NOTE: The stdin/stdout server is the preferred approach for local AI agent integration.

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get the directory of this script
const scriptDir = __dirname;

// Create a log file for debugging
const logFile = fs.createWriteStream(path.join(scriptDir, 'mcp-server.log'), { flags: 'a' });
logFile.write(`\n[${new Date().toISOString()}] Starting WebDNA MCP server\n`);

// Log the environment for debugging
logFile.write(`Current directory: ${process.cwd()}\n`);
logFile.write(`Script directory: ${scriptDir}\n`);

// Start the MCP server using stdin/stdout protocol (preferred for Windsurf)
// Use mcp-stdin-server.js for local integration
const server = spawn('node', [path.join(scriptDir, 'mcp-stdin-server.js')], {
  cwd: scriptDir,
  stdio: ['pipe', 'pipe', 'pipe'] // Ensure stdio is piped for MCP protocol
});

// Pipe stdout and stderr to both the console and our log file
server.stdout.on('data', (data) => {
  process.stdout.write(data);
  logFile.write(data);
});

server.stderr.on('data', (data) => {
  process.stderr.write(data);
  logFile.write(`[ERROR] ${data}`);
});

// Handle process termination
process.on('SIGINT', () => {
  logFile.write(`\n[${new Date().toISOString()}] Received SIGINT, shutting down\n`);
  server.kill('SIGINT');
  logFile.end();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logFile.write(`\n[${new Date().toISOString()}] Received SIGTERM, shutting down\n`);
  server.kill('SIGTERM');
  logFile.end();
  process.exit(0);
});

// Forward exit codes
server.on('exit', (code) => {
  logFile.write(`\n[${new Date().toISOString()}] Server exited with code ${code}\n`);
  logFile.end();
  process.exit(code);
});

// Keep the process running
process.stdin.resume();

// Log that we're ready
logFile.write(`\n[${new Date().toISOString()}] Wrapper script ready\n`);
