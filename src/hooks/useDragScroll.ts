import { useRef, useCallback, useEffect } from 'react';
import { getInputCapability } from '@/hooks/useInputCapability';

/**
 * Enables click-and-drag horizontal scrolling on a container.
 * 
 * INPUT-AWARE DESIGN:
 * - Mouse/trackpad users: grab cursor + drag-to-scroll
 * - Touch users: NO mouse listeners attached at all — native momentum scroll handles everything
 * - Hybrid devices: drag-scroll enabled (mouse mode) alongside native touch
 *
 * Uses a movement threshold (DRAG_THRESHOLD) so clicks on child elements still work
 * while still allowing smooth horizontal drag behavior.
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const state = useRef({ isDown: false, isDragging: false, startX: 0, scrollLeft: 0 });
  const DRAG_THRESHOLD = 6;
  const INTERACTIVE_SELECTOR = 'button, a, input, textarea, select, [role="button"], [draggable="true"], [data-dnd-draggable="true"]';

  const onMouseDown = useCallback((e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    if (e.button !== 0) return;

    const rawTarget = e.target;
    const target = rawTarget instanceof Element
      ? rawTarget
      : rawTarget instanceof Node
        ? rawTarget.parentElement
        : null;

    // Don't hijack clicks on truly interactive elements
    if (!target || target.closest(INTERACTIVE_SELECTOR)) return;

    state.current = {
      isDown: true,
      isDragging: false,
      startX: e.clientX - el.getBoundingClientRect().left,
      scrollLeft: el.scrollLeft,
    };
  }, []);

  const onMouseUp = useCallback(() => {
    const el = ref.current;
    if (!el || !state.current.isDown) return;
    state.current.isDown = false;
    state.current.isDragging = false;
    el.style.cursor = 'grab';
    el.style.userSelect = '';
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!state.current.isDown) return;
    const el = ref.current;
    if (!el) return;
    const x = e.clientX - el.getBoundingClientRect().left;
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

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Only attach mouse-based drag scroll for non-touch devices
    const input = getInputCapability();
    if (input === 'touch') return; // Pure touch → native momentum scroll only

    el.style.cursor = 'grab';
    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove, { passive: false });
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('blur', onMouseUp);

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', onMouseUp);
    };
  }, [onMouseDown, onMouseUp, onMouseMove]);

  return ref;
}
