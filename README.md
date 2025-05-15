# WebDNA MCP Server

A custom Model Context Protocol (MCP) server for WebDNA documentation. This server scrapes and indexes WebDNA documentation from [docs.webdna.us](https://docs.webdna.us/) and provides API endpoints for searching and retrieving documentation.

## Features

- Scrapes and indexes WebDNA documentation
- Provides MCP-compatible API endpoints for integration with AI assistants
- Full-text search for WebDNA instructions and contexts
- Categorized documentation browsing
- Supabase PostgreSQL database for storage and retrieval

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm
- Supabase account and project

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Set up your environment variables by copying the example file and updating with your Supabase credentials:

```bash
cp .env.example .env
# Edit .env with your Supabase URL and API key
```

4. Apply the database migrations to your Supabase project:

```bash
# Use the Supabase SQL Editor to run the SQL in migrations/01_initial_setup.sql
```

5. Run the documentation scraper to populate the database:

```bash
npm run scrape
```

6. Start the server:

```bash
npm start
```

The server will run on port 3000 by default. You can change this by setting the `PORT` environment variable.

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

## API Endpoints

- `POST /mcp/search-webdna-docs`: Search WebDNA documentation
- `POST /mcp/get-webdna-doc`: Get documentation by ID
- `GET /mcp/get-webdna-categories`: Get all categories
- `GET /health`: Health check endpoint

## Development

For development with auto-restart on file changes:

```bash
npm run dev
```

## License

ISC

## Acknowledgments

- [WebDNA Documentation](https://docs.webdna.us/)
- [Model Context Protocol (MCP)](https://github.com/anthropics/model-context-protocol)
