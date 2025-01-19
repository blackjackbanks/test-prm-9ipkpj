/**
 * Organization service module providing comprehensive API operations and data management
 * with enhanced error handling, caching, and type safety.
 * @version 1.0.0
 */

import axios from 'axios'; // v1.4.0
import { Organization } from '../types/organization';
import { API_ENDPOINTS } from '../constants/api';
import { transformResponse, transformError, apiClient, retryRequest } from '../utils/api';
import { ApiResponse, ApiError } from '../types/common';

// Cache configuration
const ORGANIZATION_CACHE_TTL = 300000; // 5 minutes in milliseconds
const organizationCache = new Map<string, { data: Organization; timestamp: number }>();

/**
 * Retrieves organization details by ID with caching and error handling
 * @param id Organization identifier
 * @returns Promise resolving to organization details
 * @throws ApiError if retrieval fails
 */
export async function getOrganization(id: string): Promise<Organization> {
  // Check cache first
  const cached = organizationCache.get(id);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < ORGANIZATION_CACHE_TTL) {
    return cached.data;
  }

  try {
    const response = await apiClient.get<ApiResponse<Organization>>(
      API_ENDPOINTS.ORGANIZATIONS.DETAILS(id)
    );

    // Cache the successful response
    organizationCache.set(id, {
      data: response.data,
      timestamp: now
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw transformError(error);
    }
    throw error;
  }
}

/**
 * Creates a new organization with validation and error handling
 * @param organizationData Organization creation data
 * @returns Promise resolving to created organization
 * @throws ApiError if creation fails
 */
export async function createOrganization(
  organizationData: Partial<Organization>
): Promise<Organization> {
  try {
    const response = await apiClient.post<ApiResponse<Organization>>(
      API_ENDPOINTS.ORGANIZATIONS.BASE,
      organizationData
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw transformError(error);
    }
    throw error;
  }
}

/**
 * Updates an existing organization with partial updates support
 * @param id Organization identifier
 * @param organizationData Partial organization update data
 * @returns Promise resolving to updated organization
 * @throws ApiError if update fails
 */
export async function updateOrganization(
  id: string,
  organizationData: Partial<Organization>
): Promise<Organization> {
  try {
    const response = await apiClient.put<ApiResponse<Organization>>(
      API_ENDPOINTS.ORGANIZATIONS.DETAILS(id),
      organizationData
    );

    // Update cache with new data
    organizationCache.set(id, {
      data: response.data,
      timestamp: Date.now()
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // Attempt retry for network errors
      if (!error.response && error.config) {
        return retryRequest(error.config)
          .then(response => transformResponse<Organization>(response).data)
          .catch(retryError => {
            throw transformError(retryError);
          });
      }
      throw transformError(error);
    }
    throw error;
  }
}

/**
 * Updates organization settings with validation
 * @param id Organization identifier
 * @param settings Organization settings update
 * @returns Promise resolving to organization with updated settings
 * @throws ApiError if settings update fails
 */
export async function updateOrganizationSettings(
  id: string,
  settings: Organization['settings']
): Promise<Organization> {
  try {
    const response = await apiClient.patch<ApiResponse<Organization>>(
      API_ENDPOINTS.ORGANIZATIONS.SETTINGS(id),
      { settings }
    );

    // Update cache with new settings
    const cached = organizationCache.get(id);
    if (cached) {
      organizationCache.set(id, {
        data: {
          ...cached.data,
          settings: response.data.settings
        },
        timestamp: Date.now()
      });
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw transformError(error);
    }
    throw error;
  }
}

/**
 * Invalidates the organization cache for a specific ID
 * @param id Organization identifier to invalidate
 */
export function invalidateOrganizationCache(id: string): void {
  organizationCache.delete(id);
}

/**
 * Clears the entire organization cache
 */
export function clearOrganizationCache(): void {
  organizationCache.clear();
}