/**
 * Core TypeScript type definitions and interfaces used across the frontend application.
 * Provides comprehensive type safety through strictly typed interfaces, enums, and utility types.
 * @version 1.0.0
 */

/**
 * Base interface for all data models with common audit fields and optimistic locking
 */
export interface BaseModel {
  /** Unique identifier */
  id: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Version number for optimistic locking */
  version: number;
}

/**
 * Generic interface for type-safe API responses with metadata
 * @template T The type of data contained in the response
 */
export interface ApiResponse<T> {
  /** Whether the API call was successful */
  success: boolean;
  /** Human readable message about the response */
  message: string;
  /** The actual response data */
  data: T;
  /** Response timestamp */
  timestamp: Date;
}

/**
 * Comprehensive error interface for standardized error handling
 */
export interface ApiError {
  /** Machine-readable error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error context and details */
  details: Record<string, unknown>;
  /** Error timestamp */
  timestamp: Date;
  /** Request path that generated the error */
  path: string;
}

/**
 * Enum for tracking loading states in Redux store and UI components
 */
export enum LoadingState {
  /** Initial state before any loading attempt */
  IDLE = 'IDLE',
  /** Currently loading data */
  LOADING = 'LOADING',
  /** Data loaded successfully */
  SUCCESS = 'SUCCESS',
  /** Loading failed with error */
  ERROR = 'ERROR',
  /** Partial data loaded with some errors */
  PARTIAL = 'PARTIAL'
}

/**
 * Type-safe interface for pagination and filtering parameters
 */
export interface PaginationParams {
  /** Current page number (0-based) */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Field to sort by */
  sortBy: string;
  /** Sort direction */
  sortOrder: SortOrder;
  /** Optional filtering criteria */
  filters: Record<string, unknown>;
}

/**
 * Enum for type-safe sort order options
 */
export enum SortOrder {
  /** Ascending order */
  ASC = 'ASC',
  /** Descending order */
  DESC = 'DESC'
}

/**
 * Generic interface for paginated API responses
 * @template T The type of items being paginated
 */
export interface PaginatedResponse<T> {
  /** Array of paginated items */
  items: T[];
  /** Total number of items across all pages */
  total: number;
  /** Current page number */
  page: number;
  /** Items per page */
  limit: number;
  /** Whether there are more pages available */
  hasMore: boolean;
  /** Total number of pages */
  totalPages: number;
}

/**
 * Enum for application theme options
 */
export enum Theme {
  /** Light theme */
  LIGHT = 'LIGHT',
  /** Dark theme */
  DARK = 'DARK',
  /** System preference-based theme */
  SYSTEM = 'SYSTEM'
}