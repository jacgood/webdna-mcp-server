# WebDNA MCP Server

A state-of-the-art Model Context Protocol (MCP) server for WebDNA documentation. This server scrapes and indexes WebDNA documentation from [docs.webdna.us](https://docs.webdna.us/) and provides API endpoints for searching and retrieving documentation.

## Features

- **High-Performance Documentation Access**: Efficient caching and retrieval of WebDNA documentation
- **Advanced Search Capabilities**: Full-text search with relevance scoring for WebDNA instructions
- **Dual Protocol Support**: Works with both stdin/stdout (for AI assistants) and HTTP interfaces
- **Comprehensive MCP Tools**: Rich set of tools for exploring the WebDNA framework
- **Robust Error Handling**: Graceful error recovery and detailed logging
- **Optimized Database Layer**: Efficient Supabase PostgreSQL queries with caching
- **Containerized Deployment**: Docker support with health checks and security best practices
- **Low Resource Utilization**: Optimized for cloud deployment with minimal resource footprint
## Getting Started

### Prerequisites

- Docker and Docker Compose
- Supabase account and project

### Installation with Docker (Recommended)

1. Clone the repository
2. Run the setup script:
```bash
chmod +x setup-docker.sh
./setup-docker.sh
```
3. The MCP server will be available at http://localhost:3002

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
# For HTTP server
npm run start:mcp-http

# For stdin/stdout server (for AI assistants)
npm run start:mcp
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
      - http://localhost:3002/mcp/invoke_tool
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

This server provides the following enhanced MCP tools:

### search-webdna-docs

Searches WebDNA documentation with advanced filtering and relevance scoring.
**Parameters:**
- `query` (string, required): Search query for WebDNA documentation
- `category` (string, optional): Filter results by category
- `limit` (number, optional): Maximum results to return (default: 20)
- `offset` (number, optional): Offset for pagination (default: 0)

### get-webdna-doc

Retrieves detailed documentation for a specific WebDNA instruction or context.

**Parameters:**
- `id` (string, required): ID, WebDNA ID, or instruction name
### get-webdna-categories

Retrieves all WebDNA documentation categories with counts of instructions.

### get-random-webdna-docs

Retrieves random WebDNA documentation entries for exploration.

**Parameters:**
- `limit` (number, optional): Number of entries to return (default: 5)

### get-webdna-stats

Retrieves statistics about the WebDNA documentation database.
## API Endpoints

- `GET /health`: Health check endpoint
- `GET /`: API documentation and information
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
- [Supabase](https://supabase.com/) for database infrastructure
