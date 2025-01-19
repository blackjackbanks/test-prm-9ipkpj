/**
 * Core API utility module providing comprehensive request handling, error transformation,
 * response processing, rate limiting, and retry logic with TypeScript type safety.
 * @version 1.0.0
 */

import axios, { AxiosError, AxiosResponse, AxiosRequestConfig } from 'axios'; // v1.4.0
import { API_ENDPOINTS, API_CONFIG } from '../constants/api';
import { ApiResponse, ApiError } from '../types/common';

// Global constants for API configuration
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RATE_LIMIT_WINDOW = 60000; // 1 minute in milliseconds
const MAX_REQUESTS_PER_WINDOW = 1000;

// Token bucket for rate limiting
interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

let tokenBucket: TokenBucket = {
  tokens: MAX_REQUESTS_PER_WINDOW,
  lastRefill: Date.now()
};

/**
 * Transforms raw API response into standardized ApiResponse format with metadata
 * @template T Type of response data
 * @param response Axios response object
 * @returns Standardized API response with typed data and metadata
 */
export function transformResponse<T>(response: AxiosResponse): ApiResponse<T> {
  const startTime = performance.now();
  
  try {
    const { data, status, headers } = response;
    
    // Extract rate limit information from headers
    const rateLimit = {
      limit: parseInt(headers['x-ratelimit-limit'] || '1000'),
      remaining: parseInt(headers['x-ratelimit-remaining'] || '1000'),
      reset: parseInt(headers['x-ratelimit-reset'] || '0')
    };

    // Calculate response time
    const responseTime = performance.now() - startTime;

    return {
      success: status >= 200 && status < 300,
      message: data.message || 'Success',
      data: data.data as T,
      timestamp: new Date(),
      metadata: {
        statusCode: status,
        rateLimit,
        responseTime,
        path: response.config.url,
        method: response.config.method?.toUpperCase()
      }
    };
  } catch (error) {
    throw new Error(`Response transformation failed: ${error}`);
  }
}

/**
 * Transforms API errors into standardized ApiError format with retry logic
 * @param error Axios error object
 * @returns Standardized error object with details
 */
export function transformError(error: AxiosError): ApiError {
  const { response, config } = error;
  const status = response?.status || 500;
  
  // Define error codes and messages based on status
  const errorMap: Record<number, { code: string; message: string }> = {
    400: { code: 'BAD_REQUEST', message: 'Invalid request parameters' },
    401: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    403: { code: 'FORBIDDEN', message: 'Access denied' },
    404: { code: 'NOT_FOUND', message: 'Resource not found' },
    429: { code: 'RATE_LIMITED', message: 'Too many requests' },
    500: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
  };

  const errorInfo = errorMap[status] || { 
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred'
  };

  return {
    code: errorInfo.code,
    message: errorInfo.message,
    details: {
      status,
      path: config?.url,
      method: config?.method?.toUpperCase(),
      timestamp: new Date(),
      originalError: response?.data
    },
    timestamp: new Date(),
    path: config?.url || 'unknown'
  };
}

/**
 * Implements token bucket algorithm for rate limiting
 * @param config Rate limit configuration
 * @returns Whether request should proceed
 */
export function handleRateLimiting(): boolean {
  const now = Date.now();
  const timeElapsed = now - tokenBucket.lastRefill;
  
  // Refill tokens based on time elapsed
  if (timeElapsed > 0) {
    const refillAmount = Math.floor(timeElapsed / RATE_LIMIT_WINDOW) * MAX_REQUESTS_PER_WINDOW;
    tokenBucket.tokens = Math.min(
      MAX_REQUESTS_PER_WINDOW,
      tokenBucket.tokens + refillAmount
    );
    tokenBucket.lastRefill = now;
  }

  // Check if request can proceed
  if (tokenBucket.tokens > 0) {
    tokenBucket.tokens--;
    return true;
  }

  return false;
}

/**
 * Implements exponential backoff for failed requests
 * @param config Request configuration
 * @param retryCount Current retry attempt
 * @returns Promise resolving to retried request response
 */
export async function retryRequest(
  config: AxiosRequestConfig,
  retryCount: number = 0
): Promise<AxiosResponse> {
  try {
    const response = await axios(config);
    return response;
  } catch (error) {
    if (!(error instanceof AxiosError)) {
      throw error;
    }

    const status = error.response?.status;
    
    // Only retry on 5xx errors or network issues
    if (
      retryCount < MAX_RETRIES &&
      (!status || status >= 500) &&
      config.method?.toUpperCase() === 'GET'
    ) {
      // Calculate exponential backoff delay
      const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
      
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      
      // Retry with incremented count
      return retryRequest(config, retryCount + 1);
    }

    throw error;
  }
}

// Create axios instance with default configuration
export const apiClient = axios.create({
  baseURL: API_ENDPOINTS.BASE_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: true
});

// Add request interceptor for rate limiting
apiClient.interceptors.request.use(
  (config) => {
    if (!handleRateLimiting()) {
      throw new AxiosError(
        'Rate limit exceeded',
        'RATE_LIMIT_EXCEEDED',
        config,
        null,
        {
          status: 429,
          data: { message: 'Too many requests' }
        } as AxiosResponse
      );
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for transformation
apiClient.interceptors.response.use(
  (response) => transformResponse(response),
  async (error) => {
    if (error.response?.status === 429) {
      // Handle rate limit error
      const retryAfter = parseInt(error.response.headers['retry-after'] || '60');
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return retryRequest(error.config);
    }
    
    throw transformError(error);
  }
);