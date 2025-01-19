/**
 * Core API service module providing typed HTTP client functionality with comprehensive
 * request/response handling, caching, retry logic, and secure token management.
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';
import queryString from 'query-string';
import jwtDecode from 'jwt-decode';

import { 
  API_ENDPOINTS, 
  API_CONFIG, 
  HTTP_STATUS 
} from '../constants/api';
import { 
  ApiResponse, 
  ApiError 
} from '../types/common';

// Request configuration interface extending AxiosRequestConfig
interface RequestConfig extends AxiosRequestConfig {
  skipAuth?: boolean;
  skipCache?: boolean;
  retryAttempts?: number;
}

// Token payload interface
interface TokenPayload {
  exp: number;
  sub: string;
  org: string;
}

// Create axios instance with default config
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_ENDPOINTS.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
});

// Request deduplication queue
const requestQueue = new Map<string, Promise<any>>();

// In-memory response cache
const responseCache = new Map<string, { data: any; timestamp: number }>();

/**
 * Configures request and response interceptors for the axios instance
 */
const setupInterceptors = (): void => {
  // Request interceptor
  axiosInstance.interceptors.request.use(
    async (config) => {
      const token = localStorage.getItem('accessToken');
      
      if (token && !config.skipAuth) {
        const payload = jwtDecode<TokenPayload>(token);
        
        // Check token expiration
        if (payload.exp * 1000 < Date.now()) {
          try {
            const newToken = await refreshToken();
            localStorage.setItem('accessToken', newToken);
          } catch (error) {
            localStorage.removeItem('accessToken');
            window.location.href = '/login';
            return Promise.reject(error);
          }
        }
        
        config.headers.Authorization = `Bearer ${localStorage.getItem('accessToken')}`;
      }

      // Request deduplication
      const requestKey = `${config.method}-${config.url}-${JSON.stringify(config.params)}-${JSON.stringify(config.data)}`;
      
      if (requestQueue.has(requestKey)) {
        return requestQueue.get(requestKey);
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor
  axiosInstance.interceptors.response.use(
    (response) => {
      // Cache successful GET responses
      if (response.config.method?.toLowerCase() === 'get' && !response.config.skipCache) {
        const cacheKey = `${response.config.url}-${JSON.stringify(response.config.params)}`;
        responseCache.set(cacheKey, {
          data: response.data,
          timestamp: Date.now()
        });
      }
      
      return response;
    },
    async (error: AxiosError) => {
      return Promise.reject(handleApiError(error));
    }
  );

  // Configure retry logic
  axiosRetry(axiosInstance, {
    retries: API_CONFIG.RETRY_ATTEMPTS,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => {
      return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
             error.response?.status === HTTP_STATUS.TOO_MANY_REQUESTS;
    }
  });
};

/**
 * Refreshes the access token using the refresh token
 */
const refreshToken = async (): Promise<string> => {
  const refreshToken = localStorage.getItem('refreshToken');
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await axiosInstance.post(API_ENDPOINTS.AUTH.REFRESH, {
    refreshToken
  }, { skipAuth: true });

  return response.data.accessToken;
};

/**
 * Processes API errors and converts them to a standardized format
 */
const handleApiError = (error: AxiosError): ApiError => {
  const apiError: ApiError = {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
    details: {},
    timestamp: new Date(),
    path: error.config?.url || ''
  };

  if (error.response) {
    const { data, status } = error.response;
    
    apiError.code = data.code || `ERROR_${status}`;
    apiError.message = data.message || error.message;
    apiError.details = data.details || {};
    
    // Handle specific error cases
    switch (status) {
      case HTTP_STATUS.UNAUTHORIZED:
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        break;
      case HTTP_STATUS.TOO_MANY_REQUESTS:
        apiError.details.retryAfter = error.response.headers['retry-after'];
        break;
    }
  } else if (error.request) {
    apiError.code = 'NETWORK_ERROR';
    apiError.message = 'Network error occurred';
    apiError.details = { request: error.request };
  }

  // Log error for monitoring
  console.error('[API Error]', apiError);
  
  return apiError;
};

/**
 * Typed GET request wrapper with caching and error handling
 */
const get = async <T>(
  url: string, 
  params?: Record<string, unknown>, 
  config: RequestConfig = {}
): Promise<ApiResponse<T>> => {
  const cacheKey = `${url}-${JSON.stringify(params)}`;
  
  // Check cache if not disabled
  if (!config.skipCache) {
    const cached = responseCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < API_CONFIG.CACHE.TTL * 1000) {
      return cached.data;
    }
  }

  const response = await axiosInstance.get<ApiResponse<T>>(
    `${url}${params ? `?${queryString.stringify(params)}` : ''}`,
    config
  );

  return response.data;
};

/**
 * Typed POST request wrapper with validation and error handling
 */
const post = async <T, R = void>(
  url: string, 
  data: T, 
  config: RequestConfig = {}
): Promise<ApiResponse<R>> => {
  const response = await axiosInstance.post<ApiResponse<R>>(url, data, config);
  return response.data;
};

/**
 * Typed PUT request wrapper with validation and error handling
 */
const put = async <T, R = void>(
  url: string, 
  data: T, 
  config: RequestConfig = {}
): Promise<ApiResponse<R>> => {
  const response = await axiosInstance.put<ApiResponse<R>>(url, data, config);
  return response.data;
};

/**
 * Typed DELETE request wrapper with error handling
 */
const del = async <R = void>(
  url: string, 
  config: RequestConfig = {}
): Promise<ApiResponse<R>> => {
  const response = await axiosInstance.delete<ApiResponse<R>>(url, config);
  return response.data;
};

// Initialize interceptors
setupInterceptors();

// Export API service methods
export const api = {
  get,
  post,
  put,
  delete: del
};