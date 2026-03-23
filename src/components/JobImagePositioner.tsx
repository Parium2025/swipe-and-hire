import { useRef, useState, useCallback, useEffect } from 'react';
import { Move } from 'lucide-react';

/**
 * Converts legacy focus values ('top'/'center'/'bottom') to a percentage.
 */
export function parseFocusPosition(value: string | undefined | null): number {
  if (!value || value === 'center') return 50;
  if (value === 'top') return 20;
  if (value === 'bottom') return 80;
  const num = parseInt(value, 10);
  return isNaN(num) ? 50 : Math.max(0, Math.min(100, num));
}

interface JobImagePositionerProps {
  imageUrl: string;
  focusPercent: number;
  onFocusChange: (percent: number) => void;
}

/**
 * A card-shaped preview where the user can drag the image vertically
 * to set the exact crop position. Stores a 0-100 percentage value.
 */
export function JobImagePositioner({ imageUrl, focusPercent, onFocusChange }: JobImagePositionerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startPercent = useRef(focusPercent);

  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startY.current = e.clientY;
    startPercent.current = focusPercent;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [focusPercent]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    const containerHeight = containerRef.current.clientHeight;
    // Sensitivity: moving pointer down → image shifts up → higher % (shows lower part)
    const deltaY = e.clientY - startY.current;
    const deltaPct = (deltaY / containerHeight) * 100;
    onFocusChange(clamp(startPercent.current + deltaPct));
  }, [isDragging, onFocusChange]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className="space-y-2">
      <p className="text-white text-xs font-medium">Dra bilden för att välja fokuspunkt</p>
      <div
        ref={containerRef}
        className={`relative w-full rounded-xl overflow-hidden border-2 transition-colors select-none ${
          isDragging ? 'border-white/60' : 'border-white/20'
        }`}
        style={{ aspectRatio: '3 / 4', cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
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
            <Move className="h-3.5 w-3.5" />
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
        Så här kommer bilden att klippas i jobbkorten
      </p>
    </div>
  );
}
