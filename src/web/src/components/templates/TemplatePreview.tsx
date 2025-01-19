import React, { useMemo, useCallback, useEffect } from 'react'; // v18.0.0
import styled from 'styled-components'; // v6.0.0
import Card from '../common/Card';
import { Template, TemplateCategory } from '../../types/template';

// Styled components with MacOS-inspired design
const PreviewContainer = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.scale.md};
  padding: ${({ theme }) => theme.spacing.scale.lg};
  background-color: ${({ theme }) => theme.colors.background};
  border-radius: ${({ theme }) => theme.spacing.scale.sm};
  min-height: 400px;
  overflow: auto;
  transition: all 0.2s ease-in-out;
`;

const PreviewHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing.scale.md};
  padding: 0 ${({ theme }) => theme.spacing.scale.sm};
`;

const PreviewContent = styled.div`
  flex: 1;
  overflow: auto;
  padding: ${({ theme }) => theme.spacing.scale.md};
  border-radius: ${({ theme }) => theme.spacing.scale.sm};
  background-color: ${({ theme }) => theme.colors.surface};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
`;

const CategoryBadge = styled.span<{ category: TemplateCategory }>`
  padding: ${({ theme }) => `${theme.spacing.scale.xs} ${theme.spacing.scale.sm}`};
  border-radius: 6px;
  font-size: ${({ theme }) => theme.typography.fontSize.small};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  transition: all 0.2s ease;

  ${({ category, theme }) => {
    const categoryStyles = {
      [TemplateCategory.SALES]: {
        backgroundColor: 'rgba(0, 122, 255, 0.1)',
        color: theme.colors.primary
      },
      [TemplateCategory.MARKETING]: {
        backgroundColor: 'rgba(88, 86, 214, 0.1)',
        color: theme.colors.secondary
      },
      [TemplateCategory.OPERATIONS]: {
        backgroundColor: 'rgba(52, 199, 89, 0.1)',
        color: theme.colors.success
      },
      [TemplateCategory.FINANCE]: {
        backgroundColor: 'rgba(255, 149, 0, 0.1)',
        color: theme.colors.warning
      },
      [TemplateCategory.HR]: {
        backgroundColor: 'rgba(94, 92, 230, 0.1)',
        color: theme.colors.info
      },
      [TemplateCategory.PRODUCT]: {
        backgroundColor: 'rgba(255, 69, 58, 0.1)',
        color: theme.colors.error
      },
      [TemplateCategory.CUSTOM]: {
        backgroundColor: 'rgba(102, 102, 102, 0.1)',
        color: theme.colors.textSecondary
      }
    };
    return categoryStyles[category];
  }}
`;

// Component interfaces
interface TemplatePreviewProps {
  template: Template;
  content: Record<string, any>;
  isEditing?: boolean;
  onContentChange?: (content: Record<string, any>) => void;
}

// Helper function to render template content based on category
const renderTemplateContent = (content: Record<string, any>, category: TemplateCategory): JSX.Element => {
  const contentKeys = Object.keys(content);
  
  return (
    <div role="article" aria-label={`Template content for ${category}`}>
      {contentKeys.map((key) => {
        const value = content[key];
        return (
          <div key={key} className="content-item">
            <h3 className="content-label">{key}</h3>
            {typeof value === 'object' ? (
              <pre>{JSON.stringify(value, null, 2)}</pre>
            ) : (
              <p className="content-value">{String(value)}</p>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Main component
const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  template,
  content,
  isEditing = false,
  onContentChange
}) => {
  // Memoize rendered content for performance
  const renderedContent = useMemo(() => {
    return renderTemplateContent(content, template.category);
  }, [content, template.category]);

  // Handle content changes with debouncing
  const handleContentChange = useCallback((newContent: Record<string, any>) => {
    if (onContentChange) {
      onContentChange(newContent);
    }
  }, [onContentChange]);

  // Update preview when template or content changes
  useEffect(() => {
    const previewElement = document.querySelector('.preview-content');
    if (previewElement) {
      previewElement.scrollTop = 0;
    }
  }, [template.id]);

  return (
    <PreviewContainer
      elevation={isEditing ? 1 : 0}
      role="region"
      aria-label={`Preview of ${template.name}`}
    >
      <PreviewHeader>
        <h2>{template.name}</h2>
        <CategoryBadge category={template.category}>
          {template.category}
        </CategoryBadge>
      </PreviewHeader>
      
      <PreviewContent
        className="preview-content"
        role="presentation"
        aria-live={isEditing ? 'polite' : 'off'}
      >
        {renderedContent}
      </PreviewContent>
    </PreviewContainer>
  );
};

export default TemplatePreview;