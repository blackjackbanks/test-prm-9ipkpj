import React, { useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { Analytics } from '@analytics/react';
import Button from '../components/common/Button';
import { ROUTES } from '../constants/routes';
import ErrorBoundary from '../components/common/ErrorBoundary';

// Styled components with MacOS-inspired design
const NotFoundContainer = styled.main`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: ${({ theme }) => theme.spacing.scale.xl};
  text-align: center;
  max-width: 1200px;
  margin: 0 auto;
  background-color: ${({ theme }) => theme.colors.background};
  
  @media (max-width: 768px) {
    padding: ${({ theme }) => theme.spacing.scale.lg};
  }
  
  @media (max-width: 320px) {
    padding: ${({ theme }) => theme.spacing.scale.md};
  }
`;

const Title = styled.h1`
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  margin-bottom: ${({ theme }) => theme.spacing.scale.lg};
  color: ${({ theme }) => theme.colors.text};
  line-height: 1.2;
`;

const Description = styled.p`
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: clamp(1rem, 2vw, 1.25rem);
  margin-bottom: ${({ theme }) => theme.spacing.scale.xl};
  color: ${({ theme }) => theme.colors.textSecondary};
  max-width: 480px;
  line-height: 1.5;
`;

const NotFound: React.FC = () => {
  const navigate = useNavigate();

  // Track 404 page views
  useEffect(() => {
    Analytics.trackEvent('page_view', {
      page_type: '404',
      path: window.location.pathname,
      referrer: document.referrer,
      timestamp: new Date().toISOString()
    });
  }, []);

  // Handle navigation with analytics tracking
  const handleNavigateHome = useCallback(() => {
    Analytics.trackEvent('navigation', {
      action: 'return_home',
      from: '404_page',
      timestamp: new Date().toISOString()
    });
    navigate(ROUTES.DASHBOARD);
  }, [navigate]);

  return (
    <ErrorBoundary>
      <NotFoundContainer role="main" aria-labelledby="not-found-title">
        <Title 
          id="not-found-title"
          aria-label="404 Page Not Found"
        >
          404 Not Found
        </Title>
        <Description lang="en">
          The page you're looking for doesn't exist or has been moved. 
          Please check the URL or return to the dashboard.
        </Description>
        <Button
          variant="primary"
          size="large"
          onClick={handleNavigateHome}
          aria-label="Return to dashboard"
          tabIndex={0}
        >
          Return to Dashboard
        </Button>
      </NotFoundContainer>
    </ErrorBoundary>
  );
};

export default NotFound;