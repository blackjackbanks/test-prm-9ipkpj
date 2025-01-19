/**
 * Root Redux store configuration for the COREos frontend application.
 * Combines all feature slices and configures middleware, devtools, and store enhancers.
 * @version 1.0.0
 */

import { configureStore } from '@reduxjs/toolkit'; // v1.9.0
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'; // v8.1.0

// Import reducers from feature slices
import authReducer from './slices/authSlice';
import chatReducer from './slices/chatSlice';
import integrationReducer from './slices/integrationSlice';
import templateReducer from './slices/templateSlice';
import uiReducer from './slices/uiSlice';

/**
 * Creates and configures the Redux store with all middleware and enhancers
 */
const makeStore = () => {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      chat: chatReducer,
      integrations: integrationReducer,
      templates: templateReducer,
      ui: uiReducer
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
      serializableCheck: {
        // Ignore non-serializable values in specific paths
        ignoredActions: ['auth/recordSecurityEvent'],
        ignoredPaths: [
          'auth.securityEvents',
          'chat.messages.metadata',
          'integrations.entities.config'
        ]
      },
      thunk: {
        extraArgument: undefined
      }
    }),
    devTools: {
      name: 'COREos',
      trace: true,
      traceLimit: 25,
      // Ensure sensitive data is not logged
      actionSanitizer: (action) => {
        if (action.type === 'auth/login/fulfilled') {
          return {
            ...action,
            payload: {
              ...action.payload,
              accessToken: '[REDACTED]',
              refreshToken: '[REDACTED]'
            }
          };
        }
        return action;
      },
      stateSanitizer: (state) => {
        if (state.auth) {
          return {
            ...state,
            auth: {
              ...state.auth,
              accessToken: '[REDACTED]',
              refreshToken: '[REDACTED]'
            }
          };
        }
        return state;
      }
    }
  });

  // Enable hot module replacement for reducers in development
  if (process.env.NODE_ENV === 'development' && module.hot) {
    module.hot.accept('./slices/authSlice', () => store.replaceReducer(authReducer));
    module.hot.accept('./slices/chatSlice', () => store.replaceReducer(chatReducer));
    module.hot.accept('./slices/integrationSlice', () => store.replaceReducer(integrationReducer));
    module.hot.accept('./slices/templateSlice', () => store.replaceReducer(templateReducer));
    module.hot.accept('./slices/uiSlice', () => store.replaceReducer(uiReducer));
  }

  return store;
};

// Create store instance
export const store = makeStore();

// Type definitions for state and dispatch
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Type-safe hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Export store instance as default
export default store;