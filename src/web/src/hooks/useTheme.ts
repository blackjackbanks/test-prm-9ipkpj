/**
 * Custom React hook for managing application theme with TypeScript type safety,
 * system preference detection, and performance optimizations.
 * @version 1.0.0
 */

import { useState, useEffect, useCallback } from 'react'; // v18.0.0
import { Theme } from '../types/common';
import { getSystemThemePreference, applyTheme } from '../utils/theme';
import { getItem, setItem } from '../utils/storage';

// Storage key for persisting theme preference
const STORAGE_KEY_THEME = 'theme';

// Media queries for system preferences
const MEDIA_QUERY_DARK = '(prefers-color-scheme: dark)';
const MEDIA_QUERY_CONTRAST = '(prefers-contrast: more)';
const MEDIA_QUERY_MOTION = '(prefers-reduced-motion)';

/**
 * Hook for managing application theme with system preference support
 * @returns {Object} Theme state and setter function
 */
export const useTheme = () => {
  // Initialize theme state from storage or system preference
  const [theme, setThemeState] = useState<Theme>(() => {
    const storedTheme = getItem<Theme>(STORAGE_KEY_THEME);
    return storedTheme || Theme.SYSTEM;
  });

  /**
   * Memoized theme setter with storage persistence and validation
   */
  const setTheme = useCallback((newTheme: Theme) => {
    // Validate theme value
    if (!Object.values(Theme).includes(newTheme)) {
      console.error(`Invalid theme value: ${newTheme}`);
      return;
    }

    try {
      // Persist theme preference
      setItem(STORAGE_KEY_THEME, newTheme);
      setThemeState(newTheme);
      
      // Apply theme with performance optimization
      requestAnimationFrame(() => {
        applyTheme(newTheme);
      });
    } catch (error) {
      console.error('Failed to set theme:', error);
      // Fallback to system theme on error
      setThemeState(Theme.SYSTEM);
    }
  }, []);

  /**
   * Handle system theme preference changes
   */
  useEffect(() => {
    if (theme === Theme.SYSTEM && typeof window !== 'undefined') {
      const darkModeQuery = window.matchMedia(MEDIA_QUERY_DARK);
      const contrastQuery = window.matchMedia(MEDIA_QUERY_CONTRAST);
      const motionQuery = window.matchMedia(MEDIA_QUERY_MOTION);

      const handlePreferenceChange = () => {
        const systemTheme = getSystemThemePreference();
        requestAnimationFrame(() => {
          applyTheme(systemTheme);
        });
      };

      // Set up preference change listeners
      darkModeQuery.addEventListener('change', handlePreferenceChange);
      contrastQuery.addEventListener('change', handlePreferenceChange);
      motionQuery.addEventListener('change', handlePreferenceChange);

      // Apply initial theme
      handlePreferenceChange();

      // Cleanup listeners on unmount
      return () => {
        darkModeQuery.removeEventListener('change', handlePreferenceChange);
        contrastQuery.removeEventListener('change', handlePreferenceChange);
        motionQuery.removeEventListener('change', handlePreferenceChange);
      };
    }
  }, [theme]);

  /**
   * Apply initial theme on mount
   */
  useEffect(() => {
    requestAnimationFrame(() => {
      applyTheme(theme);
    });

    // Update HTML element attributes for accessibility
    const root = document.documentElement;
    root.setAttribute('data-theme', theme.toLowerCase());
    root.setAttribute('aria-theme', theme.toLowerCase());

    // Dispatch theme change event for third-party integrations
    window.dispatchEvent(
      new CustomEvent('theme-changed', {
        detail: { theme }
      })
    );
  }, [theme]);

  return {
    theme,
    setTheme
  } as const;
};