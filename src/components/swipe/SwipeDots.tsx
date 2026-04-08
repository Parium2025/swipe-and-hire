import { memo, useRef, useState, useCallback, useEffect } from 'react';

interface SwipeDotsProps {
  count: number;
  currentIndex: number;
  isEndStateActive: boolean;
  onScrubTo?: (index: number) => void;
}

const MAX_VISIBLE = 9;
const EDGE_FADE = 2;
const LONG_PRESS_MS = 500;
/** Max finger movement (px) allowed during long-press before cancelling */
const LONG_PRESS_MOVE_TOLERANCE = 8;
/** Minimum ms between scrub index changes to reduce aggressiveness */
const SCRUB_THROTTLE_MS = 140;

export const SwipeDots = memo(function SwipeDots({
  count,
  currentIndex,
  isEndStateActive,
  onScrubTo,
}: SwipeDotsProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubIndex, setScrubIndex] = useState(currentIndex);
  const isScrubbingRef = useRef(false);
  const scrubIndexRef = useRef(currentIndex);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastScrubTimeRef = useRef(0);

  useEffect(() => {
    if (!isScrubbingRef.current) {
      setScrubIndex(currentIndex);
      scrubIndexRef.current = currentIndex;
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

  const indexFromTouchY = useCallback(
    (clientY: number): number => {
      const track = trackRef.current;
      if (!track) return currentIndex;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      return Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1))));
    },
    [count, currentIndex],
  );

  const startScrub = useCallback(() => {
    setIsScrubbing(true);
    isScrubbingRef.current = true;
    if (navigator.vibrate) navigator.vibrate(15);
  }, []);

  const stopScrub = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
    if (isScrubbingRef.current) {
      setIsScrubbing(false);
      isScrubbingRef.current = false;
    }
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (count <= 1) return;
      const touch = e.touches[0];
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

      longPressTimerRef.current = setTimeout(() => {
        startScrub();
        const idx = indexFromTouchY(touch.clientY);
        setScrubIndex(idx);
        scrubIndexRef.current = idx;
        onScrubTo?.(idx);
      }, LONG_PRESS_MS);
    },
    [count, startScrub, indexFromTouchY, onScrubTo],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];

      // Before scrubbing is active: only cancel long-press if finger moved too far
      if (!isScrubbingRef.current) {
        if (longPressTimerRef.current && touchStartPosRef.current) {
          const dx = touch.clientX - touchStartPosRef.current.x;
          const dy = touch.clientY - touchStartPosRef.current.y;
          if (Math.sqrt(dx * dx + dy * dy) > LONG_PRESS_MOVE_TOLERANCE) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
        }
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      const idx = indexFromTouchY(touch.clientY);
      if (idx !== scrubIndexRef.current && now - lastScrubTimeRef.current >= SCRUB_THROTTLE_MS) {
        lastScrubTimeRef.current = now;
        scrubIndexRef.current = idx;
        setScrubIndex(idx);
        onScrubTo?.(idx);
        if (navigator.vibrate) navigator.vibrate(5);
      }
    },
    [indexFromTouchY, onScrubTo],
  );

  const handleTouchEnd = useCallback(() => {
    stopScrub();
  }, [stopScrub]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  if (count <= 1) return null;

  const activeIdx = isScrubbing ? scrubIndex : currentIndex;

  return (
    <div
      ref={trackRef}
      className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center select-none transition-all duration-200 ${
        isScrubbing
          ? 'w-12 py-4 px-3 gap-0 bg-black/40 backdrop-blur-md rounded-l-2xl touch-none'
          : 'py-0 gap-1'
      }`}
      style={!isScrubbing ? { width: 56, paddingLeft: 24, paddingRight: 12 } : undefined}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {isScrubbing && (
        <div className="absolute right-14 top-1/2 -translate-y-1/2 bg-[hsl(215,60%,35%)]/80 backdrop-blur-md border border-white/20 text-white text-sm font-bold px-4 py-1.5 rounded-xl shadow-lg shadow-black/30 whitespace-nowrap pointer-events-none min-w-[4rem] text-center tabular-nums">
          {scrubIndex + 1} / {count}
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
          {useWindow && windowStart > 0 && (
            <div className="w-1 h-1 rounded-full bg-white/15" />
          )}
          {Array.from({ length: visibleCount }).map((_, windowIdx) => {
            const realIdx = windowStart + windowIdx;
            const isActive = realIdx === activeIdx && !isEndStateActive;
            const scale = getDotScale(windowIdx);
            return (
              <div
                key={realIdx}
                className={`rounded-full transition-all duration-300 ${
                  isActive ? 'bg-white' : 'bg-white/30'
                }`}
                style={{
                  width: isActive ? 8 * scale : 6 * scale,
                  height: isActive ? 8 * scale : 6 * scale,
                }}
              />
            );
          })}
          {useWindow && windowEnd < count && (
            <div className="w-1 h-1 rounded-full bg-white/15" />
          )}
        </>
      )}
    </div>
  );
});
