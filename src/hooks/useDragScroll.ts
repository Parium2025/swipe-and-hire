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

    // Don't hijack clicks on truly interactive elements
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

    // Only attach mouse-based drag scroll for non-touch devices
    const input = getInputCapability();
    if (input === 'touch') return; // Pure touch → native momentum scroll only

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
