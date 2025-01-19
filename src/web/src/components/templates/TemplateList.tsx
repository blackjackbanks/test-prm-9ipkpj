import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux'; // v8.0.0
import { useDebounce } from 'use-debounce'; // v9.0.0
import { useVirtualizer } from '@tanstack/react-virtual'; // v2.10.4
import styled from 'styled-components'; // v6.0.0

import TemplateCard from './TemplateCard';
import Input from '../common/Input';
import Select from '../common/Select';
import { Template, TemplateCategory } from '../../types/template';
import { selectTemplates, selectTemplateLoading, fetchTemplates } from '../../store/slices/templateSlice';
import { fadeIn, ANIMATION_DURATION } from '../../styles/animations';

// Constants
const DEBOUNCE_DELAY = 300;
const GRID_GAP = 24;
const TEMPLATE_CARD_HEIGHT = 280;
const SCROLL_THRESHOLD = 0.8;

// Interfaces
interface TemplateListProps {
  className?: string;
  initialCategory?: TemplateCategory;
  initialSearch?: string;
}

// Styled Components
const StyledTemplateList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.scale.lg};
  padding: ${({ theme }) => theme.spacing.scale.md};
  position: relative;
  min-height: 400px;
  animation: ${fadeIn} ${ANIMATION_DURATION.normal} ${({ theme }) => theme.animation.easing.smooth};
`;

const FilterContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.scale.md};
  align-items: center;
  padding: ${({ theme }) => theme.spacing.scale.md};
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.spacing.scale.sm};
  box-shadow: ${({ theme }) => theme.shadows.surface};

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const TemplateGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${GRID_GAP}px;
  width: 100%;
  position: relative;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
  z-index: 10;
`;

const ErrorMessage = styled.div`
  padding: ${({ theme }) => theme.spacing.scale.md};
  background: ${({ theme }) => theme.colors.error}20;
  color: ${({ theme }) => theme.colors.error};
  border-radius: ${({ theme }) => theme.spacing.scale.sm};
  margin: ${({ theme }) => theme.spacing.scale.sm} 0;
`;

const TemplateList: React.FC<TemplateListProps> = ({
  className,
  initialCategory,
  initialSearch = ''
}) => {
  // State
  const [searchText, setSearchText] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | ''>(
    initialCategory || ''
  );
  const [debouncedSearch] = useDebounce(searchText, DEBOUNCE_DELAY);

  // Redux
  const dispatch = useDispatch();
  const templates = useSelector(selectTemplates);
  const isLoading = useSelector(selectTemplateLoading);

  // Virtualization
  const parentRef = React.useRef<HTMLDivElement>(null);
  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      const matchesSearch = template.name
        .toLowerCase()
        .includes(debouncedSearch.toLowerCase()) ||
        template.description.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesCategory = !selectedCategory || template.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [templates, debouncedSearch, selectedCategory]);

  const virtualizer = useVirtualizer({
    count: filteredTemplates.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => TEMPLATE_CARD_HEIGHT,
    overscan: 5
  });

  // Handlers
  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  }, []);

  const handleCategoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategory(e.target.value as TemplateCategory | '');
  }, []);

  // Effects
  useEffect(() => {
    dispatch(fetchTemplates());
  }, [dispatch]);

  // Category options
  const categoryOptions = useMemo(() => [
    { value: '', label: 'All Categories' },
    ...Object.values(TemplateCategory).map(category => ({
      value: category,
      label: category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()
    }))
  ], []);

  return (
    <StyledTemplateList className={className} ref={parentRef}>
      <FilterContainer>
        <Input
          name="template-search"
          value={searchText}
          onChange={handleSearch}
          placeholder="Search templates..."
          aria-label="Search templates"
          type="search"
        />
        <Select
          options={categoryOptions}
          value={selectedCategory}
          onChange={handleCategoryChange}
          placeholder="Select category"
          aria-label="Filter by category"
        />
      </FilterContainer>

      <TemplateGrid
        role="grid"
        aria-busy={isLoading}
        aria-label="Template grid"
      >
        {virtualizer.getVirtualItems().map(virtualRow => {
          const template = filteredTemplates[virtualRow.index];
          return (
            <div
              key={template.id}
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              <TemplateCard
                template={template}
                onPreview={async () => {/* Preview handler */}}
                onUse={async () => {/* Use handler */}}
                testId={`template-card-${template.id}`}
              />
            </div>
          );
        })}
      </TemplateGrid>

      {isLoading && (
        <LoadingOverlay role="status" aria-label="Loading templates">
          Loading...
        </LoadingOverlay>
      )}

      {!isLoading && filteredTemplates.length === 0 && (
        <ErrorMessage role="alert">
          No templates found. Try adjusting your search or filters.
        </ErrorMessage>
      )}
    </StyledTemplateList>
  );
};

export default TemplateList;