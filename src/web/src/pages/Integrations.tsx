import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components'; // v6.0.0
import IntegrationList from '../components/integrations/IntegrationList';
import IntegrationConfig from '../components/integrations/IntegrationConfig';
import ErrorBoundary from '../components/common/ErrorBoundary';
import useNotification from '../hooks/useNotification';
import useBreakpoint from '../hooks/useBreakpoint';
import { integrationService } from '../services/integrations';
import { Integration, IntegrationStatus } from '../types/integration';
import { LoadingState } from '../types/common';
import { fadeIn } from '../styles/animations';

// Styled components with MacOS-inspired design
const PageContainer = styled.div`
  padding: ${({ theme }) => theme.spacing.layout.page};
  height: 100%;
  overflow: auto;
  animation: ${fadeIn} 0.3s ${({ theme }) => theme.colors.smooth};
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.layout.section};
  position: sticky;
  top: 0;
  z-index: 100;
  background-color: ${({ theme }) => theme.colors.background};
  padding: ${({ theme }) => theme.spacing.layout.component} 0;
  backdrop-filter: blur(8px);
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize.h1};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.text};
  margin: 0;
`;

const Modal = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: ${({ isOpen }) => (isOpen ? 'flex' : 'none')};
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
`;

const ModalContent = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 12px;
  padding: ${({ theme }) => theme.spacing.layout.section};
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: ${({ theme }) => theme.shadows.modal};
`;

// Component interface
interface IntegrationsPageState {
  selectedIntegration: Integration | null;
  isConfigModalOpen: boolean;
  isLoading: boolean;
  error: Error | null;
  syncStatus: Record<string, LoadingState>;
}

const IntegrationsPage: React.FC = () => {
  const breakpoint = useBreakpoint();
  const { showNotification } = useNotification();
  const [state, setState] = useState<IntegrationsPageState>({
    selectedIntegration: null,
    isConfigModalOpen: false,
    isLoading: false,
    error: null,
    syncStatus: {},
  });

  // Handle integration editing
  const handleEditIntegration = useCallback((integration: Integration) => {
    setState(prev => ({
      ...prev,
      selectedIntegration: integration,
      isConfigModalOpen: true
    }));
  }, []);

  // Handle integration configuration save
  const handleSaveConfig = useCallback(async (updatedIntegration: Integration) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      const response = await integrationService.updateIntegration(
        updatedIntegration.id,
        {
          name: updatedIntegration.name,
          config: updatedIntegration.config,
          active: updatedIntegration.active
        }
      );

      if (response.success) {
        showNotification({
          message: 'Integration configuration saved successfully',
          type: 'SUCCESS',
          ariaLabel: 'Integration configuration has been updated'
        });

        setState(prev => ({
          ...prev,
          isConfigModalOpen: false,
          selectedIntegration: null
        }));
      }
    } catch (error) {
      showNotification({
        message: 'Failed to save integration configuration',
        type: 'ERROR',
        ariaLabel: 'Error saving integration configuration'
      });
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [showNotification]);

  // Handle integration sync
  const handleSync = useCallback(async (integrationId: string) => {
    setState(prev => ({
      ...prev,
      syncStatus: {
        ...prev.syncStatus,
        [integrationId]: LoadingState.LOADING
      }
    }));

    try {
      const response = await integrationService.syncIntegration(integrationId);
      
      if (response.success) {
        showNotification({
          message: 'Integration sync completed successfully',
          type: 'SUCCESS',
          ariaLabel: 'Integration synchronization complete'
        });

        setState(prev => ({
          ...prev,
          syncStatus: {
            ...prev.syncStatus,
            [integrationId]: LoadingState.SUCCESS
          }
        }));
      }
    } catch (error) {
      showNotification({
        message: 'Failed to sync integration',
        type: 'ERROR',
        ariaLabel: 'Integration synchronization failed'
      });

      setState(prev => ({
        ...prev,
        syncStatus: {
          ...prev.syncStatus,
          [integrationId]: LoadingState.ERROR
        }
      }));
    }
  }, [showNotification]);

  // Handle integration testing
  const handleTest = useCallback(async (integrationId: string) => {
    try {
      const response = await integrationService.testIntegration(integrationId);
      
      if (response.success) {
        showNotification({
          message: 'Integration test successful',
          type: 'SUCCESS',
          ariaLabel: 'Integration connection test passed'
        });
      }
    } catch (error) {
      showNotification({
        message: 'Integration test failed',
        type: 'ERROR',
        ariaLabel: 'Integration connection test failed'
      });
    }
  }, [showNotification]);

  // Close modal handler
  const handleCloseModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      isConfigModalOpen: false,
      selectedIntegration: null
    }));
  }, []);

  // Keyboard event handler for modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && state.isConfigModalOpen) {
        handleCloseModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.isConfigModalOpen, handleCloseModal]);

  return (
    <ErrorBoundary>
      <PageContainer>
        <Header>
          <Title>Integrations</Title>
        </Header>

        <IntegrationList
          onEdit={handleEditIntegration}
          onSync={handleSync}
          onTest={handleTest}
        />

        <Modal
          isOpen={state.isConfigModalOpen}
          onClick={handleCloseModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="config-modal-title"
        >
          <ModalContent onClick={e => e.stopPropagation()}>
            {state.selectedIntegration && (
              <>
                <h2 id="config-modal-title">
                  Configure {state.selectedIntegration.name}
                </h2>
                <IntegrationConfig
                  integration={state.selectedIntegration}
                  onSave={handleSaveConfig}
                  onTest={result => {
                    showNotification({
                      message: result.success ? 
                        'Integration test successful' : 
                        'Integration test failed',
                      type: result.success ? 'SUCCESS' : 'ERROR',
                      ariaLabel: result.success ?
                        'Integration connection test passed' :
                        'Integration connection test failed'
                    });
                  }}
                />
              </>
            )}
          </ModalContent>
        </Modal>
      </PageContainer>
    </ErrorBoundary>
  );
};

export default IntegrationsPage;