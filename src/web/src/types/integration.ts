/**
 * @fileoverview TypeScript type definitions for external service integrations
 * Defines data models, DTOs and configuration types for the integration framework
 * @version 1.0.0
 */

/**
 * Enumeration of supported integration types
 */
export enum IntegrationType {
  CRM = 'CRM',
  DOCUMENTS = 'DOCUMENTS',
  ANALYTICS = 'ANALYTICS'
}

/**
 * Enumeration of integration status values
 */
export enum IntegrationStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ERROR = 'ERROR',
  CONFIGURING = 'CONFIGURING',
  SYNCING = 'SYNCING'
}

/**
 * Type definitions for supported providers per integration type
 */
export const IntegrationProvider = {
  CRM_PROVIDERS: ['salesforce', 'hubspot', 'zoho'] as const,
  DOCUMENT_PROVIDERS: ['google_docs', 'microsoft_365', 'dropbox'] as const,
  ANALYTICS_PROVIDERS: ['google_analytics', 'mixpanel', 'amplitude'] as const
} as const;

/**
 * Interface for OAuth configuration
 */
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

/**
 * Interface for integration configuration data
 */
export interface IntegrationConfig {
  apiKey?: string;
  apiUrl?: string;
  oauthConfig?: OAuthConfig;
  settings: Record<string, unknown>;
  version: string;
}

/**
 * Interface for integration error details
 */
export interface IntegrationError {
  code: string;
  message: string;
  timestamp: Date;
}

/**
 * Main interface for integration data model
 */
export interface Integration {
  id: string;
  organizationId: string;
  name: string;
  type: IntegrationType;
  provider: string;
  config: IntegrationConfig;
  status: IntegrationStatus;
  healthScore: number;
  active: boolean;
  lastError?: IntegrationError;
  createdAt: Date;
  updatedAt: Date;
  lastSyncAt?: Date;
}

/**
 * DTO interface for creating new integrations
 */
export interface IntegrationCreateDTO {
  name: string;
  type: IntegrationType;
  provider: string;
  config: IntegrationConfig;
}

/**
 * DTO interface for updating existing integrations
 */
export interface IntegrationUpdateDTO {
  name?: string;
  config?: Partial<IntegrationConfig>;
  active?: boolean;
}

/**
 * Interface for integration sync operation results
 */
export interface IntegrationSyncResult {
  success: boolean;
  message: string;
  errorCode?: string;
  retryCount: number;
  nextRetryAt?: Date;
  syncedAt: Date;
  details: Record<string, unknown>;
}

/**
 * Type guard to check if a provider is valid for a given integration type
 */
export const isValidProvider = (
  type: IntegrationType,
  provider: string
): boolean => {
  switch (type) {
    case IntegrationType.CRM:
      return IntegrationProvider.CRM_PROVIDERS.includes(provider as typeof IntegrationProvider.CRM_PROVIDERS[number]);
    case IntegrationType.DOCUMENTS:
      return IntegrationProvider.DOCUMENT_PROVIDERS.includes(provider as typeof IntegrationProvider.DOCUMENT_PROVIDERS[number]);
    case IntegrationType.ANALYTICS:
      return IntegrationProvider.ANALYTICS_PROVIDERS.includes(provider as typeof IntegrationProvider.ANALYTICS_PROVIDERS[number]);
    default:
      return false;
  }
};

/**
 * Type for integration health check function
 */
export type HealthCheckFn = (integration: Integration) => Promise<number>;

/**
 * Type for integration sync function
 */
export type SyncFn = (integration: Integration) => Promise<IntegrationSyncResult>;