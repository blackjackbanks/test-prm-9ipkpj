import React, { useState, useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { useButton, useTextField, useSwitch } from '@react-aria/hooks';
import { Organization, NotificationFrequency, Theme } from '../../types/organization';
import ErrorBoundary from '../common/ErrorBoundary';
import { validateEmail, ValidationError, sanitizeInput } from '../../utils/validation';

// Styled components with MacOS-inspired design
const SettingsContainer = styled.div`
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
`;

const SettingsSection = styled.section`
  margin-bottom: 32px;
  background-color: var(--surface-background);
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const SectionTitle = styled.h2`
  font-size: 20px;
  font-weight: 500;
  margin-bottom: 16px;
  color: var(--text-primary);
`;

const FormGroup = styled.div`
  margin-bottom: 16px;
  position: relative;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
`;

const Input = styled.input`
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  font-size: 14px;
  background: var(--input-background);
  color: var(--text-primary);
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px var(--primary-color-alpha);
  }
`;

const ErrorMessage = styled.span`
  color: var(--error);
  font-size: 12px;
  margin-top: 4px;
  position: absolute;
  bottom: -20px;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--overlay-background);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
`;

interface OrganizationSettingsProps {
  organization: Organization;
  isLoading: boolean;
  error: Error | null;
}

export const OrganizationSettings: React.FC<OrganizationSettingsProps> = ({
  organization,
  isLoading,
  error
}) => {
  const dispatch = useDispatch();
  const [formData, setFormData] = useState({
    name: organization.name,
    industry: organization.industry,
    settings: organization.settings
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Form validation hook
  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};
    
    // Validate organization name
    if (!formData.name.trim()) {
      errors.name = 'Organization name is required';
    }

    // Validate industry
    if (!formData.industry.trim()) {
      errors.industry = 'Industry is required';
    }

    // Validate notification email if enabled
    if (formData.settings.notifications.email) {
      const contactEmail = formData.settings.notifications.emailAddress;
      if (contactEmail) {
        const emailValidation = validateEmail(contactEmail);
        if (!emailValidation.isValid) {
          errors.contactEmail = emailValidation.errors[0];
        }
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      dispatch({ type: 'UPDATE_ORGANIZATION_REQUEST' });
      
      // Sanitize input data
      const sanitizedData = {
        ...formData,
        name: sanitizeInput(formData.name),
        industry: sanitizeInput(formData.industry)
      };

      await dispatch({
        type: 'UPDATE_ORGANIZATION',
        payload: sanitizedData
      });
    } catch (error) {
      setFormErrors({
        submit: error instanceof ValidationError ? error.message : 'Failed to update organization settings'
      });
    }
  };

  // Handle input changes
  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when field is modified
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  // Accessibility hooks
  const { buttonProps } = useButton({
    onPress: () => handleSubmit,
    isDisabled: isLoading
  });

  return (
    <ErrorBoundary>
      <SettingsContainer role="main" aria-label="Organization Settings">
        {isLoading && (
          <LoadingOverlay role="alert" aria-busy="true">
            <span>Updating settings...</span>
          </LoadingOverlay>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <SettingsSection>
            <SectionTitle>Profile Settings</SectionTitle>
            <FormGroup>
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                type="text"
                value={formData.name}
                onChange={e => handleInputChange('name', e.target.value)}
                aria-invalid={!!formErrors.name}
                aria-describedby={formErrors.name ? 'nameError' : undefined}
              />
              {formErrors.name && (
                <ErrorMessage id="nameError" role="alert">{formErrors.name}</ErrorMessage>
              )}
            </FormGroup>

            <FormGroup>
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                type="text"
                value={formData.industry}
                onChange={e => handleInputChange('industry', e.target.value)}
                aria-invalid={!!formErrors.industry}
                aria-describedby={formErrors.industry ? 'industryError' : undefined}
              />
              {formErrors.industry && (
                <ErrorMessage id="industryError" role="alert">{formErrors.industry}</ErrorMessage>
              )}
            </FormGroup>
          </SettingsSection>

          <SettingsSection>
            <SectionTitle>Theme Settings</SectionTitle>
            <FormGroup>
              <Label htmlFor="theme">Theme Preference</Label>
              <select
                id="theme"
                value={formData.settings.theme}
                onChange={e => handleInputChange('settings.theme', e.target.value)}
                aria-label="Select theme preference"
              >
                {Object.values(Theme).map(theme => (
                  <option key={theme} value={theme}>{theme}</option>
                ))}
              </select>
            </FormGroup>
          </SettingsSection>

          <SettingsSection>
            <SectionTitle>Notification Preferences</SectionTitle>
            <FormGroup>
              <Label htmlFor="notificationFrequency">Notification Frequency</Label>
              <select
                id="notificationFrequency"
                value={formData.settings.notifications.frequency}
                onChange={e => handleInputChange('settings.notifications.frequency', e.target.value)}
                aria-label="Select notification frequency"
              >
                {Object.values(NotificationFrequency).map(frequency => (
                  <option key={frequency} value={frequency}>{frequency}</option>
                ))}
              </select>
            </FormGroup>
          </SettingsSection>

          <button
            {...buttonProps}
            type="submit"
            disabled={isLoading}
            aria-busy={isLoading}
          >
            Save Changes
          </button>

          {error && (
            <div role="alert" aria-live="polite" className="error-message">
              {error.message}
            </div>
          )}
        </form>
      </SettingsContainer>
    </ErrorBoundary>
  );
};

export default OrganizationSettings;