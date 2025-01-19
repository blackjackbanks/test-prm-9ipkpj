import React from 'react'; // v18.0.0
import styled from 'styled-components'; // v6.0.0
import { Theme } from '../../styles/theme';

// Avatar size variants
export type AvatarSize = 'small' | 'medium' | 'large';

// Props interface for Avatar component
export interface AvatarProps {
  src?: string;
  name?: string;
  size?: AvatarSize;
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
}

// Size mappings in pixels following 8px grid
const SIZE_MAP = {
  small: '24px',
  medium: '32px',
  large: '48px',
};

const FONT_SIZE_MAP = {
  small: '12px',
  medium: '14px',
  large: '18px',
};

// Styled container component
const AvatarContainer = styled.div<{ size: AvatarSize; isInteractive: boolean }>`
  width: ${({ size }) => SIZE_MAP[size]};
  height: ${({ size }) => SIZE_MAP[size]};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  overflow: hidden;
  cursor: ${({ isInteractive }) => isInteractive ? 'pointer' : 'default'};
  transition: transform 0.2s ease;
  user-select: none;

  &:hover {
    transform: ${({ isInteractive }) => isInteractive ? 'scale(1.05)' : 'none'};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.focus};
    outline-offset: 2px;
  }
`;

// Styled image component
const AvatarImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  loading: lazy;
  user-select: none;
  -webkit-user-drag: none;
`;

// Styled initials component
const AvatarInitials = styled.span<{ size: AvatarSize }>`
  color: ${({ theme }) => theme.colors.text};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ size }) => FONT_SIZE_MAP[size]};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  text-transform: uppercase;
  line-height: 1;
  user-select: none;
`;

// Helper function to get initials from name
const getInitials = (name?: string): string => {
  if (!name) return '';
  
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '';
  
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// Memoized Avatar component
export const Avatar: React.FC<AvatarProps> = React.memo(({
  src,
  name,
  size = 'medium',
  className,
  onClick,
  ariaLabel,
}) => {
  const isInteractive = Boolean(onClick);
  const initials = React.useMemo(() => getInitials(name), [name]);

  return (
    <AvatarContainer
      size={size}
      isInteractive={isInteractive}
      className={className}
      onClick={onClick}
      role={isInteractive ? 'button' : 'presentation'}
      tabIndex={isInteractive ? 0 : -1}
      aria-label={ariaLabel || (name ? `Avatar for ${name}` : 'Avatar')}
    >
      {src ? (
        <AvatarImage
          src={src}
          alt={name ? `Avatar for ${name}` : 'Avatar'}
          onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <AvatarInitials size={size}>{initials}</AvatarInitials>
      )}
    </AvatarContainer>
  );
});

Avatar.displayName = 'Avatar';

export default Avatar;