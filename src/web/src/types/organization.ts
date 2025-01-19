/**
 * TypeScript type definitions and interfaces for organization-related data structures.
 * Provides comprehensive type safety for organization entities, settings, and state management.
 * @version 1.0.0
 */

import { BaseModel, Theme, LoadingState, ApiError } from './common';

/**
 * Core organization interface extending BaseModel with organization-specific fields
 */
export interface Organization extends BaseModel {
  /** Organization name */
  name: string;
  /** Industry/sector the organization operates in */
  industry: string;
  /** Organization configuration and preferences */
  settings: OrganizationSettings;
  /** Current organization status */
  status: OrganizationStatus;
}

/**
 * Organization settings configuration interface
 */
export interface OrganizationSettings {
  /** UI theme preference */
  theme: Theme;
  /** Notification configuration */
  notifications: NotificationSettings;
  /** Default settings for integrations */
  integrationDefaults: Record<string, unknown>;
  /** Feature flags and toggles */
  features: Record<string, boolean>;
  /** Organization-wide preferences */
  preferences: OrganizationPreferences;
}

/**
 * Organization preferences interface for locale and display settings
 */
export interface OrganizationPreferences {
  /** Organization timezone */
  timezone: string;
  /** Date format preference */
  dateFormat: string;
  /** Interface language */
  language: string;
}

/**
 * Organization notification preferences interface
 */
export interface NotificationSettings {
  /** Enable/disable email notifications */
  email: boolean;
  /** Enable/disable in-app notifications */
  inApp: boolean;
  /** Notification delivery frequency */
  frequency: NotificationFrequency;
  /** Notification categories to subscribe to */
  categories: string[];
}

/**
 * Enum for notification frequency options
 */
export enum NotificationFrequency {
  /** Send notifications immediately */
  IMMEDIATE = 'IMMEDIATE',
  /** Aggregate and send daily */
  DAILY = 'DAILY',
  /** Aggregate and send weekly */
  WEEKLY = 'WEEKLY'
}

/**
 * Enum for organization status options
 */
export enum OrganizationStatus {
  /** Organization is active and operational */
  ACTIVE = 'ACTIVE',
  /** Organization is temporarily inactive */
  INACTIVE = 'INACTIVE',
  /** Organization is suspended due to policy violation */
  SUSPENDED = 'SUSPENDED'
}

/**
 * Redux state interface for organization data
 */
export interface OrganizationState {
  /** Current organization data */
  organization: Organization | null;
  /** Loading state for organization operations */
  loading: LoadingState;
  /** Error state for failed operations */
  error: ApiError | null;
  /** Timestamp of last data update */
  lastUpdated: Date | null;
}