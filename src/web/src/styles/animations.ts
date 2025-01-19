// styled-components v6.0.0
import { keyframes } from 'styled-components';

// Animation Duration Constants
export const ANIMATION_DURATION = {
  fast: '0.2s',
  normal: '0.3s',
  slow: '0.5s'
} as const;

// Animation Easing Constants
export const ANIMATION_EASING = {
  default: 'ease-in-out',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)'
} as const;

// Performance-optimized animation properties
export const ANIMATION_PROPERTIES = {
  transform: 'transform',
  opacity: 'opacity',
  will_change: 'will-change'
} as const;

// Helper function to check for reduced motion preference
const prefersReducedMotion = typeof window !== 'undefined' 
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
  : false;

// Helper function to create performant fade animations
export const createFadeAnimation = ({ 
  startOpacity = 0, 
  endOpacity = 1, 
  useTransform = false 
}: {
  startOpacity: number;
  endOpacity: number;
  useTransform?: boolean;
}) => {
  if (prefersReducedMotion) {
    return keyframes`
      from, to {
        opacity: ${endOpacity};
      }
    `;
  }

  return keyframes`
    from {
      opacity: ${startOpacity};
      ${useTransform ? 'transform: translateY(10px);' : ''}
      will-change: ${useTransform ? 'opacity, transform' : 'opacity'};
    }
    to {
      opacity: ${endOpacity};
      ${useTransform ? 'transform: translateY(0);' : ''}
      will-change: auto;
    }
  `;
};

// Helper function to create hardware-accelerated slide animations
export const createSlideAnimation = ({
  direction,
  distance,
  withFade = true
}: {
  direction: 'up' | 'down' | 'left' | 'right';
  distance: string;
  withFade?: boolean;
}) => {
  if (prefersReducedMotion) {
    return keyframes`
      from, to {
        opacity: 1;
        transform: none;
      }
    `;
  }

  const getTransform = () => {
    switch (direction) {
      case 'up': return `translateY(${distance})`;
      case 'down': return `translateY(-${distance})`;
      case 'left': return `translateX(${distance})`;
      case 'right': return `translateX(-${distance})`;
    }
  };

  return keyframes`
    from {
      transform: ${getTransform()};
      opacity: ${withFade ? 0 : 1};
      will-change: transform${withFade ? ', opacity' : ''};
    }
    to {
      transform: translateX(0) translateY(0);
      opacity: 1;
      will-change: auto;
    }
  `;
};

// Fade In Animation
export const fadeIn = createFadeAnimation({
  startOpacity: 0,
  endOpacity: 1,
  useTransform: true
});

// Fade Out Animation
export const fadeOut = createFadeAnimation({
  startOpacity: 1,
  endOpacity: 0,
  useTransform: true
});

// Slide In Animation
export const slideIn = createSlideAnimation({
  direction: 'up',
  distance: '20px',
  withFade: true
});

// Slide Out Animation
export const slideOut = createSlideAnimation({
  direction: 'down',
  distance: '20px',
  withFade: true
});

// Spin Animation
export const spin = keyframes`
  from {
    transform: rotate(0deg);
    will-change: transform;
  }
  to {
    transform: rotate(360deg);
    will-change: auto;
  }
`;

// Pulse Animation
export const pulse = keyframes`
  0% {
    transform: scale(1);
    opacity: 1;
    will-change: transform, opacity;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
    will-change: auto;
  }
`;