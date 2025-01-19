/**
 * Centralized API endpoint constants and configuration values for the frontend application.
 * Defines API routes, versioning, timeouts, and other API-related constants.
 * @version 1.0.0
 */

import { ApiResponse } from '../types/common';

// API version and base URL configuration
const API_VERSION = 'v1';
const BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * API endpoint route constants organized by domain
 */
export const API_ENDPOINTS = {
  BASE_URL,
  AUTH: {
    LOGIN: `/api/${API_VERSION}/auth/login`,
    LOGOUT: `/api/${API_VERSION}/auth/logout`,
    REFRESH: `/api/${API_VERSION}/auth/refresh`,
    REGISTER: `/api/${API_VERSION}/auth/register`,
    VERIFY: `/api/${API_VERSION}/auth/verify`,
    FORGOT_PASSWORD: `/api/${API_VERSION}/auth/forgot-password`,
    RESET_PASSWORD: `/api/${API_VERSION}/auth/reset-password`,
  },
  ORGANIZATIONS: {
    BASE: `/api/${API_VERSION}/organizations`,
    DETAILS: (id: string) => `/api/${API_VERSION}/organizations/${id}`,
    MEMBERS: (id: string) => `/api/${API_VERSION}/organizations/${id}/members`,
    SETTINGS: (id: string) => `/api/${API_VERSION}/organizations/${id}/settings`,
  },
  TEMPLATES: {
    BASE: `/api/${API_VERSION}/templates`,
    DETAILS: (id: string) => `/api/${API_VERSION}/templates/${id}`,
    PREVIEW: (id: string) => `/api/${API_VERSION}/templates/${id}/preview`,
    DEPLOY: (id: string) => `/api/${API_VERSION}/templates/${id}/deploy`,
    CATEGORIES: `/api/${API_VERSION}/templates/categories`,
  },
  INTEGRATIONS: {
    BASE: `/api/${API_VERSION}/integrations`,
    DETAILS: (id: string) => `/api/${API_VERSION}/integrations/${id}`,
    CONFIGURE: (id: string) => `/api/${API_VERSION}/integrations/${id}/configure`,
    TEST: (id: string) => `/api/${API_VERSION}/integrations/${id}/test`,
    SYNC: (id: string) => `/api/${API_VERSION}/integrations/${id}/sync`,
  },
  CONTEXT: {
    ANALYZE: `/api/${API_VERSION}/context/analyze`,
    INSIGHTS: `/api/${API_VERSION}/context/insights`,
    SUGGESTIONS: `/api/${API_VERSION}/context/suggestions`,
  },
} as const;

/**
 * API configuration constants for timeouts, retries, rate limiting, etc.
 */
export const API_CONFIG = {
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RATE_LIMIT: {
    MAX_REQUESTS_PER_MINUTE: 1000,
    MAX_REQUESTS_PER_ORG: 5000,
    BURST_ALLOWANCE: 50,
  },
  CORS: {
    ALLOWED_ORIGINS: ['http://localhost:3000', 'https://*.coreos.com'],
    ALLOWED_METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    ALLOW_CREDENTIALS: true,
    MAX_AGE: 86400, // 24 hours
  },
  SECURITY: {
    TOKEN_EXPIRY: 3600, // 1 hour
    REFRESH_TOKEN_EXPIRY: 2592000, // 30 days
    MIN_PASSWORD_LENGTH: 12,
    REQUIRE_MFA: true,
  },
  CACHE: {
    TTL: 300, // 5 minutes
    STALE_WHILE_REVALIDATE: 60, // 1 minute
    CACHE_CONTROL: 'public, max-age=300, stale-while-revalidate=60',
  },
  COMPRESSION: {
    ENABLED: true,
    LEVEL: 6,
    MIN_SIZE: 1024, // 1KB
  },
  MONITORING: {
    PERFORMANCE_THRESHOLD: 1000, // 1 second
    ERROR_THRESHOLD: 0.01, // 1% error rate
    SAMPLING_RATE: 0.1, // 10% sampling
  },
} as const;

/**
 * HTTP status code constants
 */
export enum HTTP_STATUS {
  OK = 200,
  CREATED = 201,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
}

/**
 * WebSocket event type constants
 */
export enum WEBSOCKET_EVENTS {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  MESSAGE = 'message',
  ERROR = 'error',
  CONTEXT_UPDATE = 'context_update',
  TEMPLATE_UPDATE = 'template_update',
  INTEGRATION_SYNC = 'integration_sync',
  REAL_TIME_INSIGHTS = 'real_time_insights',
}