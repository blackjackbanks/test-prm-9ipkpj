import React, { useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { NavLink } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

// Styled components with MacOS-inspired design
const SidebarContainer = styled.aside<{ isCollapsed: boolean }>`
  width: ${props => props.isCollapsed ? '64px' : '240px'};
  height: 100vh;
  background: ${props => props.theme.colors.semantic.surface};
  border-right: 1px solid ${props => props.theme.colors.semantic.border};
  padding: ${props => props.theme.spacing.scale.md};
  transition: width 0.3s ease;
  position: fixed;
  left: 0;
  top: 0;
  z-index: ${props => props.theme.zIndex?.sidebar || 100};
  display: flex;
  flex-direction: column;
`;

const SidebarHeader = styled.div`
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${props => props.theme.spacing.scale.lg};
`;

const Logo = styled.div<{ isCollapsed: boolean }>`
  font-family: ${props => props.theme.typography.fontFamily.display};
  font-size: ${props => props.theme.typography.fontSize.h2};
  font-weight: ${props => props.theme.typography.fontWeight.semibold};
  color: ${props => props.theme.colors.semantic.text};
  opacity: ${props => props.isCollapsed ? 0 : 1};
  transition: opacity 0.2s ease;
`;

const NavList = styled.nav`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.scale.sm};
  flex: 1;
  overflow-y: auto;
`;

const NavItemContainer = styled(NavLink)<{ $isCollapsed: boolean }>`
  display: flex;
  align-items: center;
  padding: ${props => props.theme.spacing.scale.sm} ${props => props.theme.spacing.scale.md};
  border-radius: 8px;
  color: ${props => props.theme.colors.semantic.text};
  text-decoration: none;
  transition: background-color 0.2s ease;
  
  &:hover {
    background: ${props => props.theme.colors.semantic.surfaceAlt};
  }
  
  &.active {
    background: ${props => props.theme.colors.semantic.primary};
    color: white;
  }
`;

const NavItemLabel = styled.span<{ isCollapsed: boolean }>`
  margin-left: ${props => props.theme.spacing.scale.sm};
  font-size: ${props => props.theme.typography.fontSize.body};
  opacity: ${props => props.isCollapsed ? 0 : 1};
  transition: opacity 0.2s ease;
  white-space: nowrap;
`;

const SidebarFooter = styled.div`
  display: flex;
  align-items: center;
  padding-top: ${props => props.theme.spacing.scale.md};
  border-top: 1px solid ${props => props.theme.colors.semantic.border};
`;

// Interfaces
interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  className?: string;
  testId?: string;
}

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isCollapsed: boolean;
  isActive?: boolean;
  onClick?: () => void;
}

// NavItem component
const NavItem: React.FC<NavItemProps> = ({
  to,
  icon,
  label,
  isCollapsed,
  onClick
}) => (
  <NavItemContainer
    to={to}
    $isCollapsed={isCollapsed}
    onClick={onClick}
    aria-label={isCollapsed ? label : undefined}
  >
    <span aria-hidden="true">{icon}</span>
    <NavItemLabel isCollapsed={isCollapsed}>{label}</NavItemLabel>
  </NavItemContainer>
);

// Main Sidebar component
export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggle,
  className,
  testId
}) => {
  const { isAuthenticated, user } = useAuth();
  const { theme, setTheme } = useTheme();

  // Memoize navigation items to prevent unnecessary re-renders
  const navigationItems = useMemo(() => [
    {
      to: ROUTES.DASHBOARD,
      icon: '🏠',
      label: 'Dashboard'
    },
    {
      to: ROUTES.TEMPLATES,
      icon: '📄',
      label: 'Templates'
    },
    {
      to: ROUTES.INTEGRATIONS,
      icon: '🔌',
      label: 'Integrations'
    },
    {
      to: ROUTES.SETTINGS,
      icon: '⚙️',
      label: 'Settings'
    }
  ], []);

  // Handle keyboard navigation
  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      onToggle();
    }
  }, [onToggle]);

  if (!isAuthenticated) return null;

  return (
    <SidebarContainer
      isCollapsed={isCollapsed}
      className={className}
      data-testid={testId}
      role="navigation"
      aria-expanded={!isCollapsed}
    >
      <SidebarHeader>
        <Logo isCollapsed={isCollapsed}>COREos</Logo>
        <button
          onClick={onToggle}
          onKeyPress={handleKeyPress}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {isCollapsed ? '→' : '←'}
        </button>
      </SidebarHeader>

      <NavList>
        {navigationItems.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            isCollapsed={isCollapsed}
          />
        ))}
      </NavList>

      <SidebarFooter>
        {!isCollapsed && user && (
          <span style={{ fontSize: '14px', opacity: 0.8 }}>
            {user.name}
          </span>
        )}
      </SidebarFooter>
    </SidebarContainer>
  );
};

export default Sidebar;