import { useEffect, useState, useCallback } from 'react'; // ^18.0.0
import { breakpoints } from '../styles/breakpoints';

// Type definition for available breakpoints
export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'largeDesktop';

// Debounce timeout in milliseconds for resize event handling
const RESIZE_DEBOUNCE_MS = 150;

/**
 * Helper function to determine current breakpoint from window width
 * using mobile-first approach
 * @param width - Current window width in pixels
 * @returns Current breakpoint based on width comparison
 */
const getCurrentBreakpoint = (width: number): Breakpoint => {
  if (width >= breakpoints.largeDesktop) {
    return 'largeDesktop';
  }
  if (width >= breakpoints.desktop) {
    return 'desktop';
  }
  if (width >= breakpoints.tablet) {
    return 'tablet';
  }
  return 'mobile';
};

/**
 * Custom hook for responsive design breakpoint detection
 * Implements mobile-first approach with SSR compatibility and performance optimizations
 * @returns Current active breakpoint
 */
const useBreakpoint = (): Breakpoint => {
  // Handle SSR case where window is undefined
  if (typeof window === 'undefined') {
    return 'mobile';
  }

  // Initialize state with current breakpoint
  const [currentBreakpoint, setCurrentBreakpoint] = useState<Breakpoint>(
    getCurrentBreakpoint(window.innerWidth)
  );

  // Create memoized resize handler to prevent unnecessary re-renders
  const handleResize = useCallback(() => {
    const newBreakpoint = getCurrentBreakpoint(window.innerWidth);
    setCurrentBreakpoint(newBreakpoint);
  }, []);

  useEffect(() => {
    let debounceTimer: NodeJS.Timeout;

    // Debounced resize event handler
    const debouncedResize = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        handleResize();
      }, RESIZE_DEBOUNCE_MS);
    };

    try {
      // Add resize event listener
      window.addEventListener('resize', debouncedResize, { passive: true });

      // Initial breakpoint check
      handleResize();
    } catch (error) {
      // Fallback to mobile breakpoint if error occurs
      console.error('Error setting up breakpoint detection:', error);
      setCurrentBreakpoint('mobile');
    }

    // Cleanup function
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(debounceTimer);
    };
  }, [handleResize]);

  return currentBreakpoint;
};

export default useBreakpoint;