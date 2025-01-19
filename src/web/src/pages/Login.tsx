import React, { useState, useCallback, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion'; // ^6.0.0
import * as yup from 'yup'; // ^1.0.0
import { analytics } from '@segment/analytics-next'; // ^1.0.0
import { useAuth } from '../../hooks/useAuth';
import { OAuthProvider, MFAType } from '../../types/auth';

// Validation schema with security requirements
const loginSchema = yup.object().shape({
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required')
    .max(255, 'Email must be less than 255 characters'),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
    ),
  mfaCode: yup
    .string()
    .matches(/^\d{6}$/, 'MFA code must be 6 digits')
    .when('mfaRequired', {
      is: true,
      then: yup.string().required('MFA code is required')
    })
});

// Styled components with MacOS-inspired design
const LoginContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
  background-color: ${({ theme }) => theme.colors.background};
  transition: background-color 0.3s ease;
`;

const LoginForm = styled(motion.form)`
  width: 100%;
  max-width: 400px;
  padding: 32px;
  border-radius: 12px;
  background-color: ${({ theme }) => theme.colors.surface};
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const Input = styled.input`
  width: 100%;
  padding: 12px;
  margin: 8px 0;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  font-size: 16px;
  transition: border-color 0.3s ease;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const Button = styled(motion.button)`
  width: 100%;
  padding: 12px;
  margin: 16px 0;
  border: none;
  border-radius: 6px;
  background-color: ${({ theme }) => theme.colors.primary};
  color: white;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.3s ease;

  &:disabled {
    background-color: ${({ theme }) => theme.colors.disabled};
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled(motion.div)`
  color: ${({ theme }) => theme.colors.error};
  font-size: 14px;
  margin: 4px 0;
`;

const OAuthButton = styled(Button)`
  background-color: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.text};
  margin: 8px 0;
`;

const LoadingSpinner = styled(motion.div)`
  width: 24px;
  height: 24px;
  border: 3px solid ${({ theme }) => theme.colors.background};
  border-top-color: ${({ theme }) => theme.colors.primary};
  border-radius: 50%;
`;

const Login: React.FC = () => {
  const { login, loginWithOAuth, verifyMFA, loading, error } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '', mfaCode: '' });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showMFA, setShowMFA] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Track component mount for analytics
  useEffect(() => {
    analytics.track('Login Page Viewed');
    return () => {
      analytics.track('Login Page Exited');
    };
  }, []);

  // Handle form input changes with validation
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear validation error when user starts typing
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
  }, [validationErrors]);

  // Handle form submission with enhanced security
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Validate form data
      await loginSchema.validate(formData, { abortEarly: false });

      if (showMFA) {
        await verifyMFA(formData.mfaCode);
        analytics.track('MFA Verification Success');
      } else {
        const result = await login({
          email: formData.email,
          password: formData.password
        });

        if (result?.mfaRequired) {
          setShowMFA(true);
          analytics.track('MFA Required');
        } else {
          analytics.track('Login Success');
        }
      }
    } catch (err) {
      if (err instanceof yup.ValidationError) {
        const errors: Record<string, string> = {};
        err.inner.forEach(e => {
          if (e.path) errors[e.path] = e.message;
        });
        setValidationErrors(errors);
      }
      analytics.track('Login Error', { error: err.message });
    }
  }, [formData, showMFA, login, verifyMFA]);

  // Handle OAuth login
  const handleOAuthLogin = useCallback(async (provider: OAuthProvider) => {
    try {
      await loginWithOAuth(provider);
      analytics.track('OAuth Login Success', { provider });
    } catch (err) {
      analytics.track('OAuth Login Error', { provider, error: err.message });
    }
  }, [loginWithOAuth]);

  // Manage focus for accessibility
  useEffect(() => {
    if (showMFA) {
      const mfaInput = formRef.current?.querySelector('input[name="mfaCode"]');
      if (mfaInput instanceof HTMLElement) {
        mfaInput.focus();
      }
    }
  }, [showMFA]);

  return (
    <LoginContainer>
      <LoginForm
        ref={formRef}
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        role="form"
        aria-label="Login form"
      >
        <AnimatePresence mode="wait">
          {!showMFA ? (
            <>
              <Input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Email"
                aria-label="Email"
                aria-invalid={!!validationErrors.email}
                aria-describedby="email-error"
                autoComplete="email"
              />
              {validationErrors.email && (
                <ErrorMessage
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  id="email-error"
                  role="alert"
                >
                  {validationErrors.email}
                </ErrorMessage>
              )}

              <Input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Password"
                aria-label="Password"
                aria-invalid={!!validationErrors.password}
                aria-describedby="password-error"
                autoComplete="current-password"
              />
              {validationErrors.password && (
                <ErrorMessage
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  id="password-error"
                  role="alert"
                >
                  {validationErrors.password}
                </ErrorMessage>
              )}
            </>
          ) : (
            <>
              <Input
                type="text"
                name="mfaCode"
                value={formData.mfaCode}
                onChange={handleInputChange}
                placeholder="Enter 6-digit MFA code"
                aria-label="MFA code"
                aria-invalid={!!validationErrors.mfaCode}
                aria-describedby="mfa-error"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="\d{6}"
              />
              {validationErrors.mfaCode && (
                <ErrorMessage
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  id="mfa-error"
                  role="alert"
                >
                  {validationErrors.mfaCode}
                </ErrorMessage>
              )}
            </>
          )}
        </AnimatePresence>

        <Button
          type="submit"
          disabled={loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {loading ? (
            <LoadingSpinner
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          ) : (
            showMFA ? 'Verify MFA' : 'Log In'
          )}
        </Button>

        {error && (
          <ErrorMessage
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            role="alert"
          >
            {error.message}
          </ErrorMessage>
        )}

        {!showMFA && (
          <>
            <OAuthButton
              type="button"
              onClick={() => handleOAuthLogin(OAuthProvider.GOOGLE)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Continue with Google
            </OAuthButton>
            <OAuthButton
              type="button"
              onClick={() => handleOAuthLogin(OAuthProvider.MICROSOFT)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Continue with Microsoft
            </OAuthButton>
            <OAuthButton
              type="button"
              onClick={() => handleOAuthLogin(OAuthProvider.APPLE)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Continue with Apple
            </OAuthButton>
          </>
        )}
      </LoginForm>
    </LoginContainer>
  );
};

export default Login;