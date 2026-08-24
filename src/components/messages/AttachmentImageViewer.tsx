import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Minus, RotateCcw, Download } from 'lucide-react';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const dist = (a: Touch, b: Touch) => Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);

interface AttachmentImageViewerProps {
  open: boolean;
  onClose: () => void;
  src: string;
  fileName?: string;
}

/**
 * Fullskärmsvisare för bilagor med pinch-zoom, panorering och dubbeltryck —
 * samma känsla som CV-visaren, men för bilder i chatten.
 */
export function AttachmentImageViewer({ open, onClose, src, fileName }: AttachmentImageViewerProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const g = useRef({
    zoom: 1,
    panX: 0,
    panY: 0,
    pinchActive: false,
    pinchStartDist: 0,
    pinchStartZoom: 1,
    panActive: false,
    panStartX: 0,
    panStartY: 0,
    lastTap: 0,
    raf: 0,
  });

  const applyTransform = useCallback(() => {
    const el = imgRef.current;
    if (!el) return;
    const { zoom, panX, panY } = g.current;
    el.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  }, []);

  const setZoom = useCallback(
    (next: number) => {
      const z = clamp(next, 1, 5);
      g.current.zoom = z;
      if (z === 1) {
        g.current.panX = 0;
        g.current.panY = 0;
      }
      if (imgRef.current) imgRef.current.style.transition = 'transform 0.2s ease-out';
      applyTransform();
      setZoomLevel(z);
    },
    [applyTransform]
  );

  // Nollställ när visaren öppnas
  useEffect(() => {
    if (!open) return;
    g.current.zoom = 1;
    g.current.panX = 0;
    g.current.panY = 0;
    setZoomLevel(1);
    requestAnimationFrame(applyTransform);
  }, [open, applyTransform]);

  // Escape stänger
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Touch-gester (passive: false för preventDefault)
  useEffect(() => {
    const el = surfaceRef.current;
    if (!open || !el) return;
    const s = g.current;

    const onTouchStart = (e: TouchEvent) => {
      if (imgRef.current) imgRef.current.style.transition = 'none';
      if (e.touches.length === 2) {
        e.preventDefault();
        s.pinchActive = true;
        s.pinchStartDist = dist(e.touches[0], e.touches[1]);
        s.pinchStartZoom = s.zoom;
        s.panActive = false;
        return;
      }
      if (e.touches.length === 1) {
        const now = Date.now();
        if (now - s.lastTap < 300) {
          s.lastTap = 0;
          setZoom(s.zoom > 1 ? 1 : 2.5);
          return;
        }
        s.lastTap = now;
        if (s.zoom > 1) {
          e.preventDefault();
          s.panActive = true;
          s.panStartX = e.touches[0].clientX - s.panX;
          s.panStartY = e.touches[0].clientY - s.panY;
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && s.pinchActive) {
        e.preventDefault();
        const ratio = dist(e.touches[0], e.touches[1]) / s.pinchStartDist;
        const prev = s.zoom;
        s.zoom = clamp(s.pinchStartZoom * ratio, 1, 5);
        const zr = prev > 0 ? s.zoom / prev : 1;
        s.panX *= zr;
        s.panY *= zr;
        if (s.zoom <= 1.02) {
          s.panX = 0;
          s.panY = 0;
        }
        cancelAnimationFrame(s.raf);
        s.raf = requestAnimationFrame(applyTransform);
        return;
      }
      if (s.panActive && e.touches.length === 1) {
        e.preventDefault();
        s.panX = e.touches[0].clientX - s.panStartX;
        s.panY = e.touches[0].clientY - s.panStartY;
        cancelAnimationFrame(s.raf);
        s.raf = requestAnimationFrame(applyTransform);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (s.pinchActive && e.touches.length < 2) {
        s.pinchActive = false;
        if (s.zoom < 1.1) {
          s.zoom = 1;
          s.panX = 0;
          s.panY = 0;
          if (imgRef.current) imgRef.current.style.transition = 'transform 0.2s ease-out';
          applyTransform();
        }
        setZoomLevel(s.zoom);
      }
      if (e.touches.length === 0) s.panActive = false;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      cancelAnimationFrame(s.raf);
    };
  }, [open, applyTransform, setZoom]);

  // Muspanorering (desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (g.current.zoom <= 1) return;
    g.current.panActive = true;
    g.current.panStartX = e.clientX - g.current.panX;
    g.current.panStartY = e.clientY - g.current.panY;
    if (imgRef.current) imgRef.current.style.transition = 'none';
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!g.current.panActive) return;
    g.current.panX = e.clientX - g.current.panStartX;
    g.current.panY = e.clientY - g.current.panStartY;
    applyTransform();
  };
  const handleMouseUp = () => {
    g.current.panActive = false;
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm animate-fade-in">
      {/* Kontroller */}
      <div className="flex items-center gap-2 p-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Stäng"
          className="h-10 w-10 flex items-center justify-center rounded-full border border-white/25 text-white transition-all active:scale-95 md:hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm text-white">{fileName || 'Bilaga'}</span>
        <button
          type="button"
          onClick={() => setZoom(g.current.zoom - 0.5)}
          aria-label="Zooma ut"
          className="h-10 w-10 flex items-center justify-center rounded-full border border-white/25 text-white transition-all active:scale-95 md:hover:bg-white/10"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-[44px] text-center text-xs text-white tabular-nums">
          {Math.round(zoomLevel * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setZoom(g.current.zoom + 0.5)}
          aria-label="Zooma in"
          className="h-10 w-10 flex items-center justify-center rounded-full border border-white/25 text-white transition-all active:scale-95 md:hover:bg-white/10"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          aria-label="Återställ zoom"
          className="h-10 w-10 flex items-center justify-center rounded-full border border-white/25 text-white transition-all active:scale-95 md:hover:bg-white/10"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Öppna i ny flik"
          className="h-10 w-10 flex items-center justify-center rounded-full border border-white/25 text-white transition-all active:scale-95 md:hover:bg-white/10"
        >
          <Download className="h-4 w-4" />
        </a>
      </div>

      {/* Bildyta */}
      <div
        ref={surfaceRef}
        className="flex-1 min-h-0 overflow-hidden flex items-center justify-center touch-none select-none"
        style={{ cursor: zoomLevel > 1 ? 'grab' : 'default' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={() => setZoom(g.current.zoom > 1 ? 1 : 2.5)}
      >
        <img
          ref={imgRef}
          src={src}
          alt={fileName || 'Bilaga'}
          draggable={false}
          className="max-h-full max-w-full object-contain will-change-transform"
        />
      </div>

      <p className="pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-2 text-center text-xs text-white">
        Nyp för att zooma · dubbeltryck för snabbzoom
      </p>
    </div>,
    document.body
  );
}
