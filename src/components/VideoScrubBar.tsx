import { memo, useCallback, useRef } from 'react';

interface VideoScrubBarProps {
  /** Nuvarande position i sekunder. */
  current: number;
  /** Videons längd i sekunder. */
  duration: number;
  /** Anropas när användaren drar eller trycker i baren. */
  onSeek: (seconds: number) => void;
  className?: string;
}

const format = (s: number) => {
  const safe = Number.isFinite(s) && s > 0 ? Math.round(s) : 0;
  const m = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

/**
 * Fristående uppspelningslist som ligger UNDER videon (inte ovanpå), med
 * dragbart handtag och sekundvisare. Delas av alla videoytor så känslan blir
 * identisk oavsett var videon visas.
 */
export const VideoScrubBar = memo(function VideoScrubBar({
  current,
  duration,
  onSeek,
  className = '',
}: VideoScrubBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || !duration) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onSeek(ratio * duration);
    },
    [duration, onSeek],
  );

  const pct = duration > 0 ? Math.max(0, Math.min(100, (current / duration) * 100)) : 0;

  if (!duration) return null;

  return (
    <div
      className={`w-full select-none ${className}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        ref={trackRef}
        role="slider"
        aria-label="Sök i videon"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(current)}
        tabIndex={0}
        className="relative flex h-6 w-full cursor-pointer touch-none items-center"
        onPointerDown={(e) => {
          e.stopPropagation();
          draggingRef.current = true;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // äldre webbläsare saknar pointer capture
          }
          seekFromClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (!draggingRef.current) return;
          e.stopPropagation();
          seekFromClientX(e.clientX);
        }}
        onPointerUp={(e) => {
          draggingRef.current = false;
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            // ignorera
          }
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            onSeek(Math.max(0, current - 1));
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            onSeek(Math.min(duration, current + 1));
          }
        }}
      >
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
        </div>
        <div
          className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] font-medium tabular-nums leading-none text-white">
        <span>{format(Math.min(current, duration))}</span>
        <span>{format(duration)}</span>
      </div>
    </div>
  );
});

export default VideoScrubBar;
