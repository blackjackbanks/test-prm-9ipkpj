import { useState, useCallback, useEffect, useRef } from 'react'; // v18.0.0
import { useAppDispatch } from '../store';
import { toggleCommandBar } from '../store/slices/uiSlice';
import fuzzysort from 'fuzzysort'; // v2.0.1

/**
 * Interface for command objects that can be executed via the command bar
 */
interface Command {
  id: string;
  title: string;
  description: string;
  shortcut: string;
  category: string;
  action: () => void;
  disabled: boolean;
  keywords: string[];
}

/**
 * Interface for command bar state management
 */
interface CommandBarState {
  isOpen: boolean;
  searchQuery: string;
  filteredCommands: Command[];
  selectedIndex: number;
  recentCommands: Command[];
}

// Constants for keyboard shortcuts and configuration
const KEYBOARD_SHORTCUTS = {
  TOGGLE: { key: 'k', ctrlKey: true, metaKey: true },
  CLOSE: { key: 'Escape' },
  NAVIGATE_UP: { key: 'ArrowUp' },
  NAVIGATE_DOWN: { key: 'ArrowDown' },
  EXECUTE: { key: 'Enter' }
} as const;

const COMMAND_CATEGORIES = ['Navigation', 'Actions', 'Tools', 'Settings'] as const;
const MAX_RECENT_COMMANDS = 5;

/**
 * Custom hook for managing command bar state and functionality
 * Provides MacOS-inspired command palette features with keyboard shortcuts
 */
export const useCommandBar = () => {
  const dispatch = useAppDispatch();
  const [state, setState] = useState<CommandBarState>({
    isOpen: false,
    searchQuery: '',
    filteredCommands: [],
    selectedIndex: 0,
    recentCommands: []
  });

  // Refs for command list and search input
  const commandListRef = useRef<HTMLUListElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /**
   * Filter commands based on search query using fuzzy search
   */
  const filterCommands = useCallback((query: string, commands: Command[]): Command[] => {
    if (!query) {
      return [...state.recentCommands, ...commands];
    }

    const results = fuzzysort.go(query, commands, {
      keys: ['title', 'description', 'keywords'],
      threshold: -10000
    });

    return results.map(result => result.obj);
  }, [state.recentCommands]);

  /**
   * Handle keyboard navigation and command execution
   */
  const handleKeyboardNavigation = useCallback((event: KeyboardEvent) => {
    const { key, ctrlKey, metaKey } = event;

    // Toggle command bar
    if (key === KEYBOARD_SHORTCUTS.TOGGLE.key && (ctrlKey || metaKey)) {
      event.preventDefault();
      dispatch(toggleCommandBar());
    }

    if (!state.isOpen) return;

    switch (key) {
      case KEYBOARD_SHORTCUTS.CLOSE.key:
        event.preventDefault();
        dispatch(toggleCommandBar());
        break;

      case KEYBOARD_SHORTCUTS.NAVIGATE_UP.key:
        event.preventDefault();
        setState(prev => ({
          ...prev,
          selectedIndex: Math.max(0, prev.selectedIndex - 1)
        }));
        break;

      case KEYBOARD_SHORTCUTS.NAVIGATE_DOWN.key:
        event.preventDefault();
        setState(prev => ({
          ...prev,
          selectedIndex: Math.min(
            prev.filteredCommands.length - 1,
            prev.selectedIndex + 1
          )
        }));
        break;

      case KEYBOARD_SHORTCUTS.EXECUTE.key:
        event.preventDefault();
        const selectedCommand = state.filteredCommands[state.selectedIndex];
        if (selectedCommand && !selectedCommand.disabled) {
          executeCommand(selectedCommand);
        }
        break;
    }
  }, [state.isOpen, state.selectedIndex, state.filteredCommands, dispatch]);

  /**
   * Execute a command and update recent commands list
   */
  const executeCommand = useCallback((command: Command) => {
    if (command.disabled) return;

    command.action();
    
    setState(prev => {
      const updatedRecent = [
        command,
        ...prev.recentCommands.filter(cmd => cmd.id !== command.id)
      ].slice(0, MAX_RECENT_COMMANDS);

      return {
        ...prev,
        recentCommands: updatedRecent,
        isOpen: false,
        searchQuery: '',
        selectedIndex: 0
      };
    });

    dispatch(toggleCommandBar());
  }, [dispatch]);

  /**
   * Update search query and filtered commands
   */
  const updateSearch = useCallback((query: string, commands: Command[]) => {
    setState(prev => ({
      ...prev,
      searchQuery: query,
      filteredCommands: filterCommands(query, commands),
      selectedIndex: 0
    }));
  }, [filterCommands]);

  /**
   * Set up keyboard event listeners
   */
  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardNavigation);
    return () => {
      document.removeEventListener('keydown', handleKeyboardNavigation);
    };
  }, [handleKeyboardNavigation]);

  /**
   * Focus management for accessibility
   */
  useEffect(() => {
    if (state.isOpen) {
      searchInputRef.current?.focus();
    }
  }, [state.isOpen]);

  /**
   * Scroll selected command into view
   */
  useEffect(() => {
    if (state.isOpen && commandListRef.current) {
      const selectedElement = commandListRef.current.children[state.selectedIndex];
      selectedElement?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [state.isOpen, state.selectedIndex]);

  return {
    isOpen: state.isOpen,
    searchQuery: state.searchQuery,
    filteredCommands: state.filteredCommands,
    selectedIndex: state.selectedIndex,
    recentCommands: state.recentCommands,
    commandListRef,
    searchInputRef,
    executeCommand,
    updateSearch,
    handleKeyboardNavigation
  };
};