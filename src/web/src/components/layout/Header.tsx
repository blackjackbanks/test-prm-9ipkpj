import React, { useCallback, useState, useRef, useEffect } from 'react'; // v18.0.0
import styled from 'styled-components'; // v6.0.0
import Avatar from '../common/Avatar';
import Button from '../common/Button';
import useAuth from '../../hooks/useAuth';

// Types
interface HeaderProps {
  className?: string;
}

// Styled Components
const HeaderContainer = styled.header`
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: ${({ theme }) => theme.colors.background};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: ${({ theme }) => theme.shadows.surface};
  
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const LogoSection = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Logo = styled.h1`
  font-family: ${({ theme }) => theme.typography.fontFamily.display};
  font-size: ${({ theme }) => theme.typography.fontSize.h2};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text};
  margin: 0;
`;

const ActionsSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const SecurityIndicator = styled.div<{ status: 'secure' | 'warning' | 'error' }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${({ theme, status }) => ({
    secure: theme.colors.success,
    warning: theme.colors.warning,
    error: theme.colors.error
  }[status])};
  margin-right: 8px;
`;

const ProfileDropdown = styled.div<{ isOpen: boolean }>`
  position: absolute;
  top: calc(100% + 8px);
  right: 24px;
  background: ${({ theme }) => theme.colors.background};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  box-shadow: ${({ theme }) => theme.shadows.dropdown};
  min-width: 240px;
  z-index: 101;
  opacity: ${({ isOpen }) => isOpen ? 1 : 0};
  transform: ${({ isOpen }) => isOpen ? 'translateY(0)' : 'translateY(-8px)'};
  pointer-events: ${({ isOpen }) => isOpen ? 'auto' : 'none'};
  transition: opacity 0.2s ease, transform 0.2s ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const ProfileDropdownContent = styled.div`
  padding: 16px;
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  margin-bottom: 16px;
`;

const UserName = styled.div`
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text};
`;

const UserEmail = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.small};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const DropdownButton = styled(Button)`
  width: 100%;
  justify-content: flex-start;
  margin-top: 8px;
  
  &:first-of-type {
    margin-top: 0;
  }
`;

// Header Component
export const Header: React.FC<HeaderProps> = React.memo(({ className }) => {
  const { user, logout, mfaStatus } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Security status based on MFA and session state
  const securityStatus = mfaStatus.required && !mfaStatus.verified ? 'warning' : 
                        user?.mfaEnabled ? 'secure' : 'error';

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      setIsProfileOpen(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, [logout]);

  const handleProfileClick = useCallback(() => {
    setIsProfileOpen(prev => !prev);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <HeaderContainer className={className}>
      <LogoSection>
        <Logo>COREos</Logo>
      </LogoSection>

      <ActionsSection>
        <SecurityIndicator 
          status={securityStatus}
          aria-label={`Security status: ${securityStatus}`}
        />
        
        <Button
          variant="text"
          size="small"
          aria-label="Help"
        >
          Help
        </Button>

        <div ref={profileRef}>
          <Avatar
            src={user?.preferences?.avatarUrl}
            name={user?.name}
            size="medium"
            onClick={handleProfileClick}
            ariaLabel="Open profile menu"
          />

          <ProfileDropdown 
            isOpen={isProfileOpen}
            role="menu"
            aria-label="User profile menu"
          >
            <ProfileDropdownContent>
              <UserInfo>
                <Avatar
                  src={user?.preferences?.avatarUrl}
                  name={user?.name}
                  size="large"
                />
                <div>
                  <UserName>{user?.name}</UserName>
                  <UserEmail>{user?.email}</UserEmail>
                </div>
              </UserInfo>

              <DropdownButton
                variant="text"
                onClick={() => {/* Navigate to profile */}}
                aria-label="View profile"
              >
                Profile
              </DropdownButton>

              <DropdownButton
                variant="text"
                onClick={() => {/* Navigate to security settings */}}
                aria-label="Security settings"
              >
                Security Settings
              </DropdownButton>

              <DropdownButton
                variant="text"
                onClick={handleLogout}
                aria-label="Sign out"
              >
                Sign Out
              </DropdownButton>
            </ProfileDropdownContent>
          </ProfileDropdown>
        </div>
      </ActionsSection>
    </HeaderContainer>
  );
});

Header.displayName = 'Header';

export default Header;