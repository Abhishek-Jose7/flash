FROM node:22-alpine

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Expose HTTP and WebSocket port
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server/server.js"]
