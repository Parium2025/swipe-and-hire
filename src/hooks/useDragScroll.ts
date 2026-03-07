import { useRef, useCallback, useEffect } from 'react';

/**
 * Enables click-and-drag horizontal scrolling on a container (desktop).
 * Returns a ref to attach to the scrollable element.
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const state = useRef({
    isPointerDown: false,
    hasDragged: false,
    startX: 0,
    scrollLeft: 0,
  });

  const onMouseDown = useCallback((e: MouseEvent) => {
    const el = ref.current;
    if (!el || e.button !== 0) return;

    // Don't hijack clicks on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, [role="button"], [draggable="true"]')) return;

    state.current = {
      isPointerDown: true,
      hasDragged: false,
      startX: e.pageX - el.offsetLeft,
      scrollLeft: el.scrollLeft,
    };
  }, []);

  const onMouseUp = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    state.current.isPointerDown = false;
    state.current.hasDragged = false;
    el.style.cursor = 'grab';
    el.style.userSelect = '';
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!state.current.isPointerDown) return;

    const el = ref.current;
    if (!el) return;

    const x = e.pageX - el.offsetLeft;
    const delta = x - state.current.startX;

    // Let normal taps/clicks pass through. Start drag only after a tiny threshold.
    if (!state.current.hasDragged && Math.abs(delta) < 6) return;

    if (!state.current.hasDragged) {
      state.current.hasDragged = true;
      el.style.cursor = 'grabbing';
      el.style.userSelect = 'none';
    }

    e.preventDefault();
    el.scrollLeft = state.current.scrollLeft - delta * 1.5;
  }, []);

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    state.current.isPointerDown = false;
    state.current.hasDragged = false;
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
