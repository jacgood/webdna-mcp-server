FROM node:18-slim AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production
COPY . .

RUN mkdir -p logs && chmod 755 logs

RUN chmod +x mcp-stdin-server.js mcp-http-server.js setup-docker.sh

RUN echo "Build completed"

FROM node:18-slim

RUN mkdir -p /app/logs && \
    chown -R node:node /app

WORKDIR /app

COPY --from=builder --chown=node:node /app ./

USER node
ENV PORT=3000
EXPOSE 3000

ENV SUPABASE_URL=https://your-project-url.supabase.co
ENV SUPABASE_KEY=your-supabase-anon-key
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').request({host: 'localhost', port: 3000, path: '/health', timeout: 5000}, (res) => { process.exit(res.statusCode < 400 ? 0 : 1); }).on('error', () => process.exit(1)).end()"
CMD ["node", "mcp-http-server.js"]
