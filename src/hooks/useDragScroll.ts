import { useRef, useCallback, useEffect } from 'react';

/**
 * Enables click-and-drag horizontal scrolling on a container (desktop).
 * Returns a ref to attach to the scrollable element.
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const state = useRef({ isDown: false, startX: 0, scrollLeft: 0 });

  const onMouseDown = useCallback((e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    // Don't hijack clicks on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, [role="button"], [draggable="true"]')) return;
    state.current = { isDown: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft };
    el.style.cursor = 'grabbing';
    el.style.userSelect = 'none';
  }, []);

  const onMouseUp = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    state.current.isDown = false;
    el.style.cursor = 'grab';
    el.style.userSelect = '';
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!state.current.isDown) return;
    const el = ref.current;
    if (!el) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - state.current.startX) * 1.5;
    el.scrollLeft = state.current.scrollLeft - walk;
  }, []);

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    state.current.isDown = false;
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
