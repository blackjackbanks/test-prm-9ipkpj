/**
 * Redux slice for managing template state in the COREos platform frontend
 * Implements comprehensive template CRUD operations with TypeScript type safety
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, createSelector, PayloadAction } from '@reduxjs/toolkit';
import { Template, TemplateState, TemplateFilters, TemplateCategory } from '../../types/template';
import { ApiError, LoadingState, PaginationParams } from '../../types/common';

// Cache configuration
const CACHE_TTL = 300000; // 5 minutes in milliseconds
const MAX_RETRIES = 3;

// Initial state with type safety
const initialState: TemplateState = {
  templates: [],
  selectedTemplate: null,
  loadingState: LoadingState.IDLE,
  lastError: null,
  filters: {
    category: null,
    searchTerm: '',
    isActive: null
  }
};

// Async thunks for template operations
export const fetchTemplates = createAsyncThunk<
  Template[],
  { orgId: string; filters: TemplateFilters; pagination: PaginationParams },
  { rejectValue: ApiError }
>(
  'templates/fetchTemplates',
  async ({ orgId, filters, pagination }, { rejectWithValue, dispatch }) => {
    try {
      const response = await templateService.getTemplates(orgId, filters, pagination);
      return response.data;
    } catch (error) {
      return rejectWithValue(error as ApiError);
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as { templates: TemplateState };
      return state.templates.loadingState !== LoadingState.LOADING;
    }
  }
);

export const createTemplate = createAsyncThunk<
  Template,
  Omit<Template, 'id' | 'createdAt' | 'updatedAt'>,
  { rejectValue: ApiError }
>(
  'templates/createTemplate',
  async (template, { rejectWithValue }) => {
    try {
      const response = await templateService.createTemplate(template);
      return response.data;
    } catch (error) {
      return rejectWithValue(error as ApiError);
    }
  }
);

export const updateTemplate = createAsyncThunk<
  Template,
  Partial<Template> & Pick<Template, 'id'>,
  { rejectValue: ApiError }
>(
  'templates/updateTemplate',
  async (template, { rejectWithValue }) => {
    try {
      const response = await templateService.updateTemplate(template);
      return response.data;
    } catch (error) {
      return rejectWithValue(error as ApiError);
    }
  }
);

export const deleteTemplate = createAsyncThunk<
  string,
  string,
  { rejectValue: ApiError }
>(
  'templates/deleteTemplate',
  async (templateId, { rejectWithValue }) => {
    try {
      await templateService.deleteTemplate(templateId);
      return templateId;
    } catch (error) {
      return rejectWithValue(error as ApiError);
    }
  }
);

export const validateTemplate = createAsyncThunk<
  { id: string; isValid: boolean },
  { id: string; content: Record<string, any> },
  { rejectValue: ApiError }
>(
  'templates/validateTemplate',
  async ({ id, content }, { rejectWithValue }) => {
    try {
      const response = await templateService.validateTemplate(id, content);
      return { id, isValid: response.data.isValid };
    } catch (error) {
      return rejectWithValue(error as ApiError);
    }
  }
);

// Create the template slice
const templateSlice = createSlice({
  name: 'templates',
  initialState,
  reducers: {
    setSelectedTemplate: (state, action: PayloadAction<Template | null>) => {
      state.selectedTemplate = action.payload;
    },
    setFilters: (state, action: PayloadAction<TemplateFilters>) => {
      state.filters = action.payload;
    },
    clearError: (state) => {
      state.lastError = null;
    },
    resetState: () => initialState
  },
  extraReducers: (builder) => {
    // Fetch templates
    builder.addCase(fetchTemplates.pending, (state) => {
      state.loadingState = LoadingState.LOADING;
    });
    builder.addCase(fetchTemplates.fulfilled, (state, action) => {
      state.templates = action.payload;
      state.loadingState = LoadingState.SUCCESS;
      state.lastError = null;
    });
    builder.addCase(fetchTemplates.rejected, (state, action) => {
      state.loadingState = LoadingState.ERROR;
      state.lastError = action.payload || null;
    });

    // Create template
    builder.addCase(createTemplate.fulfilled, (state, action) => {
      state.templates.push(action.payload);
      state.lastError = null;
    });
    builder.addCase(createTemplate.rejected, (state, action) => {
      state.lastError = action.payload || null;
    });

    // Update template
    builder.addCase(updateTemplate.fulfilled, (state, action) => {
      const index = state.templates.findIndex(t => t.id === action.payload.id);
      if (index !== -1) {
        state.templates[index] = action.payload;
      }
      if (state.selectedTemplate?.id === action.payload.id) {
        state.selectedTemplate = action.payload;
      }
      state.lastError = null;
    });
    builder.addCase(updateTemplate.rejected, (state, action) => {
      state.lastError = action.payload || null;
    });

    // Delete template
    builder.addCase(deleteTemplate.fulfilled, (state, action) => {
      state.templates = state.templates.filter(t => t.id !== action.payload);
      if (state.selectedTemplate?.id === action.payload) {
        state.selectedTemplate = null;
      }
      state.lastError = null;
    });
    builder.addCase(deleteTemplate.rejected, (state, action) => {
      state.lastError = action.payload || null;
    });

    // Validate template
    builder.addCase(validateTemplate.fulfilled, (state, action) => {
      const template = state.templates.find(t => t.id === action.payload.id);
      if (template) {
        template.isValid = action.payload.isValid;
      }
      state.lastError = null;
    });
  }
});

// Selectors
export const selectAllTemplates = (state: { templates: TemplateState }) => state.templates.templates;
export const selectSelectedTemplate = (state: { templates: TemplateState }) => state.templates.selectedTemplate;
export const selectLoadingState = (state: { templates: TemplateState }) => state.templates.loadingState;
export const selectLastError = (state: { templates: TemplateState }) => state.templates.lastError;
export const selectFilters = (state: { templates: TemplateState }) => state.templates.filters;

// Memoized selectors
export const selectFilteredTemplates = createSelector(
  [selectAllTemplates, selectFilters],
  (templates, filters) => {
    return templates.filter(template => {
      const categoryMatch = !filters.category || template.category === filters.category;
      const searchMatch = !filters.searchTerm || 
        template.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        template.description.toLowerCase().includes(filters.searchTerm.toLowerCase());
      const activeMatch = filters.isActive === null || template.isActive === filters.isActive;
      return categoryMatch && searchMatch && activeMatch;
    });
  }
);

export const selectTemplatesByCategory = createSelector(
  [selectAllTemplates],
  (templates) => {
    return Object.values(TemplateCategory).reduce((acc, category) => {
      acc[category] = templates.filter(t => t.category === category);
      return acc;
    }, {} as Record<TemplateCategory, Template[]>);
  }
);

// Export actions and reducer
export const { setSelectedTemplate, setFilters, clearError, resetState } = templateSlice.actions;
export default templateSlice.reducer;