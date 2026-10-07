FROM node:22-alpine

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY --chown=node:node . .

# Expose HTTP and WebSocket port
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

USER node

HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://localhost:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "server/server.js"]
