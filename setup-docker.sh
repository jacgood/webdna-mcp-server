#!/bin/bash

# Script to set up and run the WebDNA MCP server in Docker

# Ensure we have an .env file
if [ ! -f .env ]; then
  echo "Creating .env file from .env.example..."
  cp .env.example .env
  echo "Please edit the .env file with your Supabase credentials"
  exit 1
fi

# Build and start the container
echo "Building and starting the WebDNA MCP server container..."
docker-compose up -d

# Display the status
echo "WebDNA MCP server running at http://localhost:3000"
echo ""
echo "To check logs, run: npm run docker:logs"
echo "To stop the server, run: npm run docker:down"