import type { DefaultTheme } from 'styled-components'; // v6.0.0
import { COLORS } from '../constants/theme';
import { Theme } from '../types/common';

// Media query for system dark mode preference detection
const MEDIA_QUERY_DARK = '(prefers-color-scheme: dark)';
// Duration for smooth theme transitions
const THEME_TRANSITION_DURATION = '200ms';

/**
 * Detects and monitors the user's system color scheme preference
 * @returns {Theme} LIGHT or DARK based on system preference
 */
export const getSystemThemePreference = (): Theme => {
  // Check if window.matchMedia is supported
  if (typeof window === 'undefined' || !window.matchMedia) {
    return Theme.LIGHT; // Fallback for SSR or unsupported browsers
  }

  const mediaQuery = window.matchMedia(MEDIA_QUERY_DARK);
  return mediaQuery.matches ? Theme.DARK : Theme.LIGHT;
};

/**
 * Generates CSS variables from theme colors with validation
 * @param themeColors - Object containing theme color definitions
 * @returns Record of CSS variable definitions
 */
export const getCSSVariables = (
  themeColors: typeof COLORS.light | typeof COLORS.dark
): Record<string, string> => {
  const cssVars: Record<string, string> = {};

  try {
    Object.entries(themeColors).forEach(([key, value]) => {
      if (typeof value === 'string') {
        cssVars[`--color-${key}`] = value;
      } else if (typeof value === 'object') {
        Object.entries(value).forEach(([subKey, subValue]) => {
          cssVars[`--color-${key}-${subKey}`] = subValue as string;
        });
      }
    });
  } catch (error) {
    console.error('Error generating CSS variables:', error);
    // Return empty object to prevent runtime errors
    return {};
  }

  return cssVars;
};

/**
 * Applies theme to document with smooth transitions and accessibility updates
 * @param theme - Selected theme (LIGHT, DARK, or SYSTEM)
 */
export const applyTheme = (theme: Theme): void => {
  // Determine effective theme if system preference is selected
  const effectiveTheme = theme === Theme.SYSTEM 
    ? getSystemThemePreference()
    : theme;

  // Get theme colors based on effective theme
  const themeColors = effectiveTheme === Theme.DARK ? COLORS.dark : COLORS.light;

  // Generate CSS variables
  const cssVariables = getCSSVariables(themeColors);

  // Batch DOM updates using requestAnimationFrame for performance
  requestAnimationFrame(() => {
    const root = document.documentElement;

    // Add transition properties for smooth theme switching
    root.style.setProperty(
      'transition',
      `background-color ${THEME_TRANSITION_DURATION} ease-in-out, 
       color ${THEME_TRANSITION_DURATION} ease-in-out`
    );

    // Apply CSS variables
    Object.entries(cssVariables).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    // Update data attribute for CSS selectors
    root.setAttribute('data-theme', effectiveTheme.toLowerCase());

    // Update ARIA theme attribute for accessibility
    root.setAttribute('aria-theme', effectiveTheme.toLowerCase());

    // Dispatch custom event for theme change
    window.dispatchEvent(
      new CustomEvent('theme-changed', {
        detail: { theme: effectiveTheme }
      })
    );
  });

  // Set up system theme change listener if using system preference
  if (theme === Theme.SYSTEM && typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia(MEDIA_QUERY_DARK);
    
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      applyTheme(Theme.SYSTEM);
    };

    // Remove existing listener to prevent duplicates
    mediaQuery.removeEventListener('change', handleSystemThemeChange);
    // Add new listener
    mediaQuery.addEventListener('change', handleSystemThemeChange);
  }
};

/**
 * Validates color contrast ratios for accessibility
 * @param backgroundColor - Background color in hex or rgba
 * @param textColor - Text color in hex or rgba
 * @returns boolean indicating if contrast ratio meets WCAG AA standards
 */
const validateColorContrast = (
  backgroundColor: string,
  textColor: string
): boolean => {
  // Convert colors to RGB values
  const getRGB = (color: string) => {
    const hex = color.replace('#', '');
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16)
    };
  };

  // Calculate relative luminance
  const getLuminance = (r: number, g: number, b: number) => {
    const [rs, gs, bs] = [r / 255, g / 255, b / 255].map(val => 
      val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
    );
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  try {
    const bg = getRGB(backgroundColor);
    const text = getRGB(textColor);
    
    const bgLuminance = getLuminance(bg.r, bg.g, bg.b);
    const textLuminance = getLuminance(text.r, text.g, text.b);
    
    const contrastRatio = (Math.max(bgLuminance, textLuminance) + 0.05) /
                         (Math.min(bgLuminance, textLuminance) + 0.05);
    
    return contrastRatio >= 4.5; // WCAG AA standard for regular text
  } catch (error) {
    console.warn('Error validating color contrast:', error);
    return true; // Return true to prevent blocking theme application
  }
};