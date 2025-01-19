import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useNavigate, useParams } from 'react-router-dom';
import { useAnalytics } from '@mixpanel/browser'; // v2.45.0
import ProfileSettings from '../components/settings/ProfileSettings';
import SecuritySettings from '../components/settings/SecuritySettings';
import OrganizationSettings from '../components/settings/OrganizationSettings';
import { useAuth } from '../hooks/useAuth';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { fadeIn } from '../styles/animations';

// Types
type SettingsTab = 'profile' | 'security' | 'organization';

interface SettingsState {
  loading: boolean;
  error: Error | null;
  activeTab: SettingsTab;
}

// Styled components with MacOS-inspired design
const SettingsContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--color-background);
  color: var(--color-text);
  position: relative;
  animation: ${fadeIn} 0.3s ease-in-out;
`;

const SettingsHeader = styled.header`
  padding: 24px;
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-surface);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const SettingsTitle = styled.h1`
  font-size: 24px;
  font-weight: 500;
  margin-bottom: 16px;
  color: var(--color-text);
  font-family: var(--font-family-display);
`;

const TabContainer = styled.nav`
  display: flex;
  gap: 24px;
  margin-top: 16px;
  position: relative;
`;

const TabButton = styled.button<{ active?: boolean }>`
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  color: ${props => props.active ? 'var(--color-text)' : 'var(--color-text-secondary)'};
  background: ${props => props.active ? 'var(--color-primary)' : 'transparent'};
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;

  &:hover {
    background: ${props => !props.active && 'var(--color-surface-alt)'};
  }

  &:focus {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
`;

const ContentContainer = styled.main`
  flex: 1;
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  position: relative;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(var(--background-rgb), 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
`;

const ErrorMessage = styled.div`
  padding: 16px;
  margin: 16px 0;
  background-color: var(--color-error-background);
  color: var(--color-error);
  border-radius: 8px;
  font-size: 14px;
`;

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { tab } = useParams<{ tab: SettingsTab }>();
  const { user, isAuthenticated, validateSession } = useAuth();
  const analytics = useAnalytics();

  const [state, setState] = useState<SettingsState>({
    loading: true,
    error: null,
    activeTab: tab || 'profile'
  });

  // Handle tab navigation with analytics tracking
  const handleTabChange = useCallback((newTab: SettingsTab) => {
    analytics.track('Settings Tab Changed', {
      previousTab: state.activeTab,
      newTab,
      userId: user?.id
    });

    setState(prev => ({
      ...prev,
      activeTab: newTab,
      error: null
    }));

    navigate(`/settings/${newTab}`);
  }, [analytics, navigate, state.activeTab, user?.id]);

  // Validate user session on mount
  useEffect(() => {
    const validateUserSession = async () => {
      try {
        await validateSession();
        setState(prev => ({ ...prev, loading: false }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: error as Error
        }));
      }
    };

    validateUserSession();
  }, [validateSession]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !state.loading) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, navigate, state.loading]);

  if (!isAuthenticated) return null;

  return (
    <ErrorBoundary>
      <SettingsContainer role="main">
        <SettingsHeader>
          <SettingsTitle>Settings</SettingsTitle>
          <TabContainer role="tablist" aria-label="Settings sections">
            <TabButton
              role="tab"
              aria-selected={state.activeTab === 'profile'}
              aria-controls="profile-panel"
              onClick={() => handleTabChange('profile')}
              active={state.activeTab === 'profile'}
            >
              Profile
            </TabButton>
            <TabButton
              role="tab"
              aria-selected={state.activeTab === 'security'}
              aria-controls="security-panel"
              onClick={() => handleTabChange('security')}
              active={state.activeTab === 'security'}
            >
              Security
            </TabButton>
            <TabButton
              role="tab"
              aria-selected={state.activeTab === 'organization'}
              aria-controls="organization-panel"
              onClick={() => handleTabChange('organization')}
              active={state.activeTab === 'organization'}
            >
              Organization
            </TabButton>
          </TabContainer>
        </SettingsHeader>

        <ContentContainer>
          {state.loading && (
            <LoadingOverlay role="alert" aria-busy="true">
              <span>Loading settings...</span>
            </LoadingOverlay>
          )}

          {state.error && (
            <ErrorMessage role="alert">
              {state.error.message}
            </ErrorMessage>
          )}

          <div
            role="tabpanel"
            id="profile-panel"
            aria-labelledby="profile-tab"
            hidden={state.activeTab !== 'profile'}
          >
            {state.activeTab === 'profile' && <ProfileSettings />}
          </div>

          <div
            role="tabpanel"
            id="security-panel"
            aria-labelledby="security-tab"
            hidden={state.activeTab !== 'security'}
          >
            {state.activeTab === 'security' && <SecuritySettings />}
          </div>

          <div
            role="tabpanel"
            id="organization-panel"
            aria-labelledby="organization-tab"
            hidden={state.activeTab !== 'organization'}
          >
            {state.activeTab === 'organization' && <OrganizationSettings />}
          </div>
        </ContentContainer>
      </SettingsContainer>
    </ErrorBoundary>
  );
};

export default Settings;