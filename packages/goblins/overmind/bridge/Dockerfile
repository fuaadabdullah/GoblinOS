# Multi-stage build for Node.js TypeScript bridge

# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /build

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY ../observability/package.json ../observability/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./
COPY ../observability/ ../observability/

# Build TypeScript
RUN pnpm build

# Stage 2: Runtime stage
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built files from builder
COPY --from=builder /build/dist ./dist

# Create non-root user
RUN adduser -D -u 1000 overmind && \
    chown -R overmind:overmind /app

USER overmind

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3030/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Expose port
EXPOSE 3030

# Run the server
CMD ["node", "dist/server.js"]
