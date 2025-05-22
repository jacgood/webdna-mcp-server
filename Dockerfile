FROM node:18-slim

# Create app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose the port
ENV PORT=3000
EXPOSE 3000

# Set up default environment variables (will be overridden by docker-compose)
ENV SUPABASE_URL=https://your-project-url.supabase.co
ENV SUPABASE_KEY=your-supabase-anon-key
ENV NODE_ENV=production

# Make scripts executable
RUN chmod +x mcp-stdin-server.js
RUN chmod +x mcp-http-server.js
RUN chmod +x setup-docker.sh

# Run the MCP HTTP server by default
CMD ["node", "mcp-http-server.js"]
