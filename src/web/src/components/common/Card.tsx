import React from 'react'; // v18.0.0
import styled, { css } from 'styled-components'; // v6.0.0
import type { Theme } from '../../styles/theme';

// Props interface for the Card component
interface CardProps {
  elevation?: 0 | 1 | 2;
  hoverable?: boolean;
  padding?: string;
  children: React.ReactNode;
  role?: string;
}

// Helper function to get elevation-specific styles
const getElevationStyles = (elevation: number = 0, theme: Theme) => {
  const elevationMap = {
    0: {
      boxShadow: theme.shadows.surface,
      transform: 'translateY(0)',
    },
    1: {
      boxShadow: theme.shadows.modal,
      transform: 'translateY(-1px)',
    },
    2: {
      boxShadow: theme.shadows.popup,
      transform: 'translateY(-2px)',
    },
  };

  return elevationMap[elevation as keyof typeof elevationMap];
};

// Styled card component with MacOS-inspired design
const StyledCard = styled.div<CardProps>`
  /* Base styles */
  background: ${({ theme }) => theme.colors.background};
  border-radius: ${({ theme }) => theme.spacing.scale.sm};
  padding: ${({ theme, padding }) => padding || `${theme.spacing.base * 2}px`};
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
  will-change: transform, box-shadow;
  contain: layout;
  border: 1px solid ${({ theme }) => theme.colors.border};

  /* Elevation styles */
  ${({ theme, elevation = 0 }) => {
    const styles = getElevationStyles(elevation, theme);
    return css`
      box-shadow: ${styles.boxShadow};
      transform: ${styles.transform};
    `;
  }}

  /* Hover styles */
  ${({ hoverable, theme }) =>
    hoverable &&
    css`
      cursor: pointer;
      &:hover {
        transform: translateY(-2px);
        box-shadow: ${theme.shadows.popup};
      }
      &:active {
        transform: translateY(-1px);
        box-shadow: ${theme.shadows.modal};
      }
    `}

  /* Responsive styles */
  @media (max-width: ${({ theme }) => theme.typography.fontSize.h3}) {
    padding: ${({ theme }) => `${theme.spacing.base}px`};
  }

  @media (min-width: ${({ theme }) => theme.typography.fontSize.h2}) {
    padding: ${({ theme }) => `${theme.spacing.base * 1.5}px`};
  }

  @media (min-width: ${({ theme }) => theme.typography.fontSize.h1}) {
    padding: ${({ theme }) => `${theme.spacing.base * 2}px`};
  }
`;

// Card component with enhanced interaction states
const Card: React.FC<CardProps> = ({
  elevation = 0,
  hoverable = false,
  padding,
  children,
  role = 'region',
  ...props
}) => {
  return (
    <StyledCard
      elevation={elevation}
      hoverable={hoverable}
      padding={padding}
      role={role}
      {...props}
    >
      {children}
    </StyledCard>
  );
};

export default Card;