/**
 * Template-related type definitions for the COREos platform frontend
 * Provides comprehensive type safety for template management functionality
 * @version 1.0.0
 */

/**
 * Enumeration of available template categories
 * Maps to business functional areas supported by the platform
 */
export enum TemplateCategory {
  SALES = 'sales',
  MARKETING = 'marketing',
  OPERATIONS = 'operations',
  FINANCE = 'finance',
  HR = 'hr',
  PRODUCT = 'product',
  CUSTOM = 'custom'
}

/**
 * Core template interface representing a business process template
 * Provides comprehensive type safety for template data structure
 */
export interface Template {
  /** Unique identifier for the template */
  id: string;
  
  /** Organization identifier owning the template */
  orgId: string;
  
  /** Human-readable template name */
  name: string;
  
  /** Detailed template description */
  description: string;
  
  /** Business category classification */
  category: TemplateCategory;
  
  /** Flexible template configuration content */
  content: Record<string, any>;
  
  /** Semantic version number (e.g., 1.0.0) */
  version: string;
  
  /** Template activation status */
  isActive: boolean;
  
  /** ISO timestamp of creation */
  createdAt: string;
  
  /** ISO timestamp of last update */
  updatedAt: string;
}

/**
 * Interface for template filtering options
 * Used for template list filtering and search
 */
export interface TemplateFilters {
  /** Filter by template category */
  category: TemplateCategory | null;
  
  /** Search term for template name/description */
  searchTerm: string;
  
  /** Filter by template activation status */
  isActive: boolean | null;
}

/**
 * Redux state interface for template management
 * Provides type safety for template-related state
 */
export interface TemplateState {
  /** List of available templates */
  templates: Template[];
  
  /** Currently selected template */
  selectedTemplate: Template | null;
  
  /** Loading state indicator */
  loading: boolean;
  
  /** Error message if present */
  error: string | null;
  
  /** Active filter settings */
  filters: TemplateFilters;
}

/**
 * Type-safe request interface for template creation
 * Ensures required fields are provided when creating templates
 */
export interface CreateTemplateRequest {
  /** Organization identifier for the new template */
  orgId: string;
  
  /** Template name */
  name: string;
  
  /** Template description */
  description: string;
  
  /** Template category */
  category: TemplateCategory;
  
  /** Template configuration content */
  content: Record<string, any>;
  
  /** Initial version number */
  version: string;
}

/**
 * Type-safe request interface for template updates
 * Ensures required fields are provided when updating templates
 */
export interface UpdateTemplateRequest {
  /** Template identifier to update */
  id: string;
  
  /** Updated template name */
  name: string;
  
  /** Updated template description */
  description: string;
  
  /** Updated template category */
  category: TemplateCategory;
  
  /** Updated template content */
  content: Record<string, any>;
  
  /** New version number */
  version: string;
  
  /** Updated activation status */
  isActive: boolean;
}