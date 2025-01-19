import React, { Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createGlobalStyle } from 'styled-components';
import { ErrorBoundary } from 'react-error-boundary';
import { Analytics } from '@core/analytics'; // v1.0.0

// Internal imports
import AppLayout from './components/layout/AppLayout';
import useAuth from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { ROUTES, PROTECTED_ROUTES } from './constants/routes';
import { lightTheme, darkTheme } from './styles/theme';

// Lazy-loaded components for code splitting
const Login = React.lazy(() => import('./pages/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Templates = React.lazy(() => import('./pages/Templates'));
const Integrations = React.lazy(() => import('./pages/Integrations'));
const Settings = React.lazy(() => import('./pages/Settings'));
const NotFound = React.lazy(() => import('./pages/NotFound'));

// Global styles with MacOS-inspired design
const GlobalStyle = createGlobalStyle`
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html, body {
    height: 100%;
    font-family: ${({ theme }) => theme.typography.fontFamily.primary};
    font-size: ${({ theme }) => theme.typography.fontSize.body};
    line-height: ${({ theme }) => theme.typography.lineHeight.body};
    background: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.text};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  #root {
    height: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
`;

// Protected route component with MFA verification
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading, mfaRequired, mfaVerified } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (mfaRequired && !mfaVerified) {
    return <Navigate to={ROUTES.MFA_VERIFY} replace />;
  }

  return <>{children}</>;
};

// Main App component
const App: React.FC = () => {
  const { theme } = useTheme();
  const { isAuthenticated, loading } = useAuth();

  // Initialize analytics
  useEffect(() => {
    Analytics.initialize({
      appVersion: process.env.REACT_APP_VERSION,
      environment: process.env.NODE_ENV
    });
  }, []);

  // Theme selection based on system preference
  const selectedTheme = theme === 'dark' ? darkTheme : lightTheme;

  return (
    <ThemeProvider theme={selectedTheme}>
      <GlobalStyle />
      <ErrorBoundary
        fallback={
          <div role="alert">
            <h2>Application Error</h2>
            <p>Something went wrong. Please refresh the page.</p>
          </div>
        }
      >
        <BrowserRouter>
          <Suspense fallback={<div>Loading...</div>}>
            <Routes>
              {/* Public routes */}
              <Route
                path={ROUTES.LOGIN}
                element={
                  isAuthenticated ? (
                    <Navigate to={ROUTES.DASHBOARD} replace />
                  ) : (
                    <Login />
                  )
                }
              />

              {/* Protected routes */}
              <Route
                element={
                  <PrivateRoute>
                    <AppLayout />
                  </PrivateRoute>
                }
              >
                <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
                <Route path={ROUTES.TEMPLATES} element={<Templates />} />
                <Route path={ROUTES.INTEGRATIONS} element={<Integrations />} />
                <Route path={ROUTES.SETTINGS} element={<Settings />} />
              </Route>

              {/* Fallback route */}
              <Route path={ROUTES.NOT_FOUND} element={<NotFound />} />
              <Route path="*" element={<Navigate to={ROUTES.NOT_FOUND} replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  );
};

export default App;