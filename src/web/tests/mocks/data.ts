/**
 * Mock data definitions for testing frontend components, hooks, and services
 * Provides standardized test data matching application type definitions
 * @version 1.0.0
 */

import { 
  User, 
  AuthResponse, 
  AuthState, 
  AuthError, 
  OAuthProvider, 
  MFAType 
} from '../../src/types/auth';

import {
  Integration,
  IntegrationType,
  IntegrationStatus,
  IntegrationSyncResult,
  IntegrationError
} from '../../src/types/integration';

import {
  Template,
  TemplateCategory,
  TemplateContent,
  TemplateError
} from '../../src/types/template';

// Mock User Data
export const mockUser: User = {
  id: 'usr_123456789',
  email: 'test@example.com',
  name: 'Test User',
  preferences: {
    theme: 'dark',
    notifications: true
  },
  mfaEnabled: true,
  mfaType: MFAType.TOTP,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  version: 1
};

// Mock Authentication Response
export const mockAuthResponse: AuthResponse = {
  accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  user: mockUser,
  mfaRequired: true
};

// Mock Authentication State
export const mockAuthState: AuthState = {
  user: mockUser,
  isAuthenticated: true,
  accessToken: mockAuthResponse.accessToken,
  refreshToken: mockAuthResponse.refreshToken,
  loadingState: 'SUCCESS',
  error: null
};

// Mock Authentication Error
export const mockAuthError: AuthError = {
  code: 'AUTH_001',
  message: 'Invalid credentials provided',
  details: {
    field: 'password',
    reason: 'Password must be at least 8 characters'
  }
};

// Mock Integration Data
export const mockIntegration: Integration = {
  id: 'int_123456789',
  organizationId: 'org_123456789',
  name: 'Salesforce Integration',
  type: IntegrationType.CRM,
  provider: 'salesforce',
  config: {
    apiKey: 'mock_api_key',
    apiUrl: 'https://api.salesforce.com/v1',
    version: '1.0.0',
    settings: {
      syncInterval: 3600
    }
  },
  status: IntegrationStatus.ACTIVE,
  healthScore: 98,
  active: true,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  lastSyncAt: new Date('2023-01-01')
};

// Mock Integration Sync Result
export const mockIntegrationSyncResult: IntegrationSyncResult = {
  success: true,
  message: 'Sync completed successfully',
  retryCount: 0,
  syncedAt: new Date('2023-01-01'),
  details: {
    recordsSynced: 150,
    duration: '00:02:30'
  }
};

// Mock Integration Error
export const mockIntegrationError: IntegrationError = {
  code: 'INT_001',
  message: 'API rate limit exceeded',
  timestamp: new Date('2023-01-01')
};

// Mock Template Data
export const mockTemplate: Template = {
  id: 'tpl_123456789',
  orgId: 'org_123456789',
  name: 'Sales Pipeline Template',
  description: 'Standard sales pipeline workflow template',
  category: TemplateCategory.SALES,
  content: {
    stages: ['Lead', 'Opportunity', 'Proposal', 'Negotiation', 'Closed'],
    automations: {
      leadScoring: true,
      emailNotifications: true
    }
  },
  version: '1.0.0',
  isActive: true,
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z'
};

// Mock Template with Rich Content
export const mockTemplateWithContent: Template = {
  ...mockTemplate,
  content: {
    stages: ['Lead', 'Opportunity', 'Proposal', 'Negotiation', 'Closed'],
    automations: {
      leadScoring: true,
      emailNotifications: true,
      taskAssignment: true
    },
    metrics: {
      conversionRate: 0.25,
      avgDealSize: 10000,
      salesCycle: 30
    },
    integrations: [
      {
        type: IntegrationType.CRM,
        provider: 'salesforce',
        required: true
      },
      {
        type: IntegrationType.ANALYTICS,
        provider: 'mixpanel',
        required: false
      }
    ]
  }
};

// Mock OAuth Providers
export const mockOAuthProviders = [
  {
    provider: OAuthProvider.GOOGLE,
    clientId: 'mock_google_client_id',
    scope: ['email', 'profile'],
    redirectUri: 'http://localhost:3000/auth/google/callback'
  },
  {
    provider: OAuthProvider.MICROSOFT,
    clientId: 'mock_microsoft_client_id',
    scope: ['user.read', 'mail.read'],
    redirectUri: 'http://localhost:3000/auth/microsoft/callback'
  }
];

// Mock Error States
export const mockErrors = {
  auth: mockAuthError,
  integration: mockIntegrationError,
  template: {
    code: 'TPL_001',
    message: 'Invalid template configuration',
    details: {
      field: 'content',
      reason: 'Missing required stages configuration'
    }
  }
};