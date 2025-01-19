/**
 * Template management service providing comprehensive CRUD operations,
 * deployment functionality, and enhanced type-safe error handling.
 * @version 1.0.0
 */

import { api } from './api';
import { API_ENDPOINTS } from '../constants/api';
import { 
  Template, 
  CreateTemplateRequest, 
  UpdateTemplateRequest, 
  TemplateCategory 
} from '../types/template';
import { ApiResponse, ApiError } from '../types/common';

/**
 * Interface for template deployment results
 */
interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  status: 'COMPLETED' | 'FAILED' | 'IN_PROGRESS';
  details: Record<string, any>;
  timestamp: string;
}

/**
 * Interface for template version info
 */
interface TemplateVersion {
  version: string;
  createdAt: string;
  changes: string[];
  author: string;
}

/**
 * Retrieves all templates for an organization with filtering support
 * @param orgId Organization identifier
 * @param filters Optional template filters
 */
const getTemplates = async (
  orgId: string,
  filters?: Partial<{ category: TemplateCategory; searchTerm: string; isActive: boolean }>
): Promise<ApiResponse<Template[]>> => {
  return api.get<Template[]>(API_ENDPOINTS.TEMPLATES.BASE, {
    orgId,
    ...filters
  });
};

/**
 * Retrieves a specific template by ID
 * @param id Template identifier
 */
const getTemplateById = async (id: string): Promise<ApiResponse<Template>> => {
  return api.get<Template>(API_ENDPOINTS.TEMPLATES.DETAILS(id));
};

/**
 * Creates a new template with validation
 * @param template Template creation request
 */
const createTemplate = async (
  template: CreateTemplateRequest
): Promise<ApiResponse<Template>> => {
  return api.post<CreateTemplateRequest, Template>(
    API_ENDPOINTS.TEMPLATES.BASE,
    template
  );
};

/**
 * Updates an existing template with version management
 * @param template Template update request
 */
const updateTemplate = async (
  template: UpdateTemplateRequest
): Promise<ApiResponse<Template>> => {
  return api.put<UpdateTemplateRequest, Template>(
    API_ENDPOINTS.TEMPLATES.DETAILS(template.id),
    template
  );
};

/**
 * Deletes a template with safety checks
 * @param id Template identifier
 * @param orgId Organization identifier for validation
 */
const deleteTemplate = async (
  id: string,
  orgId: string
): Promise<ApiResponse<void>> => {
  return api.delete(API_ENDPOINTS.TEMPLATES.DETAILS(id), {
    params: { orgId }
  });
};

/**
 * Deploys a template with enhanced status tracking
 * @param id Template identifier
 * @param orgId Organization identifier
 * @param options Optional deployment configuration
 */
const deployTemplate = async (
  id: string,
  orgId: string,
  options?: {
    environment?: 'development' | 'production';
    variables?: Record<string, any>;
  }
): Promise<ApiResponse<DeploymentResult>> => {
  return api.post<typeof options, DeploymentResult>(
    API_ENDPOINTS.TEMPLATES.DEPLOY(id),
    {
      orgId,
      ...options
    }
  );
};

/**
 * Previews a template before deployment
 * @param id Template identifier
 * @param variables Template variables for preview
 */
const previewTemplate = async (
  id: string,
  variables?: Record<string, any>
): Promise<ApiResponse<Record<string, any>>> => {
  return api.post<typeof variables, Record<string, any>>(
    API_ENDPOINTS.TEMPLATES.PREVIEW(id),
    { variables }
  );
};

/**
 * Retrieves template version history
 * @param id Template identifier
 */
const getTemplateVersions = async (
  id: string
): Promise<ApiResponse<TemplateVersion[]>> => {
  return api.get<TemplateVersion[]>(
    `${API_ENDPOINTS.TEMPLATES.DETAILS(id)}/versions`
  );
};

/**
 * Validates template configuration
 * @param template Template to validate
 */
const validateTemplate = async (
  template: Partial<Template>
): Promise<ApiResponse<{ valid: boolean; errors: string[] }>> => {
  return api.post<Partial<Template>, { valid: boolean; errors: string[] }>(
    `${API_ENDPOINTS.TEMPLATES.BASE}/validate`,
    template
  );
};

/**
 * Retrieves available template categories
 */
const getTemplateCategories = async (): Promise<ApiResponse<TemplateCategory[]>> => {
  return api.get<TemplateCategory[]>(API_ENDPOINTS.TEMPLATES.CATEGORIES);
};

// Export template service methods
export const templateService = {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  deployTemplate,
  previewTemplate,
  getTemplateVersions,
  validateTemplate,
  getTemplateCategories
};