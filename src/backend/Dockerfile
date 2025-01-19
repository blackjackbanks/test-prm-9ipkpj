# Stage 1: Builder
FROM python:3.11-alpine3.18 AS builder

# Set build environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    POETRY_VERSION=1.5.1 \
    POETRY_HOME="/opt/poetry" \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_NO_INTERACTION=1

# Install system build dependencies including ML requirements
RUN apk add --no-cache \
    gcc \
    musl-dev \
    python3-dev \
    libffi-dev \
    openssl-dev \
    openblas-dev \
    lapack-dev \
    git \
    curl \
    make \
    cmake

# Install poetry
RUN curl -sSL https://install.python-poetry.org | python3 - && \
    ln -s /opt/poetry/bin/poetry /usr/local/bin/poetry

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml poetry.lock ./
COPY requirements.txt ./

# Install Python dependencies with ML packages
RUN poetry install --no-dev --no-root && \
    poetry export -f requirements.txt --output requirements.frozen.txt && \
    pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r requirements.frozen.txt

# Stage 2: Runtime
FROM python:3.11-alpine3.18

# Set runtime environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    MODEL_PATH=/app/models \
    MAX_MODEL_MEMORY=4G \
    MODEL_THREAD_COUNT=4

# Install runtime system dependencies
RUN apk add --no-cache \
    libstdc++ \
    openblas \
    lapack \
    curl \
    tini \
    && addgroup -S coreos \
    && adduser -S coreos -G coreos

# Create necessary directories
RUN mkdir -p /app/data /app/models /app/cache \
    && chown -R coreos:coreos /app

WORKDIR /app

# Copy wheels and install dependencies
COPY --from=builder /app/wheels /wheels
COPY --from=builder /app/requirements.frozen.txt .
RUN pip install --no-cache /wheels/*

# Copy application code
COPY --chown=coreos:coreos . .

# Set secure permissions
RUN chmod -R 755 /app \
    && chmod 440 /app/models/* 2>/dev/null || true \
    && chown -R coreos:coreos /app/data /app/cache

# Configure health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl --fail http://localhost:8000/api/v1/health || exit 1

# Expose ports for API and metrics
EXPOSE 8000 9090 9091

# Set resource limits for ML operations
ENV MALLOC_ARENA_MAX=2

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Switch to non-root user
USER coreos

# Start application with ML worker initialization
CMD ["sh", "-c", "python -m uvicorn main:app --host 0.0.0.0 --port $PORT --workers $MODEL_THREAD_COUNT --limit-max-requests 10000"]

# Labels for container metadata
LABEL org.opencontainers.image.title="COREos Backend" \
      org.opencontainers.image.description="AI-first business operating system backend service" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.vendor="COREos" \
      org.opencontainers.image.licenses="Proprietary" \
      org.opencontainers.image.created="2023-09-21" \
      security.coreos.root-user="false" \
      ml.coreos.model-support="llama-2" \
      ml.coreos.max-memory="4G"