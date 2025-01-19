import React, { useEffect, useMemo, memo } from 'react'; // v18.0.0
import { useSelector } from 'react-redux'; // v8.0.0
import styled from 'styled-components'; // v6.0.0
import Card from '../common/Card';
import { Template, TemplateCategory } from '../../types/template';
import { selectTemplates, selectTemplateLoading } from '../../store/slices/templateSlice';
import { LoadingState } from '../../types/common';

// Props interface with enhanced callback typing
interface TemplatesWidgetProps {
  onTemplateSelect: (template: Template) => void;
  className?: string;
}

// Styled components with MacOS-inspired design
const WidgetContainer = styled.div`
  width: 100%;
  height: 100%;
  min-height: 300px;
  position: relative;
  overflow: hidden;
  border-radius: ${({ theme }) => theme.spacing.scale.sm};
  background: ${({ theme }) => theme.colors.background};
  transition: all 0.2s ease-in-out;
`;

const WidgetHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.scale.md};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surfaceAlt};
`;

const Title = styled.h2`
  font-family: ${({ theme }) => theme.typography.fontFamily.display};
  font-size: ${({ theme }) => theme.typography.fontSize.h2};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text};
  margin: 0;
`;

const TemplateGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: ${({ theme }) => theme.spacing.scale.md};
  padding: ${({ theme }) => theme.spacing.scale.md};
  overflow-y: auto;
  max-height: calc(100% - 60px);
  scroll-behavior: smooth;
  will-change: transform;

  @media (max-width: ${({ theme }) => theme.typography.fontSize.h3}) {
    grid-template-columns: 1fr;
  }
`;

const TemplateCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.scale.sm};
  min-height: 120px;
`;

const TemplateName = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.h3};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text};
  margin: 0;
`;

const TemplateDescription = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.body};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

const CategoryBadge = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.small};
  color: ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.focus};
  padding: 2px 8px;
  border-radius: 12px;
  align-self: flex-start;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.scale.xl};
  text-align: center;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

// Memoized function to get recent templates
const getRecentTemplates = (templates: Template[]): Template[] => {
  return templates
    .filter(template => template.isActive)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6);
};

// Main component with accessibility enhancements
const TemplatesWidget: React.FC<TemplatesWidgetProps> = memo(({ onTemplateSelect, className }) => {
  const templates = useSelector(selectTemplates);
  const loadingState = useSelector(selectTemplateLoading);

  const recentTemplates = useMemo(() => getRecentTemplates(templates), [templates]);

  // Render loading skeleton
  if (loadingState === LoadingState.LOADING) {
    return (
      <WidgetContainer className={className} role="region" aria-busy="true">
        <WidgetHeader>
          <Title>Recent Templates</Title>
        </WidgetHeader>
        <TemplateGrid>
          {Array.from({ length: 6 }).map((_, index) => (
            <TemplateCard key={`skeleton-${index}`} elevation={0} />
          ))}
        </TemplateGrid>
      </WidgetContainer>
    );
  }

  return (
    <WidgetContainer 
      className={className}
      role="region"
      aria-label="Recent Templates"
    >
      <WidgetHeader>
        <Title>Recent Templates</Title>
      </WidgetHeader>
      
      <TemplateGrid>
        {recentTemplates.length > 0 ? (
          recentTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              elevation={0}
              hoverable
              role="button"
              tabIndex={0}
              onClick={() => onTemplateSelect(template)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onTemplateSelect(template);
                }
              }}
              aria-label={`${template.name} template in ${template.category} category`}
            >
              <CategoryBadge>
                {template.category.charAt(0).toUpperCase() + template.category.slice(1)}
              </CategoryBadge>
              <TemplateName>{template.name}</TemplateName>
              <TemplateDescription>{template.description}</TemplateDescription>
            </TemplateCard>
          ))
        ) : (
          <EmptyState>
            <p>No templates available</p>
            <p>Create a new template to get started</p>
          </EmptyState>
        )}
      </TemplateGrid>
    </WidgetContainer>
  );
});

TemplatesWidget.displayName = 'TemplatesWidget';

export default TemplatesWidget;