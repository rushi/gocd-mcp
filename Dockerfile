# Multi-stage build for security and smaller image size
FROM node:22-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Use npm ci for reproducible builds (includes dev dependencies by default)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:22-slim

# Create non-root user with numeric UID for portability
# UID 10001 is commonly used for containerized apps
RUN groupadd -g 10001 appuser && \
    useradd -u 10001 -g appuser -s /bin/bash -m appuser

WORKDIR /app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder stage with proper ownership
COPY --from=builder --chown=10001:10001 /app/dist ./dist

# Create writable directories for read-only root filesystem compatibility
# Node.js may need /tmp for temporary files
RUN mkdir -p /tmp && chown -R 10001:10001 /tmp

# Switch to non-root user
USER 10001

# Expose the port the app runs on
EXPOSE 3999

# Health check (optional - adjust endpoint as needed)
# HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
#   CMD node -e "require('http').get('http://localhost:3999/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run the application
CMD [ "node", "dist/index.js" ]

# Security notes for runtime:
# - Run with --cap-drop=ALL --cap-add=NET_BIND_SERVICE if binding to privileged ports
# - Run with --read-only --tmpfs /tmp for read-only root filesystem
# - Example: docker run --read-only --tmpfs /tmp --cap-drop=ALL -p 3999:3999 gocd-mcp
