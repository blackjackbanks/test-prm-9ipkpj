import React, { useCallback, useState, useEffect } from 'react';
import styled from 'styled-components'; // v6.0.0
import { useNavigate } from 'react-router-dom'; // v6.0.0
import sanitizeHtml from 'sanitize-html'; // v2.11.0

import SettingsForm from './SettingsForm';
import { useAuth } from '../../hooks/useAuth';
import { validateProfileData } from '../../utils/validation';
import { fadeIn } from '../../styles/animations';
import { media } from '../../styles/breakpoints';

// Styled components with MacOS-inspired design
const ProfileContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.scale.lg};
  padding: ${({ theme }) => theme.spacing.scale.lg};
  max-width: 480px;
  width: 100%;
  position: relative;
  background: var(--color-surface);
  border-radius: 12px;
  box-shadow: var(--shadow-surface);
  transition: all 0.2s ease-in-out;
  animation: ${fadeIn} 0.3s ease-in-out;

  ${media.tablet`
    padding: ${({ theme }) => theme.spacing.scale.xl};
  `}
`;

const Title = styled.h1`
  font-family: ${({ theme }) => theme.typography.fontFamily.display};
  font-size: ${({ theme }) => theme.typography.fontSize.h1};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: var(--color-text);
  margin-bottom: ${({ theme }) => theme.spacing.scale.md};
  line-height: 1.2;
`;

const Description = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.body};
  color: var(--color-text-secondary);
  margin-bottom: ${({ theme }) => theme.spacing.scale.lg};
  line-height: 1.5;
`;

const AccessibilityFeatures = styled.div`
  padding: ${({ theme }) => theme.spacing.scale.md};
  background: var(--color-surface-alt);
  border-radius: 8px;
  margin-top: ${({ theme }) => theme.spacing.scale.md};
`;

// Interface for profile form data
interface ProfileFormData {
  name: string;
  email: string;
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
    language: 'en' | 'es' | 'fr';
    accessibility: {
      highContrast: boolean;
      reducedMotion: boolean;
      fontSize: 'normal' | 'large' | 'xlarge';
    };
  };
}

// Debounce decorator for form submission
const debounce = (delay: number) => {
  let timeoutId: NodeJS.Timeout;
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const original = descriptor.value;
    descriptor.value = function (...args: any[]) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => original.apply(this, args), delay);
    };
  };
};

export const ProfileSettings: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Handle profile update with security measures
  @debounce(300)
  const handleProfileUpdate = useCallback(async (data: ProfileFormData) => {
    try {
      setLoading(true);
      setError(null);

      // Sanitize input data
      const sanitizedData = {
        name: sanitizeHtml(data.name, {
          allowedTags: [],
          allowedAttributes: {}
        }),
        email: sanitizeHtml(data.email, {
          allowedTags: [],
          allowedAttributes: {}
        }),
        preferences: data.preferences
      };

      // Validate form data
      const validationResult = validateProfileData(sanitizedData);
      if (!validationResult.isValid) {
        throw new Error(validationResult.errors.join(', '));
      }

      // Implementation would call API to update profile
      // await updateProfile(sanitizedData);

      // Announce success to screen readers
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'alert');
      announcement.setAttribute('aria-live', 'polite');
      announcement.textContent = 'Profile updated successfully';
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 1000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      console.error('Profile update failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  if (!user) return null;

  return (
    <ProfileContainer role="main" aria-labelledby="profile-title">
      <Title id="profile-title">Profile Settings</Title>
      <Description>
        Manage your profile information and preferences. Changes will be automatically saved.
      </Description>

      <SettingsForm
        type="profile"
        onSubmit={handleProfileUpdate}
        initialData={{
          name: user.name,
          email: user.email,
          preferences: user.preferences
        }}
      />

      <AccessibilityFeatures
        role="region"
        aria-label="Accessibility preferences"
      >
        <SettingsForm
          type="accessibility"
          onSubmit={handleProfileUpdate}
          initialData={user.preferences.accessibility}
        />
      </AccessibilityFeatures>

      {error && (
        <div role="alert" aria-live="polite" style={{ color: 'var(--color-error)' }}>
          {error}
        </div>
      )}
    </ProfileContainer>
  );
};

export default ProfileSettings;