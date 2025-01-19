import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import QRCode from 'qrcode.react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useAuth } from '../../hooks/useAuth';
import { validatePassword } from '../../utils/validation';
import { fadeIn } from '../../styles/animations';

// Styled components with MacOS-inspired design
const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
  animation: ${fadeIn} 0.3s ease-in-out;
`;

const Section = styled.section`
  background: var(--color-surface);
  border-radius: 8px;
  padding: 24px;
  box-shadow: var(--shadow-surface);
`;

const SectionTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 16px;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 400px;
`;

const PasswordStrengthIndicator = styled.div<{ strength: number }>`
  height: 4px;
  background: ${({ strength }) => 
    strength < 2 ? 'var(--color-error)' :
    strength < 3 ? 'var(--color-warning)' :
    'var(--color-success)'
  };
  width: ${({ strength }) => (strength * 25)}%;
  border-radius: 2px;
  transition: all 0.3s ease-in-out;
`;

const SessionList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 16px 0;
`;

const SessionItem = styled.li`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
  }
`;

const MFAOptions = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-top: 16px;
`;

// Interfaces
interface SecuritySettingsProps {
  className?: string;
}

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface MFAFormData {
  enabled: boolean;
  method: 'sms' | 'totp';
  phoneNumber: string;
  verificationCode: string;
  secret: string;
}

interface SessionData {
  id: string;
  device: string;
  location: string;
  lastActive: Date;
  isCurrent: boolean;
}

// Component implementation
export const SecuritySettings: React.FC<SecuritySettingsProps> = ({ className }) => {
  const { user, isAuthenticated } = useAuth();
  const [passwordForm, setPasswordForm] = useState<PasswordFormData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [mfaForm, setMFAForm] = useState<MFAFormData>({
    enabled: user?.mfaEnabled || false,
    method: 'totp',
    phoneNumber: '',
    verificationCode: '',
    secret: ''
  });
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password change handler
  const handlePasswordChange = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        throw new Error('New passwords do not match');
      }

      const validation = validatePassword(passwordForm.newPassword);
      if (!validation.isValid) {
        throw new Error(validation.errors[0]);
      }

      // API call would go here
      await new Promise(resolve => setTimeout(resolve, 1000));

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [passwordForm]);

  // MFA configuration handler
  const handleMFAUpdate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mfaForm.enabled && !mfaForm.verificationCode) {
        throw new Error('Verification code is required');
      }

      // API call would go here
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [mfaForm]);

  // Session management handler
  const handleSessionRevoke = useCallback(async (sessionId: string) => {
    try {
      // API call would go here
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSessions(prev => prev.filter(session => session.id !== sessionId));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // Password strength calculator
  useEffect(() => {
    if (passwordForm.newPassword) {
      const validation = validatePassword(passwordForm.newPassword);
      const strength = Object.values(validation.details || {}).filter(Boolean).length;
      setPasswordStrength(strength);
    } else {
      setPasswordStrength(0);
    }
  }, [passwordForm.newPassword]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Container className={className}>
      <Section>
        <SectionTitle>Password Settings</SectionTitle>
        <Form onSubmit={handlePasswordChange} aria-label="Password change form">
          <Input
            type="password"
            name="currentPassword"
            value={passwordForm.currentPassword}
            onChange={e => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
            placeholder="Current Password"
            required
            aria-label="Current password"
          />
          <Input
            type="password"
            name="newPassword"
            value={passwordForm.newPassword}
            onChange={e => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
            placeholder="New Password"
            required
            aria-label="New password"
          />
          <PasswordStrengthIndicator strength={passwordStrength} aria-label="Password strength indicator" />
          <Input
            type="password"
            name="confirmPassword"
            value={passwordForm.confirmPassword}
            onChange={e => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
            placeholder="Confirm New Password"
            required
            aria-label="Confirm new password"
          />
          <Button type="submit" disabled={loading} aria-busy={loading}>
            Change Password
          </Button>
        </Form>
      </Section>

      <Section>
        <SectionTitle>Two-Factor Authentication</SectionTitle>
        <Form onSubmit={handleMFAUpdate} aria-label="MFA configuration form">
          <MFAOptions>
            <Button
              variant="secondary"
              onClick={() => setMFAForm(prev => ({ ...prev, method: 'totp' }))}
              aria-pressed={mfaForm.method === 'totp'}
            >
              Authenticator App
            </Button>
            <Button
              variant="secondary"
              onClick={() => setMFAForm(prev => ({ ...prev, method: 'sms' }))}
              aria-pressed={mfaForm.method === 'sms'}
            >
              SMS Verification
            </Button>
          </MFAOptions>

          {mfaForm.method === 'totp' && mfaForm.secret && (
            <QRCode
              value={mfaForm.secret}
              size={200}
              level="H"
              aria-label="QR code for authenticator app"
            />
          )}

          {mfaForm.method === 'sms' && (
            <Input
              type="tel"
              name="phoneNumber"
              value={mfaForm.phoneNumber}
              onChange={e => setMFAForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
              placeholder="Phone Number"
              aria-label="Phone number for SMS verification"
            />
          )}

          <Input
            type="text"
            name="verificationCode"
            value={mfaForm.verificationCode}
            onChange={e => setMFAForm(prev => ({ ...prev, verificationCode: e.target.value }))}
            placeholder="Verification Code"
            aria-label="Verification code"
          />

          <Button type="submit" disabled={loading} aria-busy={loading}>
            {mfaForm.enabled ? 'Update 2FA' : 'Enable 2FA'}
          </Button>
        </Form>
      </Section>

      <Section>
        <SectionTitle>Active Sessions</SectionTitle>
        <SessionList aria-label="Active sessions list">
          {sessions.map(session => (
            <SessionItem key={session.id}>
              <div>
                <div>{session.device}</div>
                <div>{session.location}</div>
                <div>{session.lastActive.toLocaleString()}</div>
              </div>
              {!session.isCurrent && (
                <Button
                  variant="text"
                  onClick={() => handleSessionRevoke(session.id)}
                  aria-label={`Revoke session from ${session.device}`}
                >
                  Revoke
                </Button>
              )}
            </SessionItem>
          ))}
        </SessionList>
      </Section>

      {error && (
        <div role="alert" aria-live="polite" style={{ color: 'var(--color-error)' }}>
          {error}
        </div>
      )}
    </Container>
  );
};

export default SecuritySettings;