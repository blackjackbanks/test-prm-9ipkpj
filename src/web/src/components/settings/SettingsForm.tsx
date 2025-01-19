import React, { useCallback, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import Button from '../common/Button';
import Input from '../common/Input';
import { useAuth } from '../../hooks/useAuth';
import { validateEmail, validatePassword } from '../../utils/validation';
import { fadeIn } from '../../styles/animations';

// Form validation schemas
const profileSchema = yup.object().shape({
  name: yup.string().required('Name is required').max(100, 'Name is too long'),
  email: yup.string().required('Email is required').email('Invalid email format'),
  phone: yup.string().nullable(),
  title: yup.string().max(200, 'Title is too long'),
});

const securitySchema = yup.object().shape({
  currentPassword: yup.string().required('Current password is required'),
  newPassword: yup
    .string()
    .required('New password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      'Password must include uppercase, lowercase, number and special character'
    ),
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('newPassword')], 'Passwords must match'),
});

const organizationSchema = yup.object().shape({
  orgName: yup.string().required('Organization name is required'),
  industry: yup.string().required('Industry is required'),
  size: yup.number().positive().integer(),
  website: yup.string().url('Must be a valid URL'),
});

// Styled components with MacOS-inspired design
const FormContainer = styled.form`
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.scale.lg};
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 8px;
  box-shadow: ${({ theme }) => theme.shadows.surface};
  animation: ${fadeIn} 0.3s ease-in-out;
`;

const FormSection = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.scale.xl};
`;

const FormTitle = styled.h2`
  font-family: ${({ theme }) => theme.typography.fontFamily.display};
  font-size: ${({ theme }) => theme.typography.fontSize.h2};
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: ${({ theme }) => theme.spacing.scale.md};
`;

const FormGroup = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.scale.lg};
`;

const FormLabel = styled.label`
  display: block;
  font-size: ${({ theme }) => theme.typography.fontSize.body};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: ${({ theme }) => theme.spacing.scale.xs};
`;

const ErrorMessage = styled.span`
  color: ${({ theme }) => theme.colors.error};
  font-size: ${({ theme }) => theme.typography.fontSize.small};
  margin-top: ${({ theme }) => theme.spacing.scale.xs};
  display: block;
`;

// Types
type SettingsFormType = 'profile' | 'security' | 'organization';

interface SettingsFormProps {
  type: SettingsFormType;
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
}

export const SettingsForm: React.FC<SettingsFormProps> = ({
  type,
  onSubmit,
  initialData = {}
}) => {
  const { user, securityEvents } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);

  // Initialize form with schema validation
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setError
  } = useForm({
    defaultValues: initialData,
    resolver: yup.reach(
      type === 'profile' ? profileSchema :
      type === 'security' ? securitySchema :
      organizationSchema
    )
  });

  // Handle form submission with security checks
  const handleFormSubmit = useCallback(async (data: any) => {
    try {
      await onSubmit(data);
    } catch (error) {
      setError('root', {
        type: 'manual',
        message: error.message || 'An error occurred. Please try again.'
      });
    }
  }, [onSubmit, setError]);

  // Reset form when initialData changes
  useEffect(() => {
    reset(initialData);
  }, [initialData, reset]);

  // Render appropriate form fields based on type
  const renderFormFields = () => {
    switch (type) {
      case 'profile':
        return (
          <>
            <FormGroup>
              <FormLabel htmlFor="name">Full Name</FormLabel>
              <Input
                {...register('name')}
                id="name"
                type="text"
                aria-describedby="name-error"
                error={errors.name?.message}
              />
              {errors.name && (
                <ErrorMessage id="name-error" role="alert">
                  {errors.name.message}
                </ErrorMessage>
              )}
            </FormGroup>
            <FormGroup>
              <FormLabel htmlFor="email">Email Address</FormLabel>
              <Input
                {...register('email')}
                id="email"
                type="email"
                aria-describedby="email-error"
                error={errors.email?.message}
              />
              {errors.email && (
                <ErrorMessage id="email-error" role="alert">
                  {errors.email.message}
                </ErrorMessage>
              )}
            </FormGroup>
            <FormGroup>
              <FormLabel htmlFor="phone">Phone Number (Optional)</FormLabel>
              <Input
                {...register('phone')}
                id="phone"
                type="tel"
                aria-describedby="phone-error"
                error={errors.phone?.message}
              />
              {errors.phone && (
                <ErrorMessage id="phone-error" role="alert">
                  {errors.phone.message}
                </ErrorMessage>
              )}
            </FormGroup>
          </>
        );

      case 'security':
        return (
          <>
            <FormGroup>
              <FormLabel htmlFor="currentPassword">Current Password</FormLabel>
              <Input
                {...register('currentPassword')}
                id="currentPassword"
                type="password"
                aria-describedby="currentPassword-error"
                error={errors.currentPassword?.message}
              />
              {errors.currentPassword && (
                <ErrorMessage id="currentPassword-error" role="alert">
                  {errors.currentPassword.message}
                </ErrorMessage>
              )}
            </FormGroup>
            <FormGroup>
              <FormLabel htmlFor="newPassword">New Password</FormLabel>
              <Input
                {...register('newPassword')}
                id="newPassword"
                type="password"
                aria-describedby="newPassword-error"
                error={errors.newPassword?.message}
              />
              {errors.newPassword && (
                <ErrorMessage id="newPassword-error" role="alert">
                  {errors.newPassword.message}
                </ErrorMessage>
              )}
            </FormGroup>
            <FormGroup>
              <FormLabel htmlFor="confirmPassword">Confirm New Password</FormLabel>
              <Input
                {...register('confirmPassword')}
                id="confirmPassword"
                type="password"
                aria-describedby="confirmPassword-error"
                error={errors.confirmPassword?.message}
              />
              {errors.confirmPassword && (
                <ErrorMessage id="confirmPassword-error" role="alert">
                  {errors.confirmPassword.message}
                </ErrorMessage>
              )}
            </FormGroup>
          </>
        );

      case 'organization':
        return (
          <>
            <FormGroup>
              <FormLabel htmlFor="orgName">Organization Name</FormLabel>
              <Input
                {...register('orgName')}
                id="orgName"
                type="text"
                aria-describedby="orgName-error"
                error={errors.orgName?.message}
              />
              {errors.orgName && (
                <ErrorMessage id="orgName-error" role="alert">
                  {errors.orgName.message}
                </ErrorMessage>
              )}
            </FormGroup>
            <FormGroup>
              <FormLabel htmlFor="industry">Industry</FormLabel>
              <Input
                {...register('industry')}
                id="industry"
                type="text"
                aria-describedby="industry-error"
                error={errors.industry?.message}
              />
              {errors.industry && (
                <ErrorMessage id="industry-error" role="alert">
                  {errors.industry.message}
                </ErrorMessage>
              )}
            </FormGroup>
            <FormGroup>
              <FormLabel htmlFor="website">Website (Optional)</FormLabel>
              <Input
                {...register('website')}
                id="website"
                type="url"
                aria-describedby="website-error"
                error={errors.website?.message}
              />
              {errors.website && (
                <ErrorMessage id="website-error" role="alert">
                  {errors.website.message}
                </ErrorMessage>
              )}
            </FormGroup>
          </>
        );
    }
  };

  return (
    <FormContainer
      ref={formRef}
      onSubmit={handleSubmit(handleFormSubmit)}
      noValidate
      aria-label={`${type} Settings Form`}
    >
      <FormSection>
        <FormTitle>
          {type === 'profile' ? 'Profile Settings' :
           type === 'security' ? 'Security Settings' :
           'Organization Settings'}
        </FormTitle>
        {renderFormFields()}
      </FormSection>

      {errors.root && (
        <ErrorMessage role="alert" style={{ marginBottom: '1rem' }}>
          {errors.root.message}
        </ErrorMessage>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        loading={isSubmitting}
        fullWidth
        aria-label={`Save ${type} settings`}
      >
        {isSubmitting ? 'Saving...' : 'Save Changes'}
      </Button>
    </FormContainer>
  );
};

export default SettingsForm;