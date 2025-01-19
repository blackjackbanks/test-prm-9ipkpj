/**
 * @fileoverview Centralized routing configuration for COREos application.
 * Implements a MacOS-inspired navigation structure with type-safe route definitions.
 * @version 1.0.0
 */

/**
 * Type-safe interface defining all application route paths
 */
export interface Routes {
  readonly LOGIN: string;
  readonly DASHBOARD: string;
  readonly CHAT: string;
  readonly TEMPLATES: string;
  readonly TEMPLATES_NEW: string;
  readonly TEMPLATES_EDIT: string;
  readonly INTEGRATIONS: string;
  readonly INTEGRATIONS_NEW: string;
  readonly INTEGRATIONS_EDIT: string;
  readonly SETTINGS: string;
  readonly SETTINGS_PROFILE: string;
  readonly SETTINGS_ORGANIZATION: string;
  readonly NOT_FOUND: string;
}

/**
 * Centralized route path constants with nested route support.
 * Follows MacOS-style URL patterns for consistent navigation.
 */
export const ROUTES: Routes = {
  // Authentication
  LOGIN: '/login',

  // Main navigation
  DASHBOARD: '/',
  CHAT: '/chat',

  // Templates section
  TEMPLATES: '/templates',
  TEMPLATES_NEW: '/templates/new',
  TEMPLATES_EDIT: '/templates/:id',

  // Integrations section
  INTEGRATIONS: '/integrations',
  INTEGRATIONS_NEW: '/integrations/new',
  INTEGRATIONS_EDIT: '/integrations/:id',

  // Settings section
  SETTINGS: '/settings',
  SETTINGS_PROFILE: '/settings/profile',
  SETTINGS_ORGANIZATION: '/settings/organization',

  // Fallback route
  NOT_FOUND: '*'
} as const;

/**
 * Routes that require authentication to access.
 * Used by route protection middleware.
 */
export const PROTECTED_ROUTES = [
  ROUTES.DASHBOARD,
  ROUTES.CHAT,
  ROUTES.TEMPLATES,
  ROUTES.TEMPLATES_NEW,
  ROUTES.TEMPLATES_EDIT,
  ROUTES.INTEGRATIONS,
  ROUTES.INTEGRATIONS_NEW,
  ROUTES.INTEGRATIONS_EDIT,
  ROUTES.SETTINGS,
  ROUTES.SETTINGS_PROFILE,
  ROUTES.SETTINGS_ORGANIZATION
] as const;

/**
 * Routes that can be accessed without authentication.
 * Used by route protection middleware.
 */
export const PUBLIC_ROUTES = [
  ROUTES.LOGIN
] as const;