import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Theme, NotificationType } from '../../types/common';

// Constants
const NOTIFICATION_DURATION = 3000;
const NOTIFICATION_QUEUE_LIMIT = 5;
const COMMAND_BAR_SHORTCUT = 'cmd+k, ctrl+k';
const SIDEBAR_BREAKPOINT = 768;
const Z_INDEX_BASE = 100;

// Interfaces
interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration: number;
  action: { label: string; handler: () => void } | null;
  position: 'top' | 'bottom' | 'top-right' | 'bottom-right';
}

interface UIState {
  theme: Theme;
  systemTheme: Theme.LIGHT | Theme.DARK;
  isCommandBarOpen: boolean;
  commandBarQuery: string;
  isSidebarCollapsed: boolean;
  sidebarBreakpoint: number;
  notifications: Notification[];
  zIndexStack: string[];
}

// Initial state
const initialState: UIState = {
  theme: Theme.SYSTEM,
  systemTheme: Theme.LIGHT,
  isCommandBarOpen: false,
  commandBarQuery: '',
  isSidebarCollapsed: window?.innerWidth < SIDEBAR_BREAKPOINT,
  sidebarBreakpoint: SIDEBAR_BREAKPOINT,
  notifications: [],
  zIndexStack: []
};

// Helper functions
const detectSystemTheme = (): Theme.LIGHT | Theme.DARK => {
  if (typeof window === 'undefined') return Theme.LIGHT;
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? Theme.DARK
    : Theme.LIGHT;
};

const applyThemeToDOM = (theme: Theme, systemTheme: Theme.LIGHT | Theme.DARK) => {
  const effectiveTheme = theme === Theme.SYSTEM ? systemTheme : theme;
  document.documentElement.setAttribute('data-theme', effectiveTheme.toLowerCase());
};

const generateNotificationId = (): string => {
  return crypto.randomUUID();
};

// Slice
const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<Theme>) => {
      const newTheme = action.payload;
      state.theme = newTheme;
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', newTheme);
        applyThemeToDOM(newTheme, state.systemTheme);
        
        // Dispatch theme change event for plugins
        window.dispatchEvent(new CustomEvent('themechange', {
          detail: { theme: newTheme, systemTheme: state.systemTheme }
        }));
      }
    },

    setSystemTheme: (state, action: PayloadAction<Theme.LIGHT | Theme.DARK>) => {
      state.systemTheme = action.payload;
      if (state.theme === Theme.SYSTEM) {
        applyThemeToDOM(Theme.SYSTEM, action.payload);
      }
    },

    toggleCommandBar: (state) => {
      state.isCommandBarOpen = !state.isCommandBarOpen;
      if (!state.isCommandBarOpen) {
        state.commandBarQuery = '';
        state.zIndexStack = state.zIndexStack.filter(id => id !== 'command-bar');
      } else {
        state.zIndexStack.push('command-bar');
        // Focus will be handled by useEffect in the CommandBar component
      }
    },

    updateCommandBarQuery: (state, action: PayloadAction<string>) => {
      state.commandBarQuery = action.payload.trim();
    },

    toggleSidebar: (state, action: PayloadAction<boolean | undefined>) => {
      const newState = action.payload ?? !state.isSidebarCollapsed;
      state.isSidebarCollapsed = newState;
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('sidebarCollapsed', String(newState));
        window.dispatchEvent(new CustomEvent('layoutchange', {
          detail: { sidebarCollapsed: newState }
        }));
      }
    },

    addNotification: (state, action: PayloadAction<Omit<Notification, 'id'>>) => {
      const id = generateNotificationId();
      const notification: Notification = {
        ...action.payload,
        id,
        duration: action.payload.duration || NOTIFICATION_DURATION
      };

      state.notifications = [
        notification,
        ...state.notifications
      ].slice(0, NOTIFICATION_QUEUE_LIMIT);

      state.zIndexStack = [...state.zIndexStack, `notification-${id}`];
    },

    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(
        notification => notification.id !== action.payload
      );
      state.zIndexStack = state.zIndexStack.filter(
        id => id !== `notification-${action.payload}`
      );
    },

    updateZIndexStack: (state, action: PayloadAction<string[]>) => {
      state.zIndexStack = action.payload;
    }
  }
});

// Exports
export const {
  setTheme,
  setSystemTheme,
  toggleCommandBar,
  updateCommandBarQuery,
  toggleSidebar,
  addNotification,
  removeNotification,
  updateZIndexStack
} = uiSlice.actions;

export default uiSlice.reducer;

// Selectors
export const selectTheme = (state: { ui: UIState }) => state.ui.theme;
export const selectEffectiveTheme = (state: { ui: UIState }) => 
  state.ui.theme === Theme.SYSTEM ? state.ui.systemTheme : state.ui.theme;
export const selectCommandBarState = (state: { ui: UIState }) => ({
  isOpen: state.ui.isCommandBarOpen,
  query: state.ui.commandBarQuery
});
export const selectSidebarState = (state: { ui: UIState }) => ({
  isCollapsed: state.ui.isSidebarCollapsed,
  breakpoint: state.ui.sidebarBreakpoint
});
export const selectNotifications = (state: { ui: UIState }) => state.ui.notifications;
export const selectZIndexStack = (state: { ui: UIState }) => state.ui.zIndexStack;

// Types
export type { UIState, Notification };