# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS base

# Install dumb-init for proper signal handling (PID 1 problem in containers)
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy package files first (layer caching — only reinstalls on package.json change)
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source
COPY src ./src

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init

# Run as non-root user (security)
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

WORKDIR /app

COPY --from=base --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=base --chown=nodejs:nodejs /app/src ./src
COPY --chown=nodejs:nodejs package*.json ./

EXPOSE 5000

# dumb-init as PID 1: properly forwards SIGTERM → Node.js for graceful shutdown
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]