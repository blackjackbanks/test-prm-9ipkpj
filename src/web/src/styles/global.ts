import { createGlobalStyle, css } from 'styled-components'; // v6.0.0
import { lightTheme, darkTheme } from './theme';
import { media } from './breakpoints';

// Font face declarations for system fonts with optimized loading
const generateFontFaces = () => css`
  @font-face {
    font-family: 'SF Pro';
    src: local('-apple-system'), local('system-ui');
    font-display: swap;
    font-weight: 400 700;
    unicode-range: U+000-5FF;
  }

  @font-face {
    font-family: 'SF Pro Display';
    src: local('.SFNS-Display'), local('system-ui');
    font-display: swap;
    font-weight: 400 700;
    unicode-range: U+000-5FF;
  }

  @font-face {
    font-family: 'SF Mono';
    src: local('SFMono-Regular'), local('Menlo');
    font-display: swap;
    font-weight: 400 700;
    unicode-range: U+000-5FF;
  }
`;

// Modern CSS reset with form element normalization
const RESET_STYLES = css`
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html {
    font-size: 100%;
    text-size-adjust: 100%;
    -webkit-text-size-adjust: 100%;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    scroll-behavior: smooth;
  }

  body {
    min-height: 100vh;
    line-height: 1.5;
    text-rendering: optimizeSpeed;
  }

  img, picture, video, canvas, svg {
    display: block;
    max-width: 100%;
  }

  input, button, textarea, select {
    font: inherit;
  }

  p, h1, h2, h3, h4, h5, h6 {
    overflow-wrap: break-word;
  }

  #root, #__next {
    isolation: isolate;
  }
`;

// Accessibility enhancements
const ACCESSIBILITY_STYLES = css`
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .skip-link {
    position: absolute;
    top: -40px;
    left: 0;
    background: ${({ theme }) => theme.colors.primary};
    color: white;
    padding: 8px;
    z-index: 999;
    transition: top 0.2s;

    &:focus {
      top: 0;
    }
  }

  :focus {
    outline: 2px solid ${({ theme }) => theme.colors.focus};
    outline-offset: 2px;
  }

  :focus:not(:focus-visible) {
    outline: none;
  }

  :focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.focus};
    outline-offset: 2px;
  }
`;

// Theme CSS variables for dynamic switching
const THEME_VARIABLES = css`
  :root {
    /* Colors */
    --color-primary: ${({ theme }) => theme.colors.primary};
    --color-secondary: ${({ theme }) => theme.colors.secondary};
    --color-background: ${({ theme }) => theme.colors.background};
    --color-text: ${({ theme }) => theme.colors.text};
    --color-border: ${({ theme }) => theme.colors.border};
    --color-surface: ${({ theme }) => theme.colors.surface};
    --color-error: ${({ theme }) => theme.colors.error};
    --color-success: ${({ theme }) => theme.colors.success};
    --color-warning: ${({ theme }) => theme.colors.warning};
    --color-info: ${({ theme }) => theme.colors.info};
    --color-surface-alt: ${({ theme }) => theme.colors.surfaceAlt};
    --color-text-secondary: ${({ theme }) => theme.colors.textSecondary};
    --color-disabled: ${({ theme }) => theme.colors.disabled};
    --color-focus: ${({ theme }) => theme.colors.focus};

    /* Typography */
    --font-family-primary: ${({ theme }) => theme.typography.fontFamily.primary};
    --font-family-monospace: ${({ theme }) => theme.typography.fontFamily.monospace};
    --font-family-display: ${({ theme }) => theme.typography.fontFamily.display};

    /* Spacing */
    --spacing-base: ${({ theme }) => theme.spacing.base}px;
    --spacing-xs: ${({ theme }) => theme.spacing.scale.xs};
    --spacing-sm: ${({ theme }) => theme.spacing.scale.sm};
    --spacing-md: ${({ theme }) => theme.spacing.scale.md};
    --spacing-lg: ${({ theme }) => theme.spacing.scale.lg};
    --spacing-xl: ${({ theme }) => theme.spacing.scale.xl};
    --spacing-xxl: ${({ theme }) => theme.spacing.scale.xxl};

    /* Shadows */
    --shadow-surface: ${({ theme }) => theme.shadows.surface};
    --shadow-modal: ${({ theme }) => theme.shadows.modal};
    --shadow-popup: ${({ theme }) => theme.shadows.popup};
    --shadow-tooltip: ${({ theme }) => theme.shadows.tooltip};
    --shadow-dropdown: ${({ theme }) => theme.shadows.dropdown};
  }
`;

export const GlobalStyles = createGlobalStyle`
  ${generateFontFaces}
  ${RESET_STYLES}
  ${THEME_VARIABLES}
  ${ACCESSIBILITY_STYLES}

  body {
    font-family: var(--font-family-primary);
    font-size: ${({ theme }) => theme.typography.fontSize.body};
    line-height: ${({ theme }) => theme.typography.lineHeight.body};
    background-color: var(--color-background);
    color: var(--color-text);
    transition: background-color 0.3s ease, color 0.3s ease;

    ${media.tablet`
      font-size: ${({ theme }) => theme.typography.fontSize.body};
    `}

    ${media.desktop`
      font-size: ${({ theme }) => theme.typography.fontSize.body};
    `}
  }

  h1 {
    font-family: var(--font-family-display);
    font-size: ${({ theme }) => theme.typography.fontSize.h1};
    line-height: ${({ theme }) => theme.typography.lineHeight.h1};
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    margin-bottom: var(--spacing-lg);
  }

  h2 {
    font-family: var(--font-family-display);
    font-size: ${({ theme }) => theme.typography.fontSize.h2};
    line-height: ${({ theme }) => theme.typography.lineHeight.h2};
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
    margin-bottom: var(--spacing-md);
  }

  h3 {
    font-family: var(--font-family-display);
    font-size: ${({ theme }) => theme.typography.fontSize.h3};
    line-height: ${({ theme }) => theme.typography.lineHeight.h3};
    font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
    margin-bottom: var(--spacing-sm);
  }

  p {
    margin-bottom: var(--spacing-md);
  }

  code, pre {
    font-family: var(--font-family-monospace);
    font-size: ${({ theme }) => theme.typography.fontSize.small};
  }

  small {
    font-size: ${({ theme }) => theme.typography.fontSize.small};
    line-height: ${({ theme }) => theme.typography.lineHeight.small};
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }

  @media print {
    body {
      background: white;
      color: black;
    }
  }
`;