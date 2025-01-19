import React, { memo, useCallback, useEffect, useRef } from 'react'; // v18.0.0
import styled from 'styled-components'; // v6.0.0
import MetricsWidget from './MetricsWidget';
import ActivityWidget from './ActivityWidget';
import IntegrationsWidget from './IntegrationsWidget';
import TemplatesWidget from './TemplatesWidget';
import useBreakpoint from '../../hooks/useBreakpoint';

// Props interface
interface DashboardGridProps {
  className?: string;
  onError?: (error: Error) => void;
  loadingStrategy: 'eager' | 'lazy';
}

// Styled components with MacOS-inspired design
const GridContainer = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.scale.lg};
  padding: ${({ theme }) => theme.spacing.scale.lg};
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  grid-auto-rows: minmax(200px, auto);
  transition: all 0.2s ease-in-out;
  contain: layout;
  will-change: transform;

  @media (max-width: ${({ theme }) => theme.typography.fontSize.h3}) {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing.scale.md};
  }
`;

const WidgetWrapper = styled.div`
  height: 100%;
  min-height: 200px;
  background: ${({ theme }) => theme.colors.background};
  border-radius: ${({ theme }) => theme.spacing.scale.sm};
  box-shadow: ${({ theme }) => theme.shadows.surface};
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  contain: content;

  &:hover {
    transform: translateY(-2px);
    box-shadow: ${({ theme }) => theme.shadows.modal};
  }

  &:focus-within {
    box-shadow: ${({ theme }) => theme.shadows.popup};
    outline: 2px solid ${({ theme }) => theme.colors.focus};
    outline-offset: 2px;
  }
`;

// Main component
const DashboardGrid: React.FC<DashboardGridProps> = memo(({
  className,
  onError,
  loadingStrategy = 'eager'
}) => {
  const breakpoint = useBreakpoint();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Error boundary handler
  const handleWidgetError = useCallback((error: Error) => {
    console.error('Widget error:', error);
    onError?.(error);
  }, [onError]);

  // Intersection observer setup for lazy loading
  useEffect(() => {
    if (loadingStrategy === 'lazy' && typeof IntersectionObserver !== 'undefined') {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const widget = entry.target as HTMLElement;
              widget.dataset.loaded = 'true';
              observerRef.current?.unobserve(widget);
            }
          });
        },
        { rootMargin: '50px' }
      );

      const widgets = gridRef.current?.querySelectorAll('[data-widget]');
      widgets?.forEach(widget => {
        observerRef.current?.observe(widget);
      });

      return () => {
        observerRef.current?.disconnect();
      };
    }
  }, [loadingStrategy]);

  // Keyboard navigation handler
  const handleKeyboardNavigation = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const widgets = Array.from(gridRef.current?.querySelectorAll('[data-widget]') || []);
      const currentIndex = widgets.indexOf(document.activeElement as Element);
      const nextIndex = event.key === 'ArrowDown' ? 
        (currentIndex + 1) % widgets.length : 
        (currentIndex - 1 + widgets.length) % widgets.length;
      (widgets[nextIndex] as HTMLElement)?.focus();
    }
  }, []);

  return (
    <GridContainer
      ref={gridRef}
      className={className}
      role="main"
      aria-label="Dashboard"
      onKeyDown={handleKeyboardNavigation}
    >
      <WidgetWrapper data-widget="metrics">
        <MetricsWidget
          title="Business Metrics"
          refreshInterval={30000}
          metricType="TASKS_COMPLETE"
          onError={handleWidgetError}
        />
      </WidgetWrapper>

      <WidgetWrapper data-widget="activity">
        <ActivityWidget
          maxItems={50}
          refreshInterval={30000}
          onError={handleWidgetError}
          errorRetryCount={3}
        />
      </WidgetWrapper>

      <WidgetWrapper data-widget="integrations">
        <IntegrationsWidget
          elevation={1}
          onRefresh={async () => {
            try {
              // Integration refresh logic would go here
              await Promise.resolve();
            } catch (error) {
              handleWidgetError(error as Error);
            }
          }}
        />
      </WidgetWrapper>

      <WidgetWrapper data-widget="templates">
        <TemplatesWidget
          onTemplateSelect={(template) => {
            // Template selection logic would go here
            console.log('Selected template:', template);
          }}
        />
      </WidgetWrapper>
    </GridContainer>
  );
});

DashboardGrid.displayName = 'DashboardGrid';

export default DashboardGrid;