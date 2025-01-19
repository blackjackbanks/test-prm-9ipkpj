import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'; // v18.0.0
import styled from 'styled-components'; // v6.0.0
import { AnimatePresence, motion, useAnimation } from 'framer-motion'; // ^6.0.0
import Fuse from 'fuse.js'; // ^6.6.2
import { useCommandBar } from '../../hooks/useCommandBar';
import Input from '../common/Input';

// Styled components with MacOS-inspired design
const CommandBarOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const CommandBarContainer = styled(motion.div)`
  width: 600px;
  background: var(--color-surface);
  border-radius: 12px;
  box-shadow: var(--shadow-modal);
  overflow: hidden;
  position: relative;
`;

const CommandList = styled.ul`
  max-height: 400px;
  overflow-y: auto;
  scroll-behavior: smooth;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
  padding: 0;
  margin: 0;
  list-style: none;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: var(--color-border);
    border-radius: 3px;
  }
`;

const CommandItem = styled(motion.li)<{ isSelected: boolean }>`
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${props => props.isSelected ? 'var(--color-primary)' : 'transparent'};
  color: ${props => props.isSelected ? 'var(--color-surface)' : 'var(--color-text)'};

  &:hover {
    background: ${props => !props.isSelected && 'var(--color-surface-alt)'};
  }
`;

const Shortcut = styled.span`
  font-family: ${props => props.theme.typography.fontFamily.monospace};
  font-size: 12px;
  opacity: 0.7;
  display: flex;
  gap: 4px;
`;

const ShortcutKey = styled.kbd`
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border);
`;

// Animation variants
const overlayAnimation = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 }
};

const containerAnimation = {
  hidden: { opacity: 0, y: -20, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1 }
};

const itemAnimation = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 }
};

// Component interfaces
interface CommandBarProps {
  className?: string;
  theme?: 'light' | 'dark';
}

interface CommandItemProps {
  command: {
    id: string;
    title: string;
    shortcut: string;
    action: () => void;
    disabled?: boolean;
  };
  isSelected: boolean;
  onSelect: (command: any) => void;
  isLoading?: boolean;
  highlightedTerms?: string[];
}

// Command item component
const CommandItemComponent: React.FC<CommandItemProps> = ({
  command,
  isSelected,
  onSelect,
  isLoading,
  highlightedTerms = []
}) => {
  const controls = useAnimation();

  useEffect(() => {
    if (isSelected) {
      controls.start({ scale: 1.02 });
    } else {
      controls.start({ scale: 1 });
    }
  }, [isSelected, controls]);

  const formatShortcut = (shortcut: string) => {
    return shortcut.split('+').map((key, index) => (
      <ShortcutKey key={index}>{key}</ShortcutKey>
    ));
  };

  const highlightText = (text: string) => {
    if (!highlightedTerms.length) return text;
    
    let highlighted = text;
    highlightedTerms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark>$1</mark>');
    });
    
    return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
  };

  return (
    <CommandItem
      isSelected={isSelected}
      onClick={() => onSelect(command)}
      animate={controls}
      variants={itemAnimation}
      initial="hidden"
      animate="visible"
      exit="hidden"
      role="option"
      aria-selected={isSelected}
      aria-disabled={command.disabled}
    >
      <span>{highlightText(command.title)}</span>
      <Shortcut>{formatShortcut(command.shortcut)}</Shortcut>
    </CommandItem>
  );
};

// Main CommandBar component
export const CommandBar: React.FC<CommandBarProps> = ({ className, theme }) => {
  const {
    isOpen,
    searchQuery,
    filteredCommands,
    selectedIndex,
    commandListRef,
    searchInputRef,
    executeCommand,
    updateSearch
  } = useCommandBar();

  const [highlightedTerms, setHighlightedTerms] = useState<string[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Initialize fuzzy search
  const fuse = useMemo(() => new Fuse(filteredCommands, {
    keys: ['title', 'keywords'],
    threshold: 0.3,
    ignoreLocation: true
  }), [filteredCommands]);

  // Handle search input changes
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    updateSearch(query);
    
    if (query) {
      const results = fuse.search(query);
      setHighlightedTerms(query.split(' ').filter(term => term.length > 1));
      // Update filtered commands through hook
    } else {
      setHighlightedTerms([]);
    }
  }, [fuse, updateSearch]);

  // Handle overlay click to close
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      executeCommand({ id: 'close', action: () => {} });
    }
  }, [executeCommand]);

  // Focus management
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchInputRef]);

  return (
    <AnimatePresence>
      {isOpen && (
        <CommandBarOverlay
          ref={overlayRef}
          variants={overlayAnimation}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onClick={handleOverlayClick}
          data-theme={theme}
          role="dialog"
          aria-label="Command palette"
        >
          <CommandBarContainer
            variants={containerAnimation}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <Input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search commands..."
              aria-label="Search commands"
              aria-controls="command-list"
              aria-expanded={isOpen}
            />
            <CommandList
              ref={commandListRef}
              id="command-list"
              role="listbox"
              aria-label="Commands"
            >
              {filteredCommands.map((command, index) => (
                <CommandItemComponent
                  key={command.id}
                  command={command}
                  isSelected={index === selectedIndex}
                  onSelect={executeCommand}
                  highlightedTerms={highlightedTerms}
                />
              ))}
            </CommandList>
          </CommandBarContainer>
        </CommandBarOverlay>
      )}
    </AnimatePresence>
  );
};

export default CommandBar;