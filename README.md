# WebDNA MCP Server

A custom Model Context Protocol (MCP) server for WebDNA documentation. This server scrapes and indexes WebDNA documentation from [docs.webdna.us](https://docs.webdna.us/) and provides API endpoints for searching and retrieving documentation.

## Features

- Scrapes and indexes WebDNA documentation
- Provides MCP-compatible API endpoints for integration with AI assistants
- Full-text search for WebDNA instructions and contexts
- Categorized documentation browsing
- Supabase PostgreSQL database for storage and retrieval
- Docker support for easy deployment

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Supabase account and project

### Installation with Docker

1. Clone the repository
2. Set up your environment variables:
```bash
cp .env.example .env
# Edit .env with your Supabase URL and API key
```

3. Start the Docker container:
```bash
# Using the setup script
chmod +x setup-docker.sh
./setup-docker.sh

# Or manually with npm scripts
npm run docker:up
```

4. The MCP server will be available at http://localhost:3000

### Manual Installation

If you prefer not to use Docker, you can install and run the server directly:

1. Install dependencies:
```bash
npm install
```

2. Apply the database migrations to your Supabase project:
```bash
# Use the Supabase SQL Editor to run the SQL in migrations/01_initial_setup.sql
```

3. Run the documentation scraper to populate the database:
```bash
npm run scrape
```

4. Start the server:

```bash
npm start
```

## Using with Continue.dev

To use this MCP server with Continue.dev, add the following to your `.continue/config.yaml` file:

```yaml
mcpServers:
  - name: WebDNA Documentation
    command: curl
    args:
      - -X
      - POST
      - http://localhost:3000/mcp/invoke_tool
      - -H
      - 'Content-Type: application/json'
      - -d
      - |
        {"tool": "$0", "params": $1}
    env:
      SUPABASE_URL: "your-supabase-url"
      SUPABASE_KEY: "your-supabase-key"
```

## MCP Tools

This server provides the following MCP tools:

### search-webdna-docs

Searches WebDNA documentation for specific instructions, contexts, or keywords.

**Parameters:**
- `query` (string): The search query for WebDNA documentation

### get-webdna-doc

Retrieves detailed documentation for a specific WebDNA instruction or context by its ID.

**Parameters:**
- `id` (string): The ID of the WebDNA instruction or context

### get-webdna-categories

Retrieves all WebDNA documentation categories with the count of instructions in each category.

## API Endpoints (HTTP Server)

- `GET /health`: Health check endpoint
- `POST /mcp/init`: Initialize the MCP server
- `POST /mcp/list_tools`: Get available tools
- `POST /mcp/invoke_tool`: Invoke a tool with parameters

## Docker Commands

- `npm run docker:build`: Build the Docker container
- `npm run docker:run`: Run the container
- `npm run docker:up`: Start with Docker Compose
- `npm run docker:down`: Stop the container
- `npm run docker:logs`: View container logs

## License

ISC

## Acknowledgments

- [WebDNA Documentation](https://docs.webdna.us/)
- [Model Context Protocol (MCP)](https://github.com/anthropics/model-context-protocol)
