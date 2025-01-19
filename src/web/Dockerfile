# syntax=docker/dockerfile:1.4

# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies with yarn
RUN yarn install --frozen-lockfile --production=false

# Copy source files
COPY . .

# Type check and build
RUN yarn typecheck && \
    yarn build

# Production stage
FROM nginx:1.25-alpine

# Create nginx user/group with restricted permissions
RUN addgroup -g 101 -S nginx && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# Install security packages
RUN apk add --no-cache wget curl

# Copy nginx configuration
COPY infrastructure/docker/nginx.conf /etc/nginx/nginx.conf

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Set correct permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Create required directories with correct permissions
RUN mkdir -p /var/cache/nginx/client_temp && \
    mkdir -p /var/cache/nginx/proxy_temp && \
    mkdir -p /var/cache/nginx/fastcgi_temp && \
    mkdir -p /var/cache/nginx/uwsgi_temp && \
    mkdir -p /var/cache/nginx/scgi_temp && \
    chown -R nginx:nginx /var/cache/nginx

# Switch to non-root user
USER nginx

# Configure volumes
VOLUME ["/var/cache/nginx", "/var/run"]

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost/health || exit 1

# Set environment variables
ENV NGINX_PORT=80 \
    NGINX_WORKER_PROCESSES=auto \
    NGINX_WORKER_CONNECTIONS=1024

# Set security options
ENV SECURITY_OPTS='--security-opt=no-new-privileges --cap-drop=ALL --cap-add=NET_BIND_SERVICE --read-only'

# Start NGINX
CMD ["nginx", "-g", "daemon off;"]

# Build arguments
ARG VITE_API_BASE_URL
ARG VITE_WS_URL

# Validate build arguments
RUN if [ -z "$VITE_API_BASE_URL" ] || [ -z "$VITE_WS_URL" ]; then \
    echo "Error: VITE_API_BASE_URL and VITE_WS_URL build arguments are required"; \
    exit 1; \
fi

# Labels
LABEL maintainer="COREos Team" \
    org.opencontainers.image.title="coreos-web" \
    org.opencontainers.image.description="COREos Web Frontend" \
    org.opencontainers.image.version="1.0.0" \
    org.opencontainers.image.vendor="COREos" \
    org.opencontainers.image.url="https://coreos.com" \
    org.opencontainers.image.source="https://github.com/coreos/web" \
    org.opencontainers.image.licenses="Proprietary"