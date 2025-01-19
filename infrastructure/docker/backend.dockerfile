# Stage 1: Builder
FROM python:3.11-slim AS builder

# Set build environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    POETRY_VERSION=1.5.1

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    gcc \
    python3-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /build

# Copy requirements file
COPY src/backend/requirements.txt .

# Install Python packages
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r requirements.txt \
    && pip check

# Stage 2: Production
FROM python:3.11-alpine

# Set production environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PATH="/app/bin:$PATH" \
    PYTHONPATH="/app" \
    TZ=UTC

# Create non-root user and group
RUN addgroup -g 1000 coreos && \
    adduser -u 1000 -G coreos -s /bin/sh -D coreos

# Install runtime dependencies
RUN apk add --no-cache \
    libpq \
    tzdata \
    ca-certificates \
    && update-ca-certificates

# Set working directory
WORKDIR /app

# Copy Python packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages/ /usr/local/lib/python3.11/site-packages/
COPY --from=builder /usr/local/bin/ /usr/local/bin/

# Create necessary directories with correct permissions
RUN mkdir -p /app/data /app/logs \
    && chown -R coreos:coreos /app \
    && chmod -R 755 /app

# Copy application code
COPY --chown=coreos:coreos src/backend /app/

# Set up environment configuration
COPY --chown=coreos:coreos src/backend/.env.example /app/.env.template

# Switch to non-root user
USER coreos:coreos

# Expose ports for API and metrics
EXPOSE 8000 9090

# Set resource limits
ENV MEMORY_LIMIT=512M \
    CPU_LIMIT=1.0 \
    PIDS_LIMIT=100

# Configure health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8000/api/v1/health || exit 1

# Security configurations
ENV NO_NEW_PRIVILEGES=true \
    TINI_VERSION=v0.19.0

# Set default command with Tini as init
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--proxy-headers", "--forwarded-allow-ips", "*"]

# Labels for container metadata
LABEL org.opencontainers.image.title="COREos Backend" \
      org.opencontainers.image.description="COREos AI-first business operating system backend service" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.vendor="COREos" \
      org.opencontainers.image.url="https://github.com/coreos/backend" \
      org.opencontainers.image.documentation="https://docs.coreos.com" \
      org.opencontainers.image.source="https://github.com/coreos/backend" \
      org.opencontainers.image.licenses="Proprietary" \
      org.opencontainers.image.created="2023-09-21" \
      org.opencontainers.image.authors="COREos Engineering <engineering@coreos.com>"

# Security scanning configuration
COPY --chown=coreos:coreos infrastructure/docker/security/trivy.yaml /app/security/trivy.yaml