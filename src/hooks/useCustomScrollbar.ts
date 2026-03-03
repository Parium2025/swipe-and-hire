import { useCallback, useEffect, useRef } from 'react';

/**
 * Custom mini-scrollbar indicator for elements with overflow.
 * Returns refs to attach to the scroll container, track, and thumb elements.
 */
export function useCustomScrollbar(enabled: boolean) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const update = useCallback(() => {
    const el = scrollRef.current;
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!el || !track || !thumb) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const hasScroll = scrollHeight > clientHeight + 5;
    track.style.display = hasScroll ? '' : 'none';
    if (!hasScroll) return;
    const thumbH = Math.max((clientHeight / scrollHeight) * 100, 20);
    const maxScroll = scrollHeight - clientHeight;
    const thumbTop = maxScroll > 0 ? (scrollTop / maxScroll) * (100 - thumbH) : 0;
    thumb.style.transition = 'top 0.15s ease-out, height 0.15s ease-out';
    thumb.style.top = `${thumbTop}%`;
    thumb.style.height = `${thumbH}%`;
  }, []);

  // Attach scroll listener
  useEffect(() => {
    if (!enabled) return;
    let attempts = 0;
    let scrollHandler: (() => void) | null = null;
    let attachedEl: HTMLElement | null = null;

    const tryAttach = () => {
      const el = scrollRef.current;
      if (!el) {
        if (attempts++ < 20) setTimeout(tryAttach, 50);
        return;
      }
      attachedEl = el;
      scrollHandler = () => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(update);
      };
      el.addEventListener('scroll', scrollHandler, { passive: true });
      update();
      setTimeout(update, 200);
    };
    tryAttach();

    return () => {
      if (attachedEl && scrollHandler) {
        attachedEl.removeEventListener('scroll', scrollHandler);
      }
      cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, update]);

  return { scrollRef, trackRef, thumbRef, update };
}
