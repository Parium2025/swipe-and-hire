import { useRef, useCallback, useEffect } from 'react';

/**
 * Enables click-and-drag horizontal scrolling on a container (desktop).
 * Uses a movement threshold so clicks on child elements still work.
 * Returns a ref to attach to the scrollable element.
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const state = useRef({ isDown: false, isDragging: false, startX: 0, scrollLeft: 0 });
  const DRAG_THRESHOLD = 5;

  const onMouseDown = useCallback((e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    // Don't hijack clicks on truly interactive elements (buttons, inputs, etc.)
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, [role="button"], [draggable="true"], [data-no-drag-scroll]')) return;
    state.current = { isDown: true, isDragging: false, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft };
    el.style.userSelect = 'none';
  }, []);

  const onMouseUp = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    state.current.isDown = false;
    state.current.isDragging = false;
    el.style.cursor = 'grab';
    el.style.userSelect = '';
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!state.current.isDown) return;
    const el = ref.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    const delta = Math.abs(x - state.current.startX);

    if (!state.current.isDragging) {
      if (delta < DRAG_THRESHOLD) return;
      state.current.isDragging = true;
      el.style.cursor = 'grabbing';
    }

    e.preventDefault();
    const walk = (x - state.current.startX) * 1.5;
    el.scrollLeft = state.current.scrollLeft - walk;
  }, []);

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    state.current.isDown = false;
    state.current.isDragging = false;
    el.style.cursor = 'grab';
    el.style.userSelect = '';
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.cursor = 'grab';
    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('mouseup', onMouseUp);
    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mouseleave', onMouseLeave);
    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [onMouseDown, onMouseUp, onMouseMove, onMouseLeave]);

  return ref;
}
