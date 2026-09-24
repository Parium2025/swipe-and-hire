import { useRef, useState, useCallback, useEffect } from 'react';
import { MoveVertical } from 'lucide-react';
import { parseFocusPercent, type FocusValue } from '@/lib/jobImageFocus';

/**
 * Converts legacy focus values ('top'/'center'/'bottom') to a percentage.
 * @deprecated Use `parseFocusPercent` from `@/lib/jobImageFocus` instead.
 */
export function parseFocusPosition(value: FocusValue): number {
  return parseFocusPercent(value);
}

interface JobImagePositionerProps {
  imageUrl: string;
  focusPercent: number;
  onFocusChange: (percent: number) => void;
  context?: 'job card' | 'job view';
}

/**
 * A card-shaped preview where the user can drag the image vertically
 * to set the exact crop position. Stores a 0-100 percentage value.
 */
export function JobImagePositioner({ imageUrl, focusPercent, onFocusChange, context = 'job card' }: JobImagePositionerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const startY = useRef(0);
  const startPercent = useRef(focusPercent);

  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    activePointerIdRef.current = e.pointerId;
    setIsDragging(true);
    startY.current = e.clientY;
    startPercent.current = focusPercent;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [focusPercent]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current || activePointerIdRef.current !== e.pointerId || !containerRef.current) return;
    const containerHeight = containerRef.current.clientHeight;
    // Direktmanipulation: bilden följer fingret/musen. Drar man ned bilden
    // visas mer av dess övre del, alltså ska object-position minska.
    const deltaY = e.clientY - startY.current;
    const deltaPct = (deltaY / containerHeight) * 100;
    onFocusChange(clamp(startPercent.current - deltaPct));
  }, [onFocusChange]);

  const stopDragging = useCallback(() => {
    isDraggingRef.current = false;
    activePointerIdRef.current = null;
    setIsDragging(false);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    stopDragging();
  }, [stopDragging]);

  useEffect(() => {
    const stop = () => stopDragging();
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('blur', stop);
    };
  }, [stopDragging]);

  return (
    <div className="space-y-2">
      <p className="text-white text-xs font-medium">Dra bilden för att välja fokuspunkt.</p>
      {/* Annonsbilden motsvarar Swipe Mode; bilden i annonsen motsvarar 2:1-heron. */}
      <div
        ref={containerRef}
        className={`relative w-full rounded-xl overflow-hidden border-2 transition-colors select-none ${
          isDragging ? 'border-white/60' : 'border-white/20'
        }`}
        style={{
          aspectRatio: context === 'job card' ? '1 / 2' : 'var(--job-media-aspect, 2 / 1)',
          maxHeight: context === 'job card' ? '420px' : undefined,
          marginInline: context === 'job card' ? 'auto' : undefined,
          maxWidth: context === 'job card' ? '210px' : undefined,
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={stopDragging}
        onLostPointerCapture={stopDragging}
      >
        <img
          src={imageUrl}
          alt="Bildpositionering"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ objectPosition: `center ${focusPercent}%` }}
          draggable={false}
        />

        {/* Gradient overlay to match card feel */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Drag indicator */}
        <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity ${
          isDragging ? 'opacity-0' : 'opacity-100'
        }`}>
          <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-full">
            <MoveVertical className="h-3.5 w-3.5" />
            Dra för att justera
          </div>
        </div>

        {/* Focus line indicator */}
        <div
          className="absolute left-0 right-0 h-[2px] bg-white/60 pointer-events-none transition-opacity"
          style={{ top: `${focusPercent}%`, opacity: isDragging ? 1 : 0 }}
        />
      </div>
      <p className="text-white text-[10px] text-center">
        Så här kommer bilden att klippas i verkligheten.
      </p>
    </div>
  );
}
