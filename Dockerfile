FROM node:18-slim

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install
RUN npm install uuid

# Copy the rest of the application
COPY . .

# Make the stdin/stdout script executable
RUN chmod +x mcp-stdin-server.js

# Command to run the application
CMD ["./mcp-stdin-server.js"]
