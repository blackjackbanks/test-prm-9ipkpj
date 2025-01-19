import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { Outlet, useLocation } from 'react-router-dom';
import ResizeObserver from 'resize-observer-polyfill'; // v1.5.1

import Header from './Header';
import Sidebar from './Sidebar';
import ChatInterface from './ChatInterface';
import CommandBar from './CommandBar';
import useBreakpoint from '../../hooks/useBreakpoint';
import ErrorBoundary from '../common/ErrorBoundary';

// Styled components with MacOS-inspired design
const LayoutContainer = styled.div`
  display: flex;
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.background};
  transition: background-color 0.3s ease;
  position: relative;
  overflow: hidden;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const MainContent = styled.main<{ sidebarCollapsed: boolean }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  position: relative;
  margin-left: ${({ sidebarCollapsed }) => sidebarCollapsed ? '64px' : '240px'};
  transition: margin-left 0.3s ease;

  @media (max-width: 768px) {
    margin-left: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const ContentWrapper = styled.div`
  flex: 1;
  padding: ${({ theme }) => theme.spacing.scale.lg};
  position: relative;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;

  @media (max-width: 768px) {
    padding: ${({ theme }) => theme.spacing.scale.md};
  }
`;

// Props interface
interface AppLayoutProps {
  className?: string;
  initialSidebarState?: boolean;
  onLayoutChange?: (state: LayoutState) => void;
}

// Layout state interface
interface LayoutState {
  sidebarCollapsed: boolean;
  chatMinimized: boolean;
  breakpoint: string;
}

const AppLayout: React.FC<AppLayoutProps> = ({
  className,
  initialSidebarState = false,
  onLayoutChange
}) => {
  // Get current breakpoint for responsive design
  const breakpoint = useBreakpoint();
  const location = useLocation();
  
  // State management
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    initialSidebarState || breakpoint === 'mobile'
  );
  const [chatMinimized, setChatMinimized] = useState(true);
  
  // Refs for performance optimization
  const contentRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);

  // Handle sidebar toggle
  const handleSidebarToggle = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  // Handle chat minimize/maximize
  const handleChatToggle = useCallback(() => {
    setChatMinimized(prev => !prev);
  }, []);

  // Setup resize observer for responsive adjustments
  useEffect(() => {
    if (contentRef.current) {
      resizeObserver.current = new ResizeObserver(() => {
        // Trigger layout adjustments if needed
        if (breakpoint === 'mobile' && !sidebarCollapsed) {
          setSidebarCollapsed(true);
        }
      });

      resizeObserver.current.observe(contentRef.current);
    }

    return () => {
      resizeObserver.current?.disconnect();
    };
  }, [breakpoint, sidebarCollapsed]);

  // Notify parent of layout changes
  useEffect(() => {
    onLayoutChange?.({
      sidebarCollapsed,
      chatMinimized,
      breakpoint
    });
  }, [sidebarCollapsed, chatMinimized, breakpoint, onLayoutChange]);

  // Reset layout on route change for mobile
  useEffect(() => {
    if (breakpoint === 'mobile') {
      setSidebarCollapsed(true);
    }
  }, [location.pathname, breakpoint]);

  return (
    <ErrorBoundary
      fallback={
        <div role="alert">
          <h2>Error Loading Layout</h2>
          <p>Please refresh the page to try again.</p>
        </div>
      }
    >
      <LayoutContainer className={className}>
        <Sidebar
          isCollapsed={sidebarCollapsed}
          onToggle={handleSidebarToggle}
          ref={sidebarRef}
        />

        <MainContent 
          sidebarCollapsed={sidebarCollapsed}
          ref={contentRef}
          role="main"
          aria-label="Main content"
        >
          <Header
            onThemeToggle={() => {}} // Theme toggle handled by ThemeProvider
            securityStatus="secure"
          />

          <ContentWrapper>
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </ContentWrapper>

          <ChatInterface
            position={chatMinimized ? 'minimized' : 'expanded'}
            onMinimize={handleChatToggle}
          />
        </MainContent>

        <CommandBar
          shortcuts={{
            toggleSidebar: 'cmd+b',
            toggleChat: 'cmd+j',
            search: 'cmd+k'
          }}
          onCommand={(command) => {
            switch (command) {
              case 'toggleSidebar':
                handleSidebarToggle();
                break;
              case 'toggleChat':
                handleChatToggle();
                break;
            }
          }}
        />
      </LayoutContainer>
    </ErrorBoundary>
  );
};

export default AppLayout;