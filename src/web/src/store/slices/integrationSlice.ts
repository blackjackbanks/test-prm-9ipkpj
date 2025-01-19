/**
 * Redux Toolkit slice for managing external service integration state.
 * Handles integration data, loading states, pagination, search/filter state,
 * and async operations with enhanced error handling and caching.
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, createSelector, PayloadAction } from '@reduxjs/toolkit';
import { 
  Integration, 
  IntegrationCreateDTO, 
  IntegrationUpdateDTO, 
  IntegrationStatus,
  IntegrationSyncResult 
} from '../../types/integration';
import { integrationService } from '../../services/integrations';
import { LoadingState, PaginationParams, ApiError } from '../../types/common';

// State interface
interface IntegrationState {
  entities: Record<string, Integration>;
  loadingStates: Record<string, LoadingState>;
  errors: Record<string, ApiError | null>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  filters: {
    search: string;
    status: IntegrationStatus[];
    type: string[];
  };
}

// Initial state
const initialState: IntegrationState = {
  entities: {},
  loadingStates: {},
  errors: {},
  pagination: {
    page: 0,
    limit: 10,
    total: 0,
    hasMore: false
  },
  filters: {
    search: '',
    status: [],
    type: []
  }
};

// Async thunks
export const fetchIntegrations = createAsyncThunk(
  'integrations/fetchIntegrations',
  async (params: { pagination: PaginationParams; filters?: Partial<IntegrationState['filters']> }) => {
    const response = await integrationService.getIntegrations();
    return response.data;
  }
);

export const createIntegration = createAsyncThunk(
  'integrations/createIntegration',
  async (data: IntegrationCreateDTO) => {
    const response = await integrationService.createIntegration(data);
    return response.data;
  }
);

export const updateIntegration = createAsyncThunk(
  'integrations/updateIntegration',
  async ({ id, data }: { id: string; data: IntegrationUpdateDTO }) => {
    const response = await integrationService.updateIntegration(id, data);
    return response.data;
  }
);

export const deleteIntegration = createAsyncThunk(
  'integrations/deleteIntegration',
  async (id: string) => {
    await integrationService.deleteIntegration(id);
    return id;
  }
);

export const syncIntegration = createAsyncThunk(
  'integrations/syncIntegration',
  async (id: string) => {
    const response = await integrationService.syncIntegration(id);
    return { id, result: response.data };
  }
);

export const testIntegration = createAsyncThunk(
  'integrations/testIntegration',
  async (id: string) => {
    const response = await integrationService.testIntegration(id);
    return { id, success: response.data };
  }
);

// Slice definition
const integrationSlice = createSlice({
  name: 'integrations',
  initialState,
  reducers: {
    setFilters(state, action: PayloadAction<Partial<IntegrationState['filters']>>) {
      state.filters = { ...state.filters, ...action.payload };
      state.pagination.page = 0; // Reset pagination when filters change
    },
    resetFilters(state) {
      state.filters = initialState.filters;
      state.pagination.page = 0;
    },
    setLoadingState(state, action: PayloadAction<{ operation: string; status: LoadingState }>) {
      state.loadingStates[action.payload.operation] = action.payload.status;
    },
    clearError(state, action: PayloadAction<string>) {
      state.errors[action.payload] = null;
    }
  },
  extraReducers: (builder) => {
    // Fetch integrations
    builder.addCase(fetchIntegrations.pending, (state) => {
      state.loadingStates['fetch'] = LoadingState.LOADING;
      state.errors['fetch'] = null;
    });
    builder.addCase(fetchIntegrations.fulfilled, (state, action) => {
      state.loadingStates['fetch'] = LoadingState.SUCCESS;
      state.entities = action.payload.reduce((acc, integration) => {
        acc[integration.id] = integration;
        return acc;
      }, {} as Record<string, Integration>);
      state.pagination.total = action.payload.length;
    });
    builder.addCase(fetchIntegrations.rejected, (state, action) => {
      state.loadingStates['fetch'] = LoadingState.ERROR;
      state.errors['fetch'] = action.error as ApiError;
    });

    // Create integration
    builder.addCase(createIntegration.fulfilled, (state, action) => {
      state.entities[action.payload.id] = action.payload;
      state.pagination.total += 1;
    });

    // Update integration
    builder.addCase(updateIntegration.fulfilled, (state, action) => {
      state.entities[action.payload.id] = action.payload;
    });

    // Delete integration
    builder.addCase(deleteIntegration.fulfilled, (state, action) => {
      delete state.entities[action.payload];
      state.pagination.total -= 1;
    });

    // Sync integration
    builder.addCase(syncIntegration.fulfilled, (state, action) => {
      if (state.entities[action.payload.id]) {
        state.entities[action.payload.id].lastSyncAt = new Date();
        state.entities[action.payload.id].status = 
          action.payload.result.success ? IntegrationStatus.ACTIVE : IntegrationStatus.ERROR;
      }
    });

    // Test integration
    builder.addCase(testIntegration.fulfilled, (state, action) => {
      if (state.entities[action.payload.id]) {
        state.entities[action.payload.id].status = 
          action.payload.success ? IntegrationStatus.ACTIVE : IntegrationStatus.ERROR;
      }
    });
  }
});

// Selectors
export const selectAllIntegrations = (state: { integrations: IntegrationState }) => 
  Object.values(state.integrations.entities);

export const selectIntegrationById = (state: { integrations: IntegrationState }, id: string) => 
  state.integrations.entities[id];

export const selectFilteredIntegrations = createSelector(
  [selectAllIntegrations, (state: { integrations: IntegrationState }) => state.integrations.filters],
  (integrations, filters) => {
    return integrations.filter(integration => {
      const matchesSearch = !filters.search || 
        integration.name.toLowerCase().includes(filters.search.toLowerCase());
      const matchesStatus = filters.status.length === 0 || 
        filters.status.includes(integration.status);
      const matchesType = filters.type.length === 0 || 
        filters.type.includes(integration.type);
      return matchesSearch && matchesStatus && matchesType;
    });
  }
);

export const selectPaginationState = (state: { integrations: IntegrationState }) => 
  state.integrations.pagination;

export const selectLoadingState = (state: { integrations: IntegrationState }, operation: string) => 
  state.integrations.loadingStates[operation] || LoadingState.IDLE;

export const selectError = (state: { integrations: IntegrationState }, operation: string) => 
  state.integrations.errors[operation];

// Export actions and reducer
export const { setFilters, resetFilters, setLoadingState, clearError } = integrationSlice.actions;
export default integrationSlice.reducer;