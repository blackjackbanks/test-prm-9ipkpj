# syntax=docker/dockerfile:1.4
# Multi-stage build for COREos web frontend
# Base image versions locked for security and stability
# node:18-alpine v18.17.1
# nginx:1.25-alpine v1.25.2

# ---- Build Stage ----
FROM node:18-alpine AS builder
LABEL stage=builder

# Set build platform for multi-architecture support
ARG BUILDPLATFORM
ENV NODE_ENV=production

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copy package files for dependency installation
COPY package*.json ./

# Install dependencies with exact versions
RUN npm ci --production=false

# Copy source files
COPY . .

# Build application with production optimizations
RUN npm run build

# Generate compressed versions of static assets
RUN cd dist && \
    find . -type f -regex '.*\.\(js\|css\|html\|svg\)$' -exec gzip -9 -k {} \; && \
    find . -type f -regex '.*\.\(js\|css\|html\|svg\)$' -exec brotli -9 -k {} \;

# ---- Production Stage ----
FROM nginx:1.25-alpine
LABEL maintainer="COREos Engineering <engineering@coreos.io>"

# Create non-root user for security
RUN addgroup -g 101 -S nginx && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# Install required packages
RUN apk add --no-cache \
    curl \
    tzdata \
    ca-certificates

# Copy NGINX configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Set correct permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Configure permissions for security
RUN chmod 755 /usr/share/nginx/html && \
    chmod 644 /usr/share/nginx/html/* && \
    chmod -R 755 /var/cache/nginx && \
    chmod -R 755 /var/log/nginx && \
    chmod 755 /etc/nginx/conf.d

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 80

# Set environment variables
ENV TZ=UTC \
    NGINX_ENTRYPOINT_QUIET_LOGS=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl --fail http://localhost/health || exit 1

# Default command
CMD ["nginx", "-g", "daemon off;"]