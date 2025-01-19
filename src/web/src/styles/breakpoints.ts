import { css, FlattenSimpleInterpolation } from 'styled-components'; // v6.0.0

// Type-safe enum for breakpoint names
export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'largeDesktop';

// Define viewport width breakpoints in pixels
export const breakpoints: Readonly<Record<Breakpoint, number>> = {
  mobile: 320,
  tablet: 768,
  desktop: 1024,
  largeDesktop: 1440,
} as const;

// Helper function to create mobile-first media query strings
const createMediaQuery = (breakpoint: number): string => {
  return `@media (min-width: ${breakpoint}px)`;
};

// Pre-formatted media query strings for each breakpoint
export const mediaQueries: Readonly<Record<Breakpoint, string>> = {
  mobile: createMediaQuery(breakpoints.mobile),
  tablet: createMediaQuery(breakpoints.tablet),
  desktop: createMediaQuery(breakpoints.desktop),
  largeDesktop: createMediaQuery(breakpoints.largeDesktop),
} as const;

// Type definition for media query helper functions
type MediaQueryHelper = (
  styles: FlattenSimpleInterpolation | TemplateStringsArray,
  ...interpolations: FlattenSimpleInterpolation[]
) => FlattenSimpleInterpolation;

// Helper function to create type-safe styled-components media query helpers
const createMediaHelper = (query: string): MediaQueryHelper => {
  return (
    styles: FlattenSimpleInterpolation | TemplateStringsArray,
    ...interpolations: FlattenSimpleInterpolation[]
  ): FlattenSimpleInterpolation => css`
    ${query} {
      ${css(styles, ...interpolations)}
    }
  `;
};

// Styled-components media query helper functions for each breakpoint
export const media: Readonly<Record<Breakpoint, MediaQueryHelper>> = {
  mobile: createMediaHelper(mediaQueries.mobile),
  tablet: createMediaHelper(mediaQueries.tablet),
  desktop: createMediaHelper(mediaQueries.desktop),
  largeDesktop: createMediaHelper(mediaQueries.largeDesktop),
} as const;

/* Usage example:
import { css } from 'styled-components';
import { media } from './breakpoints';

const StyledComponent = styled.div`
  // Mobile-first base styles
  font-size: 14px;
  
  // Tablet and up (min-width: 768px)
  ${media.tablet`
    font-size: 16px;
  `}
  
  // Desktop and up (min-width: 1024px)
  ${media.desktop`
    font-size: 18px;
  `}
`;
*/