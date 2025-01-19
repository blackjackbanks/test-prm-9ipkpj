import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { ErrorBoundary } from 'react-error-boundary';
import Analytics from '@mixpanel/browser'; // v2.45.0

import App from './App';
import { store } from './store';
import { GlobalStyles } from './styles/global';

// Browser support validation
const MIN_BROWSER_VERSIONS = {
  chrome: 90,
  firefox: 88,
  safari: 14,
  edge: 90
};

/**
 * Initialize analytics tracking
 */
const initializeAnalytics = (): void => {
  const MIXPANEL_TOKEN = process.env.REACT_APP_MIXPANEL_TOKEN;
  
  if (MIXPANEL_TOKEN) {
    Analytics.init(MIXPANEL_TOKEN, {
      debug: process.env.NODE_ENV === 'development',
      persistence: 'localStorage',
      secure_cookie: true,
      api_host: 'https://api.mixpanel.com'
    });

    // Set default properties
    Analytics.register({
      environment: process.env.NODE_ENV,
      version: process.env.REACT_APP_VERSION,
      platform: 'web'
    });
  }
};

/**
 * Validate browser version compatibility
 */
const validateBrowserSupport = (): void => {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (
    (userAgent.includes('chrome') && parseInt(userAgent.split('chrome/')[1]) < MIN_BROWSER_VERSIONS.chrome) ||
    (userAgent.includes('firefox') && parseInt(userAgent.split('firefox/')[1]) < MIN_BROWSER_VERSIONS.firefox) ||
    (userAgent.includes('safari') && parseInt(userAgent.split('version/')[1]) < MIN_BROWSER_VERSIONS.safari) ||
    (userAgent.includes('edge') && parseInt(userAgent.split('edge/')[1]) < MIN_BROWSER_VERSIONS.edge)
  ) {
    console.warn('Browser version not supported. Please upgrade to a newer version.');
  }
};

/**
 * Initialize and render the React application
 */
const renderApp = (): void => {
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    throw new Error('Root element not found. Please check your HTML file.');
  }

  // Initialize analytics before rendering
  initializeAnalytics();

  // Validate browser support
  validateBrowserSupport();

  // Create React root and render application
  const root = ReactDOM.createRoot(rootElement);
  
  root.render(
    <React.StrictMode>
      <ErrorBoundary
        fallback={
          <div role="alert">
            <h2>Application Error</h2>
            <p>Something went wrong. Please refresh the page or contact support if the problem persists.</p>
          </div>
        }
        onError={(error) => {
          console.error('Application Error:', error);
          Analytics.track('Error', {
            type: 'fatal',
            message: error.message,
            stack: error.stack
          });
        }}
      >
        <Provider store={store}>
          <GlobalStyles />
          <App />
        </Provider>
      </ErrorBoundary>
    </React.StrictMode>
  );

  // Set up performance monitoring
  if (process.env.NODE_ENV === 'production') {
    try {
      const { performance, PerformanceObserver } = window;
      
      const perfObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          Analytics.track('Performance', {
            metric: entry.name,
            value: entry.startTime,
            duration: entry.duration
          });
        });
      });

      perfObserver.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
      
      // Report Core Web Vitals
      performance.mark('app-start');
    } catch (error) {
      console.warn('Performance monitoring not supported:', error);
    }
  }
};

// Initialize application
renderApp();

// Enable hot module replacement in development
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept('./App', () => {
    renderApp();
  });
}