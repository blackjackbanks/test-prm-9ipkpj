// styled-components v6.0.0
import { DefaultTheme } from 'styled-components';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../constants/theme';

// Theme mode type definition
export type ThemeMode = 'light' | 'dark';

// Type definitions for theme components
export interface ColorTheme {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  border: string;
  surface: string;
  error: string;
  success: string;
  warning: string;
  info: string;
  surfaceAlt: string;
  textSecondary: string;
  disabled: string;
  focus: string;
}

export interface TypographyTheme {
  fontFamily: typeof TYPOGRAPHY.fontFamily;
  fontSize: typeof TYPOGRAPHY.fontSize;
  lineHeight: typeof TYPOGRAPHY.lineHeight;
  fontWeight: typeof TYPOGRAPHY.fontWeight;
}

export interface SpacingTheme {
  base: typeof SPACING.base;
  scale: typeof SPACING.scale;
  layout: typeof SPACING.layout;
}

export interface ShadowTheme {
  surface: string;
  modal: string;
  popup: string;
  tooltip: string;
  dropdown: string;
}

// Complete theme interface extending DefaultTheme
export interface Theme extends DefaultTheme {
  colors: ColorTheme;
  typography: TypographyTheme;
  spacing: SpacingTheme;
  shadows: ShadowTheme;
}

// Theme creation utility with runtime validation
const createTheme = (mode: ThemeMode): Theme => {
  // Validate theme mode
  if (mode !== 'light' && mode !== 'dark') {
    throw new Error(`Invalid theme mode: ${mode}`);
  }

  // Select color palette based on mode
  const colors = COLORS[mode];
  const shadows = SHADOWS[mode];

  // Construct and validate theme object
  const theme: Theme = {
    colors: {
      ...colors,
    },
    typography: {
      fontFamily: TYPOGRAPHY.fontFamily,
      fontSize: TYPOGRAPHY.fontSize,
      lineHeight: TYPOGRAPHY.lineHeight,
      fontWeight: TYPOGRAPHY.fontWeight,
    },
    spacing: {
      base: SPACING.base,
      scale: SPACING.scale,
      layout: SPACING.layout,
    },
    shadows: {
      ...shadows,
    },
  };

  // Runtime validation of required theme properties
  const validateTheme = (theme: Theme): void => {
    const requiredColorKeys: (keyof ColorTheme)[] = [
      'primary',
      'secondary',
      'background',
      'text',
      'border',
      'surface',
      'error',
      'success',
      'warning',
      'info',
      'surfaceAlt',
      'textSecondary',
      'disabled',
      'focus',
    ];

    requiredColorKeys.forEach((key) => {
      if (!theme.colors[key]) {
        throw new Error(`Missing required color: ${key}`);
      }
    });
  };

  validateTheme(theme);
  return theme;
};

// Export theme configurations
export const lightTheme: Theme = createTheme('light');
export const darkTheme: Theme = createTheme('dark');

// Memoized theme getter
export const getTheme = (mode: ThemeMode): Theme => {
  return mode === 'light' ? lightTheme : darkTheme;
};

// CSS variable generation helper
export const generateThemeVariables = (theme: Theme): string => {
  return `
    :root {
      /* Colors */
      --color-primary: ${theme.colors.primary};
      --color-secondary: ${theme.colors.secondary};
      --color-background: ${theme.colors.background};
      --color-text: ${theme.colors.text};
      --color-border: ${theme.colors.border};
      --color-surface: ${theme.colors.surface};
      --color-error: ${theme.colors.error};
      --color-success: ${theme.colors.success};
      --color-warning: ${theme.colors.warning};
      --color-info: ${theme.colors.info};
      --color-surface-alt: ${theme.colors.surfaceAlt};
      --color-text-secondary: ${theme.colors.textSecondary};
      --color-disabled: ${theme.colors.disabled};
      --color-focus: ${theme.colors.focus};

      /* Shadows */
      --shadow-surface: ${theme.shadows.surface};
      --shadow-modal: ${theme.shadows.modal};
      --shadow-popup: ${theme.shadows.popup};
      --shadow-tooltip: ${theme.shadows.tooltip};
      --shadow-dropdown: ${theme.shadows.dropdown};

      /* Spacing */
      --spacing-base: ${theme.spacing.base}px;
      --spacing-xs: ${theme.spacing.scale.xs};
      --spacing-sm: ${theme.spacing.scale.sm};
      --spacing-md: ${theme.spacing.scale.md};
      --spacing-lg: ${theme.spacing.scale.lg};
      --spacing-xl: ${theme.spacing.scale.xl};
      --spacing-xxl: ${theme.spacing.scale.xxl};
    }
  `;
};