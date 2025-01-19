/**
 * Service module providing typed API client methods for managing external service integrations.
 * Implements CRUD operations, configuration, and synchronization functionality with enhanced
 * security, monitoring, and error handling capabilities.
 * @version 1.0.0
 */

import { api } from './api';
import { API_ENDPOINTS } from '../constants/api';
import { 
  Integration,
  IntegrationCreateDTO,
  IntegrationUpdateDTO,
  IntegrationSyncResult,
  IntegrationStatus
} from '../types/integration';
import { ApiResponse } from '@core/api-types';
import { retry } from 'axios-retry';
import { cache } from 'memory-cache';

// Cache configuration
const CACHE_TTL = 300000; // 5 minutes
const CACHE_KEY_INTEGRATIONS = 'org_integrations';

/**
 * Decorator for monitoring integration operations
 */
const monitor = (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
  const originalMethod = descriptor.value;
  descriptor.value = async function(...args: any[]) {
    const startTime = Date.now();
    try {
      const result = await originalMethod.apply(this, args);
      // Monitor operation duration
      const duration = Date.now() - startTime;
      console.info(`[Integration] ${propertyKey} completed in ${duration}ms`);
      return result;
    } catch (error) {
      // Log operation failure
      console.error(`[Integration] ${propertyKey} failed:`, error);
      throw error;
    }
  };
  return descriptor;
};

/**
 * Decorator for audit logging integration operations
 */
const auditLog = (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
  const originalMethod = descriptor.value;
  descriptor.value = async function(...args: any[]) {
    const result = await originalMethod.apply(this, args);
    // Log operation details
    console.info(`[Audit] Integration operation ${propertyKey}:`, {
      timestamp: new Date(),
      args,
      result: result.success
    });
    return result;
  };
  return descriptor;
};

/**
 * Service class for managing external service integrations
 */
class IntegrationService {
  /**
   * Retrieves all integrations for the current organization
   * @returns Promise resolving to list of integrations
   */
  @monitor
  async getIntegrations(): Promise<ApiResponse<Integration[]>> {
    // Check cache first
    const cached = cache.get(CACHE_KEY_INTEGRATIONS);
    if (cached) {
      return cached;
    }

    const response = await api.get<Integration[]>(
      API_ENDPOINTS.INTEGRATIONS.BASE,
      undefined,
      { 
        skipCache: true,
        retryAttempts: 2
      }
    );

    // Cache successful response
    if (response.success) {
      cache.put(CACHE_KEY_INTEGRATIONS, response, CACHE_TTL);
    }

    return response;
  }

  /**
   * Creates a new integration
   * @param data Integration creation data
   * @returns Promise resolving to created integration
   */
  @monitor
  @auditLog
  async createIntegration(data: IntegrationCreateDTO): Promise<ApiResponse<Integration>> {
    const response = await api.post<IntegrationCreateDTO, Integration>(
      API_ENDPOINTS.INTEGRATIONS.BASE,
      data
    );

    // Invalidate cache on successful creation
    if (response.success) {
      cache.del(CACHE_KEY_INTEGRATIONS);
    }

    return response;
  }

  /**
   * Updates an existing integration
   * @param id Integration ID
   * @param data Update data
   * @returns Promise resolving to updated integration
   */
  @monitor
  @auditLog
  async updateIntegration(
    id: string,
    data: IntegrationUpdateDTO
  ): Promise<ApiResponse<Integration>> {
    const response = await api.put<IntegrationUpdateDTO, Integration>(
      API_ENDPOINTS.INTEGRATIONS.DETAILS(id),
      data
    );

    // Invalidate cache on successful update
    if (response.success) {
      cache.del(CACHE_KEY_INTEGRATIONS);
    }

    return response;
  }

  /**
   * Deletes an integration
   * @param id Integration ID
   * @returns Promise resolving to deletion confirmation
   */
  @monitor
  @auditLog
  async deleteIntegration(id: string): Promise<ApiResponse<void>> {
    const response = await api.delete<void>(
      API_ENDPOINTS.INTEGRATIONS.DETAILS(id)
    );

    // Invalidate cache on successful deletion
    if (response.success) {
      cache.del(CACHE_KEY_INTEGRATIONS);
    }

    return response;
  }

  /**
   * Tests integration connectivity
   * @param id Integration ID
   * @returns Promise resolving to test results
   */
  @monitor
  async testIntegration(id: string): Promise<ApiResponse<boolean>> {
    return await api.post<void, boolean>(
      API_ENDPOINTS.INTEGRATIONS.TEST(id),
      {}
    );
  }

  /**
   * Triggers integration synchronization with retry logic
   * @param id Integration ID
   * @returns Promise resolving to sync results
   */
  @monitor
  @auditLog
  @retry({ retries: 3 })
  async syncIntegration(id: string): Promise<ApiResponse<IntegrationSyncResult>> {
    // Pre-sync status check
    const integration = await api.get<Integration>(
      API_ENDPOINTS.INTEGRATIONS.DETAILS(id)
    );

    if (integration.data.status === IntegrationStatus.SYNCING) {
      throw new Error('Sync already in progress');
    }

    // Initiate sync
    const response = await api.post<void, IntegrationSyncResult>(
      API_ENDPOINTS.INTEGRATIONS.SYNC(id),
      {}
    );

    // Invalidate cache on successful sync
    if (response.success) {
      cache.del(CACHE_KEY_INTEGRATIONS);
    }

    return response;
  }

  /**
   * Configures integration settings
   * @param id Integration ID
   * @param config Configuration data
   * @returns Promise resolving to updated integration
   */
  @monitor
  @auditLog
  async configureIntegration(
    id: string,
    config: Partial<Integration['config']>
  ): Promise<ApiResponse<Integration>> {
    const response = await api.put<Partial<Integration['config']>, Integration>(
      API_ENDPOINTS.INTEGRATIONS.CONFIGURE(id),
      config
    );

    // Invalidate cache on successful configuration
    if (response.success) {
      cache.del(CACHE_KEY_INTEGRATIONS);
    }

    return response;
  }
}

// Export singleton instance
export const integrationService = new IntegrationService();