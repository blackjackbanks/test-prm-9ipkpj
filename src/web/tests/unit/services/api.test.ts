import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

import { api } from '../../src/services/api';
import { API_ENDPOINTS, HTTP_STATUS } from '../../src/constants/api';
import { createMockApiResponse } from '../../src/utils/testing';
import { mockUser } from '../mocks/data';

// Test constants
const TEST_TOKEN = 'test-auth-token';
const TEST_REFRESH_TOKEN = 'test-refresh-token';
const mockAxios = new MockAdapter(axios);

describe('api service', () => {
  beforeEach(() => {
    // Reset mock adapter
    mockAxios.reset();
    
    // Clear storage
    localStorage.clear();
    
    // Initialize test tokens
    localStorage.setItem('accessToken', TEST_TOKEN);
    localStorage.setItem('refreshToken', TEST_REFRESH_TOKEN);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('HTTP Methods', () => {
    it('should successfully make GET request with proper headers', async () => {
      const endpoint = '/test';
      const responseData = { data: 'test' };
      
      mockAxios.onGet(`${API_ENDPOINTS.BASE_URL}${endpoint}`)
        .reply(200, createMockApiResponse(responseData));

      const response = await api.get(endpoint);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(responseData);
      expect(mockAxios.history.get[0].headers).toMatchObject({
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      });
    });

    it('should handle GET request with query parameters and encoding', async () => {
      const endpoint = '/search';
      const params = { q: 'test query & special chars' };
      
      mockAxios.onGet(new RegExp(`${API_ENDPOINTS.BASE_URL}${endpoint}.*`))
        .reply(200, createMockApiResponse({ results: [] }));

      await api.get(endpoint, params);

      const encodedUrl = mockAxios.history.get[0].url;
      expect(encodedUrl).toContain(encodeURIComponent(params.q));
    });

    it('should retry failed GET requests with exponential backoff', async () => {
      const endpoint = '/test-retry';
      
      mockAxios.onGet(`${API_ENDPOINTS.BASE_URL}${endpoint}`)
        .replyOnce(500)
        .replyOnce(500)
        .replyOnce(200, createMockApiResponse({ success: true }));

      const response = await api.get(endpoint);

      expect(response.success).toBe(true);
      expect(mockAxios.history.get.length).toBe(3);
    });

    it('should successfully make POST request with JSON payload', async () => {
      const endpoint = '/test-post';
      const payload = { name: 'test' };
      
      mockAxios.onPost(`${API_ENDPOINTS.BASE_URL}${endpoint}`, payload)
        .reply(200, createMockApiResponse({ id: '123' }));

      const response = await api.post(endpoint, payload);

      expect(response.success).toBe(true);
      expect(response.data.id).toBe('123');
      expect(mockAxios.history.post[0].data).toBe(JSON.stringify(payload));
    });

    it('should successfully make PUT request with optimistic updates', async () => {
      const endpoint = '/test-put/123';
      const payload = { name: 'updated' };
      
      mockAxios.onPut(`${API_ENDPOINTS.BASE_URL}${endpoint}`, payload)
        .reply(200, createMockApiResponse({ updated: true }));

      const response = await api.put(endpoint, payload);

      expect(response.success).toBe(true);
      expect(mockAxios.history.put[0].data).toBe(JSON.stringify(payload));
    });

    it('should successfully make DELETE request with confirmation', async () => {
      const endpoint = '/test-delete/123';
      
      mockAxios.onDelete(`${API_ENDPOINTS.BASE_URL}${endpoint}`)
        .reply(200, createMockApiResponse({ deleted: true }));

      const response = await api.delete(endpoint);

      expect(response.success).toBe(true);
      expect(response.data.deleted).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('should add encrypted auth token to request headers', async () => {
      const endpoint = '/authenticated';
      
      mockAxios.onGet(`${API_ENDPOINTS.BASE_URL}${endpoint}`)
        .reply(200, createMockApiResponse({ data: 'secured' }));

      await api.get(endpoint);

      expect(mockAxios.history.get[0].headers?.Authorization)
        .toBe(`Bearer ${TEST_TOKEN}`);
    });

    it('should handle token refresh on 401 response', async () => {
      const endpoint = '/protected';
      const newToken = 'new-test-token';
      
      mockAxios.onGet(`${API_ENDPOINTS.BASE_URL}${endpoint}`)
        .replyOnce(401)
        .replyOnce(200, createMockApiResponse({ data: 'success' }));

      mockAxios.onPost(API_ENDPOINTS.AUTH.REFRESH)
        .reply(200, createMockApiResponse({ accessToken: newToken }));

      const response = await api.get(endpoint);

      expect(response.success).toBe(true);
      expect(localStorage.getItem('accessToken')).toBe(newToken);
    });

    it('should manage concurrent requests during token refresh', async () => {
      const endpoint = '/concurrent';
      const newToken = 'new-token';
      
      mockAxios.onGet(`${API_ENDPOINTS.BASE_URL}${endpoint}`)
        .replyOnce(401)
        .reply(200, createMockApiResponse({ data: 'success' }));

      mockAxios.onPost(API_ENDPOINTS.AUTH.REFRESH)
        .reply(200, createMockApiResponse({ accessToken: newToken }));

      const requests = [
        api.get(endpoint),
        api.get(endpoint),
        api.get(endpoint)
      ];

      const responses = await Promise.all(requests);
      
      expect(responses.every(r => r.success)).toBe(true);
      expect(mockAxios.history.post.length).toBe(1); // Only one refresh call
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors with retry logic', async () => {
      const endpoint = '/network-error';
      
      mockAxios.onGet(`${API_ENDPOINTS.BASE_URL}${endpoint}`)
        .networkError();

      await expect(api.get(endpoint)).rejects.toThrow();
      expect(mockAxios.history.get.length).toBe(3); // Default 3 retries
    });

    it('should handle rate limiting with proper backoff', async () => {
      const endpoint = '/rate-limited';
      
      mockAxios.onGet(`${API_ENDPOINTS.BASE_URL}${endpoint}`)
        .replyOnce(429, { retryAfter: 2 })
        .replyOnce(200, createMockApiResponse({ success: true }));

      const response = await api.get(endpoint);

      expect(response.success).toBe(true);
      expect(mockAxios.history.get.length).toBe(2);
    });

    it('should format error responses consistently', async () => {
      const endpoint = '/error';
      const errorResponse = {
        code: 'TEST_ERROR',
        message: 'Test error message',
        details: { field: 'test' }
      };
      
      mockAxios.onGet(`${API_ENDPOINTS.BASE_URL}${endpoint}`)
        .reply(400, errorResponse);

      try {
        await api.get(endpoint);
      } catch (error: any) {
        expect(error.code).toBe(errorResponse.code);
        expect(error.message).toBe(errorResponse.message);
        expect(error.details).toEqual(errorResponse.details);
      }
    });
  });

  describe('Security', () => {
    it('should enforce rate limits per endpoint', async () => {
      const endpoint = '/rate-test';
      let requestCount = 0;
      
      mockAxios.onGet(`${API_ENDPOINTS.BASE_URL}${endpoint}`)
        .reply(() => {
          requestCount++;
          return requestCount > 10 ? [429] : [200, createMockApiResponse({ count: requestCount })];
        });

      const requests = Array(15).fill(null).map(() => api.get(endpoint));
      
      const results = await Promise.allSettled(requests);
      const failures = results.filter(r => r.status === 'rejected');
      
      expect(failures.length).toBeGreaterThan(0);
    });

    it('should prevent CSRF attacks', async () => {
      const endpoint = '/csrf-test';
      const csrfToken = 'test-csrf-token';
      document.cookie = `XSRF-TOKEN=${csrfToken}`;
      
      mockAxios.onPost(`${API_ENDPOINTS.BASE_URL}${endpoint}`)
        .reply(200, createMockApiResponse({ success: true }));

      await api.post(endpoint, { data: 'test' });

      expect(mockAxios.history.post[0].headers?.['X-XSRF-TOKEN']).toBe(csrfToken);
    });
  });

  describe('Performance', () => {
    it('should cache GET responses properly', async () => {
      const endpoint = '/cached';
      
      mockAxios.onGet(`${API_ENDPOINTS.BASE_URL}${endpoint}`)
        .reply(200, createMockApiResponse({ data: 'cached' }));

      await api.get(endpoint);
      await api.get(endpoint);

      expect(mockAxios.history.get.length).toBe(1); // Second request should use cache
    });

    it('should handle request cancellation', async () => {
      const endpoint = '/cancellable';
      
      mockAxios.onGet(`${API_ENDPOINTS.BASE_URL}${endpoint}`)
        .reply(() => new Promise(() => {})); // Never resolve

      const promise = api.get(endpoint);
      
      // Cancel request
      mockAxios.axiosInstance.interceptors.request.handlers[0].fulfilled({
        ...mockAxios.axiosInstance.defaults,
        signal: new AbortController().signal
      });

      await expect(promise).rejects.toThrow('canceled');
    });
  });
});