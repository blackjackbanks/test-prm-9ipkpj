// styled-components v6.0.0
import type { DefaultTheme } from 'styled-components';

// Color system with semantic naming and accessibility considerations
export const COLORS = {
  light: {
    primary: '#007AFF',
    secondary: '#5856D6',
    background: '#FFFFFF',
    text: '#000000',
    border: 'rgba(0,0,0,0.1)',
    surface: '#F5F5F5',
    error: '#FF3B30',
    success: '#34C759',
    warning: '#FF9500',
    info: '#5856D6',
    surfaceAlt: '#FAFAFA',
    textSecondary: '#666666',
    disabled: '#999999',
    focus: 'rgba(0,122,255,0.2)'
  },
  dark: {
    primary: '#0A84FF',
    secondary: '#5E5CE6',
    background: '#000000',
    text: '#FFFFFF',
    border: 'rgba(255,255,255,0.1)',
    surface: '#1C1C1E',
    error: '#FF453A',
    success: '#32D74B',
    warning: '#FF9F0A',
    info: '#5E5CE6',
    surfaceAlt: '#2C2C2E',
    textSecondary: '#EBEBF5',
    disabled: '#666666',
    focus: 'rgba(10,132,255,0.2)'
  },
  semantic: {
    primary: 'var(--color-primary)',
    secondary: 'var(--color-secondary)',
    background: 'var(--color-background)',
    text: 'var(--color-text)',
    border: 'var(--color-border)',
    surface: 'var(--color-surface)',
    error: 'var(--color-error)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    info: 'var(--color-info)',
    surfaceAlt: 'var(--color-surface-alt)',
    textSecondary: 'var(--color-text-secondary)',
    disabled: 'var(--color-disabled)',
    focus: 'var(--color-focus)'
  }
} as const;

// Typography system with comprehensive scale
export const TYPOGRAPHY = {
  fontFamily: {
    primary: 'SF Pro, Segoe UI, Roboto, system-ui, -apple-system',
    monospace: 'SF Mono, Monaco, Consolas, monospace',
    display: 'SF Pro Display, system-ui, -apple-system'
  },
  fontSize: {
    h1: '24px',
    h2: '20px',
    h3: '16px',
    body: '14px',
    small: '12px',
    micro: '10px'
  },
  lineHeight: {
    h1: '32px',
    h2: '28px',
    h3: '24px',
    body: '20px',
    small: '16px',
    micro: '14px'
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700'
  }
} as const;

// 8px-based spacing system
export const SPACING = {
  base: 8,
  scale: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px'
  },
  layout: {
    page: '48px',
    section: '32px',
    component: '16px',
    element: '8px'
  }
} as const;

// Shadow system with elevation levels
export const SHADOWS = {
  light: {
    surface: '0 2px 4px rgba(0,0,0,0.1)',
    modal: '0 4px 8px rgba(0,0,0,0.2)',
    popup: '0 8px 16px rgba(0,0,0,0.3)',
    tooltip: '0 2px 4px rgba(0,0,0,0.15)',
    dropdown: '0 4px 6px rgba(0,0,0,0.1)'
  },
  dark: {
    surface: '0 2px 4px rgba(0,0,0,0.2)',
    modal: '0 4px 8px rgba(0,0,0,0.4)',
    popup: '0 8px 16px rgba(0,0,0,0.6)',
    tooltip: '0 2px 4px rgba(0,0,0,0.3)',
    dropdown: '0 4px 6px rgba(0,0,0,0.2)'
  },
  elevation: {
    0: 'none',
    1: 'var(--shadow-surface)',
    2: 'var(--shadow-modal)',
    3: 'var(--shadow-popup)',
    tooltip: 'var(--shadow-tooltip)',
    dropdown: 'var(--shadow-dropdown)'
  }
} as const;

// Breakpoints for responsive design
const BREAKPOINTS = {
  mobile: '320px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1440px'
} as const;

// Type definitions for theme system
export type Colors = typeof COLORS;
export type Typography = typeof TYPOGRAPHY;
export type Spacing = typeof SPACING;
export type Shadows = typeof SHADOWS;
export type Breakpoints = typeof BREAKPOINTS;

// Comprehensive theme type definition
export type Theme = {
  colors: Colors;
  typography: Typography;
  spacing: Spacing;
  shadows: Shadows;
  breakpoints: Breakpoints;
};

// Augment styled-components DefaultTheme
declare module 'styled-components' {
  export interface DefaultTheme extends Theme {}
}