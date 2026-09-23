import { useCallback, useEffect, useRef, useState, KeyboardEvent as ReactKeyboardEvent } from 'react';

/**
 * Reusable keyboard navigation for custom dropdown/combobox lists.
 * - ArrowDown / ArrowUp: move highlight (wraps)
 * - Home / End: jump to first/last
 * - Enter: select highlighted item
 * - Escape: close dropdown
 * - When closed and ArrowDown/Enter pressed on the trigger, opens the dropdown
 *
 * Attach `handleKeyDown` to the trigger Input, `listRef` to the list container,
 * and render each item with `data-index={i}` plus a highlight class when
 * `i === highlightedIndex`.
 */
export function useDropdownKeyboardNav<T>(params: {
  items: T[];
  isOpen: boolean;
  onSelect: (item: T, index: number) => void;
  onOpen?: () => void;
  onClose?: () => void;
}) {
  const { items, isOpen, onSelect, onOpen, onClose } = params;
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Do not pre-highlight the first row when a dropdown opens. Touch browsers
  // otherwise make it look hovered before the user has interacted with it.
  useEffect(() => {
    if (!isOpen) {
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  // Clamp highlight if items list shrinks
  useEffect(() => {
    if (highlightedIndex >= items.length) {
      setHighlightedIndex(items.length > 0 ? items.length - 1 : -1);
    }
  }, [items.length, highlightedIndex]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-index="${highlightedIndex}"]`);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      // Open dropdown from a closed state
      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          if (onOpen) {
            e.preventDefault();
            // Keyboard users still get the expected initial highlight.
            setHighlightedIndex(items.length > 0 ? 0 : -1);
            onOpen();
          }
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((i) => (items.length === 0 ? -1 : (i + 1) % items.length));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((i) =>
            items.length === 0 ? -1 : (i - 1 + items.length) % items.length
          );
          break;
        case 'Home':
          if (items.length) {
            e.preventDefault();
            setHighlightedIndex(0);
          }
          break;
        case 'End':
          if (items.length) {
            e.preventDefault();
            setHighlightedIndex(items.length - 1);
          }
          break;
        case 'Enter':
          if (highlightedIndex >= 0 && highlightedIndex < items.length) {
            e.preventDefault();
            onSelect(items[highlightedIndex], highlightedIndex);
          }
          break;
        case 'Escape':
          if (onClose) {
            e.preventDefault();
            onClose();
          }
          break;
        case 'Tab':
          // Let focus move naturally, but close the panel
          onClose?.();
          break;
      }
    },
    [isOpen, items, highlightedIndex, onOpen, onClose, onSelect]
  );

  // Pointer-driven highlight (onMouseEnter) is ignored on touch-only devices:
  // taps fire synthetic mouseenter events that would leave a row looking
  // hovered. Keyboard navigation above uses the raw setter and is unaffected.
  const setPointerHighlightedIndex = useCallback((index: number) => {
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      !window.matchMedia('(hover: hover) and (pointer: fine)').matches
    ) {
      return;
    }
    setHighlightedIndex(index);
  }, []);

  return { highlightedIndex, setHighlightedIndex: setPointerHighlightedIndex, listRef, handleKeyDown };
}
