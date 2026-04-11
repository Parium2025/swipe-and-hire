import { memo, useRef, useState, useCallback, useEffect, useMemo } from 'react';

interface SwipeDotsProps {
  count: number;
  currentIndex: number;
  isEndStateActive: boolean;
  onScrubTo?: (index: number) => void;
}

const MAX_VISIBLE = 9;
const EDGE_FADE = 2;
const LONG_PRESS_MS = 160;
const DRAG_ACTIVATION_PX = 8;
const GESTURE_CANCEL_PX = 30;
const SCRUB_STEP_PX = 32;

const formatCounterValue = (value: number) => new Intl.NumberFormat('sv-SE').format(value);

export const SwipeDots = memo(function SwipeDots({
  count,
  currentIndex,
  isEndStateActive,
  onScrubTo,
}: SwipeDotsProps) {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubIndex, setScrubIndex] = useState(currentIndex);
  const isScrubbingRef = useRef(false);
  const scrubIndexRef = useRef(currentIndex);
  const scrubStartIndexRef = useRef(currentIndex);
  const scrubStartYRef = useRef<number | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  // Stable refs for window-level listeners
  const countRef = useRef(count);
  const onScrubToRef = useRef(onScrubTo);
  countRef.current = count;
  onScrubToRef.current = onScrubTo;

  useEffect(() => {
    if (!isScrubbingRef.current) {
      setScrubIndex(currentIndex);
      scrubIndexRef.current = currentIndex;
      scrubStartIndexRef.current = currentIndex;
    }
  }, [currentIndex]);

  const useWindow = count > MAX_VISIBLE;
  let windowStart = 0;
  let windowEnd = count;

  if (useWindow) {
    const half = Math.floor(MAX_VISIBLE / 2);
    windowStart = Math.max(0, currentIndex - half);
    windowEnd = windowStart + MAX_VISIBLE;
    if (windowEnd > count) {
      windowEnd = count;
      windowStart = Math.max(0, windowEnd - MAX_VISIBLE);
    }
  }

  const visibleCount = windowEnd - windowStart;

  const getDotScale = (windowIdx: number): number => {
    if (!useWindow) return 1;
    const distFromStart = windowIdx;
    const distFromEnd = visibleCount - 1 - windowIdx;
    const distFromEdge = Math.min(distFromStart, distFromEnd);
    if (distFromEdge >= EDGE_FADE) return 1;
    return 0.4 + (distFromEdge / EDGE_FADE) * 0.6;
  };

  // Window-level move handler — survives DOM changes
  const windowTouchMove = useCallback((e: TouchEvent) => {
    if (!isScrubbingRef.current || scrubStartYRef.current === null) return;

    e.preventDefault();

    const touch = e.touches[0];
    const deltaY = touch.clientY - scrubStartYRef.current;
    const c = countRef.current;
    const nextIndex = Math.min(
      c - 1,
      Math.max(0, scrubStartIndexRef.current + Math.round(deltaY / SCRUB_STEP_PX)),
    );

    if (nextIndex !== scrubIndexRef.current) {
      scrubIndexRef.current = nextIndex;
      setScrubIndex(nextIndex);
      onScrubToRef.current?.(nextIndex);
      if (navigator.vibrate) navigator.vibrate(5);
    }
  }, []);

  const windowTouchEnd = useCallback(() => {
    // Full cleanup
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
    scrubStartYRef.current = null;
    isScrubbingRef.current = false;
    setIsScrubbing(false);

    window.removeEventListener('touchmove', windowTouchMove, true);
    window.removeEventListener('touchend', windowTouchEnd, true);
    window.removeEventListener('touchcancel', windowTouchEnd, true);
  }, [windowTouchMove]);

  const startScrub = useCallback((clientY: number) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    setIsScrubbing(true);
    isScrubbingRef.current = true;
    scrubStartYRef.current = clientY;
    scrubStartIndexRef.current = scrubIndexRef.current;

    // Attach window-level listeners so DOM changes don't break the gesture
    window.addEventListener('touchmove', windowTouchMove, { capture: true, passive: false });
    window.addEventListener('touchend', windowTouchEnd, { capture: true });
    window.addEventListener('touchcancel', windowTouchEnd, { capture: true });

    if (navigator.vibrate) navigator.vibrate(12);
  }, [windowTouchMove, windowTouchEnd]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (count <= 1) return;

      // Hard reset all state so every touch is treated as a fresh gesture
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      // Clean up any stale window listeners from a previous gesture
      window.removeEventListener('touchmove', windowTouchMove, true);
      window.removeEventListener('touchend', windowTouchEnd, true);
      window.removeEventListener('touchcancel', windowTouchEnd, true);

      isScrubbingRef.current = false;
      setIsScrubbing(false);
      scrubStartYRef.current = null;

      const touch = e.touches[0];
      const startX = touch.clientX;
      const startY = touch.clientY;
      touchStartPosRef.current = { x: startX, y: startY };

      longPressTimerRef.current = setTimeout(() => {
        startScrub(startY);
      }, LONG_PRESS_MS);
    },
    [count, startScrub, windowTouchMove, windowTouchEnd],
  );

  // React-level touchMove only used to detect initial drag before scrubbing activates
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (isScrubbingRef.current) return; // window listeners handle it

      const touch = e.touches[0];
      if (touchStartPosRef.current) {
        const dx = touch.clientX - touchStartPosRef.current.x;
        const dy = touch.clientY - touchStartPosRef.current.y;

        if (Math.abs(dy) >= DRAG_ACTIVATION_PX && Math.abs(dy) > Math.abs(dx)) {
          startScrub(touchStartPosRef.current.y);
        } else if (longPressTimerRef.current && Math.abs(dx) > GESTURE_CANCEL_PX) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }
    },
    [startScrub],
  );

  const handleTouchEnd = useCallback(() => {
    // If scrubbing is active, window listener handles cleanup
    if (isScrubbingRef.current) return;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      window.removeEventListener('touchmove', windowTouchMove, true);
      window.removeEventListener('touchend', windowTouchEnd, true);
      window.removeEventListener('touchcancel', windowTouchEnd, true);
    };
  }, [windowTouchMove, windowTouchEnd]);

  const badgeText = useMemo(() => {
    const currentLabel = formatCounterValue(scrubIndex + 1);
    const totalLabel = formatCounterValue(count);

    return {
      currentLabel,
      totalLabel,
      minWidth: `${Math.max(totalLabel.length * 2 + 5, 9)}ch`,
    };
  }, [count, scrubIndex]);

  if (count <= 1) return null;

  const activeIdx = isScrubbing ? scrubIndex : currentIndex;

  return (
    <div
      className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center select-none touch-none transition-all duration-200 ${
        isScrubbing
          ? 'w-12 py-4 px-3 gap-0 bg-black/40 backdrop-blur-md rounded-l-2xl'
          : 'py-0 gap-1'
      }`}
      style={!isScrubbing ? { width: 56, paddingLeft: 24, paddingRight: 12 } : undefined}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {isScrubbing && (
        <div
          className="absolute right-14 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-[hsl(215,60%,35%)]/90 px-4 py-2.5 text-center text-sm font-bold leading-none text-white shadow-lg shadow-black/30 backdrop-blur-md whitespace-nowrap pointer-events-none tabular-nums inline-flex min-h-[2.5rem] items-center justify-center"
          style={{ minWidth: badgeText.minWidth }}
        >
          {badgeText.currentLabel} / {badgeText.totalLabel}
        </div>
      )}

      {isScrubbing ? (
        <div className="relative w-full flex-1 min-h-0" style={{ height: '60dvh' }}>
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 bg-white/20 rounded-full" />
          <div
            className="absolute left-1/2 -translate-x-1/2 top-0 w-0.5 bg-white/70 rounded-full transition-all duration-75"
            style={{ height: `${(scrubIndex / Math.max(1, count - 1)) * 100}%` }}
          />
          <div
            className="absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow-lg shadow-white/30 transition-all duration-75"
            style={{
              top: `${(scrubIndex / Math.max(1, count - 1)) * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
          {Array.from({ length: Math.min(20, count) }).map((_, i) => {
            const position = count <= 20 ? i : Math.round((i / 19) * (count - 1));
            const topPercent = (position / Math.max(1, count - 1)) * 100;
            return (
              <div
                key={i}
                className="absolute left-1/2 -translate-x-1/2 w-1.5 h-0.5 bg-white/30 rounded-full"
                style={{ top: `${topPercent}%` }}
              />
            );
          })}
        </div>
      ) : (
        <>
          {useWindow && windowStart > 0 && <div className="w-1 h-1 rounded-full bg-white/15" />}
          {Array.from({ length: visibleCount }).map((_, windowIdx) => {
            const realIdx = windowStart + windowIdx;
            const isActive = realIdx === activeIdx && !isEndStateActive;
            const scale = getDotScale(windowIdx);
            return (
              <div
                key={realIdx}
                className={`rounded-full transition-all duration-300 ${isActive ? 'bg-white' : 'bg-white/30'}`}
                style={{
                  width: isActive ? 8 * scale : 6 * scale,
                  height: isActive ? 8 * scale : 6 * scale,
                }}
              />
            );
          })}
          {useWindow && windowEnd < count && <div className="w-1 h-1 rounded-full bg-white/15" />}
        </>
      )}
    </div>
  );
});
