/**
 * Keyboard Navigation Hook
 * Provides accessible keyboard navigation for interactive components
 */

import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardNavigationOptions {
  /** Enable arrow key navigation */
  enableArrowKeys?: boolean;
  /** Enable tab navigation */
  enableTabNavigation?: boolean;
  /** Enable escape key to close/deselect */
  enableEscape?: boolean;
  /** Enable enter/space to select */
  enableSelect?: boolean;
  /** Callback when item is selected */
  onSelect?: (index: number) => void;
  /** Callback when navigation is closed */
  onClose?: () => void;
  /** Total number of items */
  itemCount?: number;
  /** Initially selected index */
  initialIndex?: number;
  /** Loop navigation (wrap around) */
  loop?: boolean;
}

/**
 * Hook for keyboard navigation in lists and menus
 */
export function useKeyboardNavigation(options: KeyboardNavigationOptions = {}) {
  const {
    enableArrowKeys = true,
    enableTabNavigation = true,
    enableEscape = true,
    enableSelect = true,
    onSelect,
    onClose,
    itemCount = 0,
    initialIndex = 0,
    loop = true,
  } = options;

  const currentIndex = useRef(initialIndex);
  const containerRef = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!containerRef.current) return;

      let handled = false;

      // Arrow key navigation
      if (enableArrowKeys) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          handled = true;

          const direction = event.key === 'ArrowDown' ? 1 : -1;
          let newIndex = currentIndex.current + direction;

          if (loop) {
            // Wrap around
            if (newIndex < 0) newIndex = itemCount - 1;
            if (newIndex >= itemCount) newIndex = 0;
          } else {
            // Clamp
            newIndex = Math.max(0, Math.min(itemCount - 1, newIndex));
          }

          currentIndex.current = newIndex;

          // Focus the new element
          const items = containerRef.current.querySelectorAll('[role="option"], [role="menuitem"], [data-keyboard-nav]');
          const targetItem = items[newIndex] as HTMLElement;
          if (targetItem) {
            targetItem.focus();
          }
        }
      }

      // Enter/Space to select
      if (enableSelect && (event.key === 'Enter' || event.key === ' ')) {
        if (document.activeElement?.hasAttribute('data-keyboard-nav') || 
            document.activeElement?.getAttribute('role') === 'option' ||
            document.activeElement?.getAttribute('role') === 'menuitem') {
          event.preventDefault();
          handled = true;
          onSelect?.(currentIndex.current);
        }
      }

      // Escape to close
      if (enableEscape && event.key === 'Escape') {
        event.preventDefault();
        handled = true;
        onClose?.();
      }

      // Tab navigation
      if (enableTabNavigation && event.key === 'Tab') {
        // Let default tab behavior work, but track index
        const items = containerRef.current.querySelectorAll('[role="option"], [role="menuitem"], [data-keyboard-nav]');
        const activeElement = document.activeElement;
        const activeIndex = Array.from(items).indexOf(activeElement as HTMLElement);
        
        if (activeIndex !== -1) {
          currentIndex.current = activeIndex;
        }
      }

      return handled;
    },
    [enableArrowKeys, enableTabNavigation, enableEscape, enableSelect, onSelect, onClose, itemCount, loop]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('keydown', handleKeyDown as any);

    return () => {
      container.removeEventListener('keydown', handleKeyDown as any);
    };
  }, [handleKeyDown]);

  const setContainerRef = useCallback((element: HTMLElement | null) => {
    containerRef.current = element;
  }, []);

  const setCurrentIndex = useCallback((index: number) => {
    currentIndex.current = index;
  }, []);

  return {
    containerRef: setContainerRef,
    currentIndex: currentIndex.current,
    setCurrentIndex,
  };
}

/**
 * Hook for managing focus trap (e.g., in modals)
 */
export function useFocusTrap(isActive: boolean = true) {
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };

    // Focus first element
    firstElement?.focus();

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive]);

  const setContainerRef = useCallback((element: HTMLElement | null) => {
    containerRef.current = element;
  }, []);

  return { containerRef: setContainerRef };
}

/**
 * Hook for keyboard shortcuts
 */
export function useKeyboardShortcuts(shortcuts: Record<string, () => void>) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = [
        event.ctrlKey && 'ctrl',
        event.shiftKey && 'shift',
        event.altKey && 'alt',
        event.metaKey && 'meta',
        event.key.toLowerCase(),
      ]
        .filter(Boolean)
        .join('+');

      const handler = shortcuts[key];
      if (handler) {
        event.preventDefault();
        handler();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts]);
}

/**
 * Hook for skip links (accessibility)
 */
export function useSkipLinks() {
  const skipToContent = useCallback(() => {
    const mainContent = document.querySelector('main');
    if (mainContent) {
      mainContent.focus();
      mainContent.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  return { skipToContent };
}

