import { useState, useRef, useCallback, useEffect } from 'react';
import { useTouchCapable } from '@/hooks/useInputCapability';

/**
 * Tap-to-preview logic for dropdown items on touch devices.
 *
 * If an item's text is truncated (scrollWidth > clientWidth):
 *   - First tap → shows a tooltip preview (auto-hides after 2.5s)
 *   - Second tap → selects the item
 *
 * If text is NOT truncated, or device is mouse-only:
 *   - First tap selects immediately.
 */
export function useTapToPreview() {
  const isTouch = useTouchCapable();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  /**
   * Call this instead of onSelect directly.
   * Pass the text DOM element to check truncation.
   */
  const handleTap = useCallback((
    id: string,
    textEl: HTMLElement | null,
    onSelect: () => void
  ) => {
    // Mouse device → select immediately
    if (!isTouch) {
      onSelect();
      return;
    }

    // Check truncation
    const isTruncated = textEl
      ? textEl.scrollWidth > textEl.clientWidth + 1
      : false;

    if (!isTruncated) {
      // Not truncated → select immediately
      setPreviewId(null);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      onSelect();
      return;
    }

    if (previewId === id) {
      // Second tap on same item → select
      setPreviewId(null);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      onSelect();
    } else {
      // First tap → show preview tooltip
      setPreviewId(id);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setPreviewId(null), 1800);
    }
  }, [isTouch, previewId]);

  /** Check if a given item is currently showing its preview tooltip */
  const isPreview = useCallback((id: string) => previewId === id, [previewId]);

  /** Reset preview state (e.g. when dropdown closes) */
  const resetPreview = useCallback(() => {
    setPreviewId(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return { handleTap, isPreview, resetPreview, previewId, isTouch };
}
