import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components'; // v6.0.0
import { VirtualList } from 'react-virtual'; // v2.10.4
import { Container, Input } from '../../styles/components';
import { Theme } from '../../styles/theme';
import { fadeIn, ANIMATION_DURATION, ANIMATION_EASING } from '../../styles/animations';

// Constants
const TRANSITION_DURATION = 150;
const Z_INDEX = {
  dropdown: 100,
};
const VIRTUALIZATION_CONFIG = {
  itemSize: 40,
  overscan: 5,
};

// Types
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string | string[];
  onChange: (value: string | string[], event: React.SyntheticEvent) => void;
  placeholder?: string;
  disabled?: boolean;
  multiple?: boolean;
  error?: string;
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  virtualized?: boolean;
  async?: boolean;
  onSearch?: (query: string) => void;
  maxHeight?: number;
  renderOption?: (option: SelectOption) => React.ReactNode;
  'aria-label'?: string;
  id?: string;
  name?: string;
}

// Styled Components
const SelectContainer = styled(Container)`
  position: relative;
  width: 100%;
`;

const SelectTrigger = styled(Input)<{ isOpen: boolean; hasError?: boolean }>`
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  padding-right: ${props => props.theme.spacing.scale.xl};
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  background-color: ${props => props.theme.colors.surface};
  border-color: ${props => 
    props.hasError ? props.theme.colors.error :
    props.isOpen ? props.theme.colors.primary :
    props.theme.colors.border
  };
  
  &:hover {
    border-color: ${props => !props.disabled && props.theme.colors.primary};
  }
`;

const DropdownContainer = styled.div<{ maxHeight?: number }>`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: ${props => props.maxHeight || 300}px;
  overflow-y: auto;
  background-color: ${props => props.theme.colors.surface};
  border-radius: 6px;
  box-shadow: ${props => props.theme.shadows.dropdown};
  z-index: ${Z_INDEX.dropdown};
  animation: ${fadeIn} ${ANIMATION_DURATION.fast} ${ANIMATION_EASING.smooth};
`;

const Option = styled.div<{ isSelected: boolean; isDisabled: boolean }>`
  padding: ${props => props.theme.spacing.scale.sm} ${props => props.theme.spacing.scale.md};
  cursor: ${props => props.isDisabled ? 'not-allowed' : 'pointer'};
  background-color: ${props => props.isSelected ? props.theme.colors.focus : 'transparent'};
  color: ${props => props.isDisabled ? props.theme.colors.disabled : props.theme.colors.text};
  opacity: ${props => props.isDisabled ? 0.5 : 1};
  transition: background-color ${TRANSITION_DURATION}ms ${ANIMATION_EASING.smooth};

  &:hover {
    background-color: ${props => !props.isDisabled && (props.isSelected ? props.theme.colors.focus : props.theme.colors.surfaceAlt)};
  }
`;

const LoadingIndicator = styled.div`
  position: absolute;
  right: ${props => props.theme.spacing.scale.md};
  top: 50%;
  transform: translateY(-50%);
`;

const ErrorMessage = styled.div`
  color: ${props => props.theme.colors.error};
  font-size: ${props => props.theme.typography.fontSize.small};
  margin-top: ${props => props.theme.spacing.scale.xs};
`;

export const Select: React.FC<SelectProps> = React.memo(({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  multiple = false,
  error,
  size = 'medium',
  loading = false,
  virtualized = false,
  async = false,
  onSearch,
  maxHeight = 300,
  renderOption,
  'aria-label': ariaLabel,
  id,
  name,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = useCallback(() => {
    if (!searchQuery) return options;
    return options.filter(option => 
      option.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [options, searchQuery]);

  const handleKeyboardNavigation = useCallback((event: React.KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        setIsOpen(prev => !prev);
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) setIsOpen(true);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  }, [disabled]);

  const handleOptionSelect = useCallback((option: SelectOption, event: React.MouseEvent) => {
    if (option.disabled) return;

    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      const newValue = currentValues.includes(option.value)
        ? currentValues.filter(v => v !== option.value)
        : [...currentValues, option.value];
      onChange(newValue, event);
    } else {
      onChange(option.value, event);
      setIsOpen(false);
    }
  }, [multiple, value, onChange]);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  useEffect(() => {
    if (async && onSearch) {
      const debounceTimer = setTimeout(() => {
        onSearch(searchQuery);
      }, 300);
      return () => clearTimeout(debounceTimer);
    }
  }, [async, onSearch, searchQuery]);

  const renderOptionContent = (option: SelectOption) => {
    if (renderOption) return renderOption(option);
    return option.label;
  };

  const selectedLabel = useCallback(() => {
    if (multiple && Array.isArray(value)) {
      return value.length 
        ? `${value.length} selected`
        : placeholder;
    }
    const selectedOption = options.find(opt => opt.value === value);
    return selectedOption ? selectedOption.label : placeholder;
  }, [multiple, value, options, placeholder]);

  return (
    <SelectContainer ref={containerRef}>
      <SelectTrigger
        ref={inputRef}
        as="div"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-controls={`${id}-listbox`}
        aria-activedescendant={value ? `${id}-option-${value}` : undefined}
        tabIndex={disabled ? -1 : 0}
        size={size}
        isOpen={isOpen}
        hasError={!!error}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        onKeyDown={handleKeyboardNavigation}
      >
        {selectedLabel()}
        {loading && <LoadingIndicator>Loading...</LoadingIndicator>}
      </SelectTrigger>

      {isOpen && (
        <DropdownContainer
          maxHeight={maxHeight}
          role="listbox"
          id={`${id}-listbox`}
          aria-multiselectable={multiple}
        >
          {virtualized ? (
            <VirtualList
              height={maxHeight}
              itemCount={filteredOptions().length}
              itemSize={VIRTUALIZATION_CONFIG.itemSize}
              overscan={VIRTUALIZATION_CONFIG.overscan}
            >
              {({ index, style }) => {
                const option = filteredOptions()[index];
                const isSelected = multiple
                  ? Array.isArray(value) && value.includes(option.value)
                  : value === option.value;

                return (
                  <Option
                    key={option.value}
                    style={style}
                    isSelected={isSelected}
                    isDisabled={!!option.disabled}
                    role="option"
                    aria-selected={isSelected}
                    id={`${id}-option-${option.value}`}
                    onClick={(e) => handleOptionSelect(option, e)}
                  >
                    {renderOptionContent(option)}
                  </Option>
                );
              }}
            </VirtualList>
          ) : (
            filteredOptions().map(option => {
              const isSelected = multiple
                ? Array.isArray(value) && value.includes(option.value)
                : value === option.value;

              return (
                <Option
                  key={option.value}
                  isSelected={isSelected}
                  isDisabled={!!option.disabled}
                  role="option"
                  aria-selected={isSelected}
                  id={`${id}-option-${option.value}`}
                  onClick={(e) => handleOptionSelect(option, e)}
                >
                  {renderOptionContent(option)}
                </Option>
              );
            })
          )}
        </DropdownContainer>
      )}
      
      {error && <ErrorMessage role="alert">{error}</ErrorMessage>}
    </SelectContainer>
  );
});

Select.displayName = 'Select';

export default Select;