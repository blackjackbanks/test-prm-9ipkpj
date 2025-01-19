import React, { useState } from 'react'; // v18.0.0
import styled from 'styled-components'; // v6.0.0
import Card from '../common/Card';
import Button from '../common/Button';
import { Template, TemplateCategory } from '../../types/template';

// Props interface for the TemplateCard component
interface TemplateCardProps {
  template: Template;
  onPreview: (template: Template) => Promise<void>;
  onUse: (template: Template) => Promise<void>;
  className?: string;
  testId?: string;
}

// Helper function to format dates with localization
const formatDate = (dateString: string, locale: string = 'en-US'): string => {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  } catch (error) {
    return dateString;
  }
};

// Helper function to get category-specific colors
const getCategoryColor = (category: TemplateCategory, theme: any): string => {
  const categoryColors = {
    [TemplateCategory.SALES]: theme.colors.primary,
    [TemplateCategory.MARKETING]: theme.colors.secondary,
    [TemplateCategory.OPERATIONS]: theme.colors.success,
    [TemplateCategory.FINANCE]: theme.colors.info,
    [TemplateCategory.HR]: theme.colors.warning,
    [TemplateCategory.PRODUCT]: theme.colors.secondary,
    [TemplateCategory.CUSTOM]: theme.colors.textSecondary
  };
  return categoryColors[category] || theme.colors.textSecondary;
};

// Styled components with MacOS-inspired design
const StyledTemplateCard = styled(Card)`
  width: 100%;
  max-width: 400px;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.base}px;
  transition: all 0.2s ease-in-out;
  position: relative;
  overflow: hidden;
`;

const CategoryBadge = styled.span<{ categoryColor: string }>`
  padding: 4px 8px;
  border-radius: 4px;
  font-size: ${({ theme }) => theme.typography.fontSize.small};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  text-transform: uppercase;
  background-color: ${({ categoryColor }) => `${categoryColor}20`};
  color: ${({ categoryColor }) => categoryColor};
  transition: background-color 0.2s ease;
`;

const TemplateInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.base}px;
  padding: ${({ theme }) => theme.spacing.base}px;
`;

const TemplateName = styled.h3`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSize.h3};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text};
`;

const TemplateDescription = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSize.body};
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: 1.5;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.base}px;
  margin-top: auto;
  padding: ${({ theme }) => theme.spacing.base}px;
`;

const MetricsDisplay = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: ${({ theme }) => theme.typography.fontSize.small};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  onPreview,
  onUse,
  className,
  testId
}) => {
  const [isPreviewLoading, setPreviewLoading] = useState(false);
  const [isUseLoading, setUseLoading] = useState(false);

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      await onPreview(template);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleUse = async () => {
    setUseLoading(true);
    try {
      await onUse(template);
    } finally {
      setUseLoading(false);
    }
  };

  return (
    <StyledTemplateCard
      elevation={1}
      hoverable
      className={className}
      data-testid={testId}
      role="article"
      aria-labelledby={`template-name-${template.id}`}
    >
      <TemplateInfo>
        <CategoryBadge
          categoryColor={getCategoryColor(template.category, theme)}
          role="status"
        >
          {template.category}
        </CategoryBadge>
        
        <TemplateName id={`template-name-${template.id}`}>
          {template.name}
        </TemplateName>
        
        <TemplateDescription>
          {template.description}
        </TemplateDescription>
        
        <MetricsDisplay>
          <span>Version {template.version}</span>
          <span>•</span>
          <span>Updated {formatDate(template.updatedAt)}</span>
        </MetricsDisplay>
      </TemplateInfo>

      <ActionButtons>
        <Button
          variant="secondary"
          size="medium"
          onClick={handlePreview}
          loading={isPreviewLoading}
          disabled={!template.isActive}
          aria-label={`Preview ${template.name} template`}
        >
          Preview
        </Button>
        <Button
          variant="primary"
          size="medium"
          onClick={handleUse}
          loading={isUseLoading}
          disabled={!template.isActive}
          aria-label={`Use ${template.name} template`}
        >
          Use Template
        </Button>
      </ActionButtons>
    </StyledTemplateCard>
  );
};

export default TemplateCard;