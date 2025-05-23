#!/bin/bash

# Setup script for WebDNA MCP server using Docker
set -e

echo "=== WebDNA MCP Server Docker Setup ==="
echo "This script will set up and run the WebDNA MCP server in Docker."

# Create logs directory if it doesn't exist
if [ ! -d "logs" ]; then
  echo "Creating logs directory..."
  mkdir -p logs
  chmod 755 logs
fi

# Ensure we have an .env file
if [ ! -f .env ]; then
  echo "Creating .env file from .env.example..."
  cp .env.example .env
  
  # Prompt for Supabase credentials
  read -p "Enter your Supabase URL: " supabase_url
  read -p "Enter your Supabase anonymous key: " supabase_key
  
  # Update .env file
  if [ -n "$supabase_url" ]; then
    sed -i "s|SUPABASE_URL=.*|SUPABASE_URL=$supabase_url|g" .env
  fi
  
  if [ -n "$supabase_key" ]; then
    sed -i "s|SUPABASE_KEY=.*|SUPABASE_KEY=$supabase_key|g" .env
  fi
fi

# Check for Docker and Docker Compose
if ! command -v docker &> /dev/null; then
  echo "Error: Docker is not installed. Please install Docker first."
  exit 1
fi

if ! command -v docker-compose &> /dev/null; then
  echo "Error: Docker Compose is not installed. Please install Docker Compose first."
  exit 1
fi

# Build and start the container
echo "Building and starting the WebDNA MCP server container..."
docker-compose up -d --build

# Check if container is running
if [ $? -eq 0 ]; then
  # Wait for service to be ready
  echo "Waiting for service to be ready..."
  sleep 5
  
  # Check health endpoint
  if command -v curl &> /dev/null; then
    response=$(curl -s http://localhost:3002/health || echo "failed")
    if [[ $response == *"ok"* ]]; then
      echo "=== WebDNA MCP server is up and running! ==="
      echo "API URL: http://localhost:3002"
      echo ""
      echo "To check logs, run: npm run docker:logs"
      echo "To stop the server, run: npm run docker:down"
    else
      echo "Warning: Service started but health check failed. Check logs for details."
      echo "Run: npm run docker:logs"
    fi
  else
    echo "WebDNA MCP server container started. Health check skipped (curl not found)."
  fi
else
  echo "Error: Failed to start containers. Check the output above for errors."
  exit 1
fi
