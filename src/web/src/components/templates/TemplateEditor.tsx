import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styled from 'styled-components'; // v6.0.0
import debounce from 'lodash/debounce'; // v4.17.21
import { Input } from '../common/Input';
import { TemplatePreview } from './TemplatePreview';
import { useTheme } from '../../hooks/useTheme';
import { 
  Template, 
  TemplateCategory, 
  CreateTemplateRequest, 
  UpdateTemplateRequest 
} from '../../types/template';
import { validateInput } from '../../utils/validation';
import { fadeIn } from '../../styles/animations';

// Styled Components
const EditorContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.scale.xl};
  padding: ${({ theme }) => theme.spacing.scale.lg};
  background: ${({ theme }) => theme.colors.background};
  border-radius: ${({ theme }) => theme.spacing.scale.sm};
  min-height: 600px;
  animation: ${fadeIn} 0.3s ease-in-out;
`;

const FormSection = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.scale.md};
  padding: ${({ theme }) => theme.spacing.scale.lg};
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.spacing.scale.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const PreviewSection = styled.div`
  position: sticky;
  top: ${({ theme }) => theme.spacing.scale.lg};
  height: fit-content;
  max-height: calc(100vh - ${({ theme }) => theme.spacing.scale.xxl});
  overflow: auto;
`;

const CategorySelect = styled.select`
  width: 100%;
  height: 40px;
  padding: 0 ${({ theme }) => theme.spacing.scale.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.spacing.scale.xs};
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.body};

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.focus};
  }
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.scale.sm};
  margin-top: ${({ theme }) => theme.spacing.scale.lg};
  padding-top: ${({ theme }) => theme.spacing.scale.md};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: ${({ theme }) => `${theme.spacing.scale.sm} ${theme.spacing.scale.md}`};
  border-radius: ${({ theme }) => theme.spacing.scale.xs};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.body};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  ${({ variant, theme }) => 
    variant === 'primary' 
      ? `
        background: ${theme.colors.primary};
        color: white;
        border: none;
        &:hover {
          background: ${theme.colors.secondary};
        }
      `
      : `
        background: transparent;
        color: ${theme.colors.text};
        border: 1px solid ${theme.colors.border};
        &:hover {
          background: ${theme.colors.surface};
        }
      `
  }
`;

// Props interface
interface TemplateEditorProps {
  template: Template | null;
  onSave: (template: CreateTemplateRequest | UpdateTemplateRequest) => Promise<void>;
  onCancel: () => void;
  autosaveInterval?: number;
}

// Main component
export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  onSave,
  onCancel,
  autosaveInterval = 30000
}) => {
  const { theme } = useTheme();
  const [formData, setFormData] = useState({
    name: template?.name || '',
    description: template?.description || '',
    category: template?.category || TemplateCategory.CUSTOM,
    content: template?.content || {},
    version: template?.version || '1.0.0'
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Debounced validation
  const validateForm = useMemo(() => 
    debounce((data: typeof formData) => {
      const newErrors: Record<string, string> = {};
      
      if (!data.name.trim()) {
        newErrors.name = 'Template name is required';
      }
      if (!data.description.trim()) {
        newErrors.description = 'Template description is required';
      }
      if (Object.keys(data.content).length === 0) {
        newErrors.content = 'Template content is required';
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }, 300),
    []
  );

  // Handle form changes
  const handleChange = useCallback((
    field: keyof typeof formData,
    value: string | TemplateCategory | Record<string, any>
  ) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      validateForm(newData);
      return newData;
    });
  }, [validateForm]);

  // Autosave functionality
  useEffect(() => {
    if (!template || !autosaveInterval) return;

    const autosaveTimer = setInterval(async () => {
      if (validateForm(formData)) {
        try {
          setIsSaving(true);
          await onSave({
            id: template.id,
            ...formData,
            isActive: template.isActive
          } as UpdateTemplateRequest);
        } finally {
          setIsSaving(false);
        }
      }
    }, autosaveInterval);

    return () => clearInterval(autosaveTimer);
  }, [template, formData, autosaveInterval, onSave, validateForm]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(formData)) return;

    try {
      setIsSaving(true);
      if (template) {
        await onSave({
          id: template.id,
          ...formData,
          isActive: template.isActive
        } as UpdateTemplateRequest);
      } else {
        await onSave({
          orgId: '', // Should be provided from context/props
          ...formData
        } as CreateTemplateRequest);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <EditorContainer>
      <FormSection onSubmit={handleSubmit}>
        <Input
          name="name"
          value={formData.name}
          placeholder="Template Name"
          error={errors.name}
          onChange={e => handleChange('name', e.target.value)}
          aria-label="Template name"
          required
        />

        <Input
          name="description"
          value={formData.description}
          placeholder="Template Description"
          error={errors.description}
          onChange={e => handleChange('description', e.target.value)}
          aria-label="Template description"
          required
        />

        <CategorySelect
          value={formData.category}
          onChange={e => handleChange('category', e.target.value as TemplateCategory)}
          aria-label="Template category"
        >
          {Object.values(TemplateCategory).map(category => (
            <option key={category} value={category}>
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </option>
          ))}
        </CategorySelect>

        <Actions>
          <Button type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Template'}
          </Button>
        </Actions>
      </FormSection>

      <PreviewSection>
        <TemplatePreview
          template={{
            id: template?.id || 'preview',
            orgId: template?.orgId || '',
            ...formData,
            isActive: template?.isActive || false,
            createdAt: template?.createdAt || new Date().toISOString(),
            updatedAt: template?.updatedAt || new Date().toISOString()
          }}
          content={formData.content}
          isEditing={true}
          onContentChange={content => handleChange('content', content)}
        />
      </PreviewSection>
    </EditorContainer>
  );
};

export default TemplateEditor;