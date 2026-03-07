import { useRef, useCallback, useEffect } from 'react';

/**
 * Enables click-and-drag horizontal scrolling on a container (desktop).
 * Uses a movement threshold so clicks on child elements still work.
 * Returns a ref to attach to the scrollable element.
 * 
 * After a drag, click events on children are suppressed for one frame
 * so that e.g. tab-switching doesn't fire after a scroll gesture.
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const state = useRef({ isDown: false, isDragging: false, startX: 0, scrollLeft: 0 });
  const DRAG_THRESHOLD = 12;

  const onMouseDown = useCallback((e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;

    const rawTarget = e.target;
    const target = rawTarget instanceof Element
      ? rawTarget
      : rawTarget instanceof Node
        ? rawTarget.parentElement
        : null;

    // Don't hijack clicks on interactive elements (buttons, links, inputs, etc.)
    if (!target || target.closest('button, a, input, textarea, select, [role="button"], [draggable="true"]')) return;

    state.current = { isDown: true, isDragging: false, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft };
  }, []);

  const onMouseUp = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const wasDragging = state.current.isDragging;
    state.current.isDown = false;
    state.current.isDragging = false;
    el.style.cursor = 'grab';
    el.style.userSelect = '';

    // Suppress the click that follows mouseup after a drag
    if (wasDragging) {
      const suppressClick = (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
      };
      el.addEventListener('click', suppressClick, { capture: true, once: true });
    }
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
      el.style.userSelect = 'none';
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
