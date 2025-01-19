import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { useAnalytics } from '@analytics/hooks';

// Internal components
import TemplateList from '../components/templates/TemplateList';
import TemplateEditor from '../components/templates/TemplateEditor';
import ErrorBoundary from '../components/common/ErrorBoundary';
import LoadingSpinner from '@common/components';

// Redux actions and selectors
import {
  fetchTemplates,
  createTemplate,
  updateTemplate,
  selectLoadingState,
  selectLastError
} from '../store/slices/templateSlice';

// Types
import { Template, CreateTemplateRequest, UpdateTemplateRequest } from '../types/template';
import { LoadingState } from '../types/common';
import { fadeIn } from '../styles/animations';

// Styled Components
const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.scale.lg};
  padding: ${({ theme }) => theme.spacing.scale.lg};
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  position: relative;
  min-height: 100vh;
  animation: ${fadeIn} ${({ theme }) => theme.animation.duration.normal} ease-in-out;
`;

const Header = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.scale.md} 0;
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize.h1};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text};
  margin: 0;
`;

const CreateButton = styled.button`
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  border: none;
  border-radius: 6px;
  padding: ${({ theme }) => `${theme.spacing.scale.sm} ${theme.spacing.scale.md}`};
  font-size: ${({ theme }) => theme.typography.fontSize.body};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  &:hover {
    background: ${({ theme }) => theme.colors.secondary};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
  backdrop-filter: blur(4px);
`;

// Main component
const Templates: React.FC = () => {
  const dispatch = useDispatch();
  const analytics = useAnalytics();
  const loadingState = useSelector(selectLoadingState);
  const lastError = useSelector(selectLastError);

  // Local state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  // Fetch templates on mount
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        await dispatch(fetchTemplates({
          orgId: '', // Should come from auth context
          filters: {},
          pagination: { page: 0, limit: 50, sortBy: 'updatedAt', sortOrder: 'DESC', filters: {} }
        })).unwrap();
      } catch (error) {
        toast.error('Failed to load templates');
      }
    };

    loadTemplates();
  }, [dispatch]);

  // Handle template creation/update
  const handleSaveTemplate = useCallback(async (
    templateData: CreateTemplateRequest | UpdateTemplateRequest
  ) => {
    try {
      if ('id' in templateData) {
        await dispatch(updateTemplate(templateData)).unwrap();
        analytics.track('template_updated', { templateId: templateData.id });
        toast.success('Template updated successfully');
      } else {
        await dispatch(createTemplate(templateData)).unwrap();
        analytics.track('template_created');
        toast.success('Template created successfully');
      }
      setIsEditorOpen(false);
      setSelectedTemplate(null);
    } catch (error) {
      toast.error('Failed to save template');
      analytics.track('template_save_error', { error });
    }
  }, [dispatch, analytics]);

  // Handle editor open/close
  const handleCreateNew = useCallback(() => {
    setSelectedTemplate(null);
    setIsEditorOpen(true);
    analytics.track('template_editor_opened', { mode: 'create' });
  }, [analytics]);

  const handleEditTemplate = useCallback((template: Template) => {
    setSelectedTemplate(template);
    setIsEditorOpen(true);
    analytics.track('template_editor_opened', { mode: 'edit', templateId: template.id });
  }, [analytics]);

  const handleCloseEditor = useCallback(() => {
    setIsEditorOpen(false);
    setSelectedTemplate(null);
    analytics.track('template_editor_closed');
  }, [analytics]);

  return (
    <ErrorBoundary>
      <PageContainer>
        <Header>
          <Title>Templates</Title>
          <CreateButton
            onClick={handleCreateNew}
            aria-label="Create new template"
          >
            Create Template
          </CreateButton>
        </Header>

        {isEditorOpen ? (
          <TemplateEditor
            template={selectedTemplate}
            onSave={handleSaveTemplate}
            onCancel={handleCloseEditor}
            autosaveInterval={30000}
          />
        ) : (
          <TemplateList
            onEditTemplate={handleEditTemplate}
            aria-label="Template list"
          />
        )}

        {loadingState === LoadingState.LOADING && (
          <LoadingOverlay role="status" aria-label="Loading templates">
            <LoadingSpinner size="large" />
          </LoadingOverlay>
        )}

        {lastError && (
          <div role="alert" aria-live="polite">
            {lastError.message}
          </div>
        )}
      </PageContainer>
    </ErrorBoundary>
  );
};

export default Templates;