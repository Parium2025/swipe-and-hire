import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - import worker file as URL string for Vite
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createSignedUrl, convertToSignedUrl } from '@/utils/storageUtils';
import { RotateCcw } from 'lucide-react';
import { useDevice } from '@/hooks/use-device';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl as any;

// ─── Pure math helpers (no React) ───────────────────────────────────
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const dist = (a: Touch, b: Touch) => Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);

interface CvViewerProps {
  src: string; // storage path or absolute URL
  fileName?: string;
  height?: number | string; // e.g. 600 or '70vh'
  onClose?: () => void;
}

export function CvViewer({ src, fileName = 'cv.pdf', height = '70vh', onClose }: CvViewerProps) {
  const device = useDevice();
  const isMobile = device === 'mobile';
  
  // Dynamic scale: on mobile fill the container width, on desktop use 0.9
  // A4 at 72dpi = 595px. We compute the ideal scale once from the viewport.
  const pdfScale = useMemo(() => {
    if (!isMobile) return 0.9;
    // On mobile, target ~95% of viewport width. A4 width at scale=1 is ~595px.
    const targetWidth = (typeof window !== 'undefined' ? window.innerWidth : 375) * 0.95;
    return Math.max(0.5, targetWidth / 595);
  }, [isMobile]);
  
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale] = useState(pdfScale);
  // zoomLevel & panPosition are only used for UI display (% label) and
  // button controls. During touch gestures we write directly to the DOM
  // via refs and only sync back to state on gesture end.
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  // ─── Live gesture state (never triggers re-render) ────────────────
  const gestureRef = useRef({
    // current transform values (source of truth during gestures)
    zoom: 1,
    panX: 0,
    panY: 0,
    // pinch tracking
    pinchActive: false,
    pinchStartDist: 0,
    pinchStartZoom: 1,
    // pan tracking
    panActive: false,
    panStartX: 0,
    panStartY: 0,
    // rAF handle for coalescing
    raf: 0,
  });

  const isZoomed = zoomLevel > 1;

  const isStoragePath = useMemo(() => !/^https?:\/\//i.test(src), [src]);

  // Resolve to signed URL once
  useEffect(() => {
    let mounted = true;
    setResolvedUrl(null);
    setError(null);
    setLoading(true);
    (async () => {
      try {
        const signed = isStoragePath
          ? await createSignedUrl('job-applications', src, 86400, fileName)
          : await convertToSignedUrl(src, 'job-applications', 86400, fileName);
        if (mounted) setResolvedUrl(signed || src);
      } catch (e: any) {
        if (mounted) {
          setError(e?.message || 'Kunde inte ladda CV.');
          setLoading(false);
        }
      }
    })();
    return () => { mounted = false; };
  }, [src, isStoragePath, fileName]);

  // Load and render PDF
  useEffect(() => {
    if (!resolvedUrl) return;
    let cancelled = false;
    async function render() {
      try {
        setLoading(true);
        const pdf = await pdfjsLib.getDocument({ url: resolvedUrl }).promise;
        if (cancelled) return;
        setNumPages(pdf.numPages);

        const container = containerRef.current;
        if (!container) { setLoading(false); return; }
        container.innerHTML = '';
        canvasRefs.current.clear();

        const outputScale = 4;

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          if (cancelled) return;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          
          canvas.width = Math.floor(viewport.width * outputScale);
          canvas.height = Math.floor(viewport.height * outputScale);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          
          const transform = [outputScale, 0, 0, outputScale, 0, 0];
          canvas.style.display = 'block';
          canvas.style.margin = isMobile ? '0 auto 8px auto' : '0 auto 16px auto';
          canvas.style.background = 'white';
          canvas.dataset.pageNumber = i.toString();
          container.appendChild(canvas);
          canvasRefs.current.set(i, canvas);
          await page.render({
            canvas: canvas,
            canvasContext: ctx,
            viewport: viewport,
            transform: transform
          }).promise;
        }
        setLoading(false);
        
        setZoomLevel(1.0);
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Kunde inte rendera CV.');
          setLoading(false);
        }
      }
    }
    render();
    return () => { cancelled = true; };
  }, [resolvedUrl, scale]);

  // Track current page based on scroll position
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || numPages === 0) return;

    const handleScroll = () => {
      const canvases = scrollContainer.querySelectorAll('canvas');
      let currentVisiblePage = 1;
      let maxVisibleArea = 0;

      canvases.forEach((canvas, index) => {
        const rect = canvas.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        const visibleTop = Math.max(rect.top, containerRect.top);
        const visibleBottom = Math.min(rect.bottom, containerRect.bottom);
        const visibleArea = Math.max(0, visibleBottom - visibleTop);
        if (visibleArea > maxVisibleArea) {
          maxVisibleArea = visibleArea;
          currentVisiblePage = index + 1;
        }
      });

      setCurrentPage(currentVisiblePage);
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [numPages]);

  const scrollToPage = (pageNumber: number) => {
    const canvas = canvasRefs.current.get(pageNumber);
    if (canvas && scrollContainerRef.current) {
      canvas.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Reset pan when zoom resets
  useEffect(() => {
    if (zoomLevel === 1) {
      setPanPosition({ x: 0, y: 0 });
      gestureRef.current.panX = 0;
      gestureRef.current.panY = 0;
    }
    gestureRef.current.zoom = zoomLevel;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [zoomLevel]);

  // ─── Direct DOM write (no React, no GC, pure 60fps) ──────────────
  const applyTransform = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { zoom, panX, panY } = gestureRef.current;
    el.style.transform = `scale(${zoom}) translate(${panX / zoom}px, ${panY / zoom}px)`;
  }, []);

  // Mouse panning (desktop only, when zoomed)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isZoomed) {
      gestureRef.current.panActive = true;
      gestureRef.current.panStartX = e.clientX - gestureRef.current.panX;
      gestureRef.current.panStartY = e.clientY - gestureRef.current.panY;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const g = gestureRef.current;
    if (g.panActive && isZoomed) {
      g.panX = e.clientX - g.panStartX;
      g.panY = e.clientY - g.panStartY;
      applyTransform();
    }
  };

  const handleMouseUp = () => {
    const g = gestureRef.current;
    if (g.panActive) {
      g.panActive = false;
      setPanPosition({ x: g.panX, y: g.panY });
    }
  };

  // ─── Native touch event listeners (passive: false for preventDefault) ──
  useEffect(() => {
    const scrollEl = scrollContainerRef.current;
    if (!scrollEl) return;

    const g = gestureRef.current;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        g.pinchActive = true;
        g.pinchStartDist = dist(e.touches[0], e.touches[1]);
        g.pinchStartZoom = g.zoom;
        g.panActive = false;
        // Disable transition during gesture
        if (containerRef.current) containerRef.current.style.transition = 'none';
        return;
      }
      if (g.zoom <= 1) return; // native scroll at 1x
      if (e.touches.length === 1) {
        e.preventDefault();
        g.panActive = true;
        g.panStartX = e.touches[0].clientX - g.panX;
        g.panStartY = e.touches[0].clientY - g.panY;
        if (containerRef.current) containerRef.current.style.transition = 'none';
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && g.pinchActive) {
        e.preventDefault();
        const d = dist(e.touches[0], e.touches[1]);
        const ratio = d / g.pinchStartDist;
        const prevZoom = g.zoom;
        g.zoom = clamp(g.pinchStartZoom * ratio, 0.5, 3.0);
        // Scale pan proportionally so content doesn't drift off-screen
        if (prevZoom > 0) {
          const zoomRatio = g.zoom / prevZoom;
          g.panX *= zoomRatio;
          g.panY *= zoomRatio;
        }
        // When approaching 1x, progressively kill pan offset
        if (g.zoom <= 1.05) {
          const t = clamp((g.zoom - 0.5) / 0.5, 0, 1); // 0 at 0.5x, 1 at 1x
          g.panX *= t;
          g.panY *= t;
        }
        // Coalesce to next frame
        cancelAnimationFrame(g.raf);
        g.raf = requestAnimationFrame(applyTransform);
        return;
      }
      if (g.panActive && e.touches.length === 1) {
        e.preventDefault();
        g.panX = e.touches[0].clientX - g.panStartX;
        g.panY = e.touches[0].clientY - g.panStartY;
        cancelAnimationFrame(g.raf);
        g.raf = requestAnimationFrame(applyTransform);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (g.pinchActive && e.touches.length < 2) {
        g.pinchActive = false;
        // Snap to 1x if close
        if (Math.abs(g.zoom - 1) < 0.12) {
          g.zoom = 1;
          g.panX = 0;
          g.panY = 0;
        }
        // Always reset pan when at or below 1x
        if (g.zoom <= 1) {
          g.panX = 0;
          g.panY = 0;
        }
        // Restore transition
        if (containerRef.current) {
          containerRef.current.style.transition = 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        }
        applyTransform();
        // Also reset scroll to top when returning to 1x
        if (g.zoom <= 1 && scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
        // Sync to React state (updates UI labels, isZoomed flag)
        setZoomLevel(g.zoom);
        setPanPosition({ x: g.panX, y: g.panY });
      }
      if (e.touches.length === 0 && g.panActive) {
        g.panActive = false;
        if (containerRef.current) {
          containerRef.current.style.transition = 'transform 0.2s ease-out';
        }
        setPanPosition({ x: g.panX, y: g.panY });
      }
    };

    // passive: false is required to call preventDefault on touch events
    scrollEl.addEventListener('touchstart', onTouchStart, { passive: false });
    scrollEl.addEventListener('touchmove', onTouchMove, { passive: false });
    scrollEl.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      scrollEl.removeEventListener('touchstart', onTouchStart);
      scrollEl.removeEventListener('touchmove', onTouchMove);
      scrollEl.removeEventListener('touchend', onTouchEnd);
      cancelAnimationFrame(g.raf);
    };
  }, [applyTransform]); // intentionally stable deps

  const handleReset = () => {
    gestureRef.current.zoom = 1;
    gestureRef.current.panX = 0;
    gestureRef.current.panY = 0;
    setZoomLevel(1.0);
    setPanPosition({ x: 0, y: 0 });
    if (containerRef.current) {
      containerRef.current.style.transition = 'transform 0.2s ease-out';
      applyTransform();
    }
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  // Keep gestureRef in sync when buttons change zoom
  useEffect(() => {
    gestureRef.current.zoom = zoomLevel;
    gestureRef.current.panX = panPosition.x;
    gestureRef.current.panY = panPosition.y;
    applyTransform();
  }, [zoomLevel, panPosition, applyTransform]);

  return (
    <div className="w-full flex flex-col gap-2 md:gap-3">
      {/* Zoom controls */}
      <div className="flex items-center gap-1 flex-wrap">
        <button
          type="button"
          onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.5))} 
          className={`${isMobile ? 'h-8 w-8' : 'h-5 w-5'} min-h-0 min-w-0 aspect-square p-0 leading-none rounded-md border border-white/30 text-white bg-transparent transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 active:scale-95 active:bg-white/20 active:duration-75 flex items-center justify-center touch-manipulation`}
        >
          -
        </button>
        <span className="text-[10px] text-white min-w-[36px] text-center">
          {Math.round(zoomLevel * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setZoomLevel(z => Math.min(3.0, z + 0.5))} 
          className={`${isMobile ? 'h-8 w-8' : 'h-5 w-5'} min-h-0 min-w-0 aspect-square p-0 leading-none rounded-md border border-white/30 text-white bg-transparent transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 active:scale-95 active:bg-white/20 active:duration-75 flex items-center justify-center touch-manipulation`}
        >
          +
        </button>
        <button
          type="button"
          onClick={handleReset} 
          className={`${isMobile ? 'h-8 w-8' : 'h-5 w-5'} min-h-0 min-w-0 aspect-square p-0 leading-none rounded-md border border-white/30 text-white bg-transparent transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 active:scale-95 active:bg-white/20 active:duration-75 flex items-center justify-center touch-manipulation`}
        >
          <RotateCcw className="h-3 w-3" />
        </button>
        <div className="ml-auto flex items-center gap-1">
          {resolvedUrl && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await fetch(resolvedUrl);
                  const blob = await res.blob();
                  const pdfBlob = new Blob([blob], { type: 'application/pdf' });
                  const blobUrl = URL.createObjectURL(pdfBlob);

                  // iOS Safari: a.click() with blob URL just navigates instead of downloading.
                  // Open in new tab so Safari shows its native PDF viewer with share/save.
                  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
                  
                  if (isIOS) {
                    window.open(blobUrl, '_blank');
                  } else {
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = fileName;
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                      document.body.removeChild(a);
                      URL.revokeObjectURL(blobUrl);
                    }, 300);
                  }
                } catch {
                  window.open(resolvedUrl, '_blank');
                }
              }}
              className={`${isMobile ? 'text-[11px] px-2 h-8' : 'text-[10px] px-2 h-6'} rounded-md border border-white/30 text-white bg-transparent transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 active:scale-95 active:bg-white/20 active:duration-75 touch-manipulation`}
            >
              Ladda ner
            </button>
          )}
        </div>
      </div>

      {/* PDF content */}
      <div className="flex gap-2 w-full" style={{ height }}>
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto rounded-lg relative"
          style={{ 
            cursor: isZoomed ? 'grab' : 'default',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {error && (
            <div className="h-full flex items-center justify-center p-6 text-sm">{error}</div>
          )}
          {!error && (
            <>
              <div 
                ref={containerRef} 
                className={isMobile ? "p-1 min-h-[220px]" : "p-4 min-h-[220px]"}
                style={{
                  transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.2s ease-out',
                  touchAction: isZoomed ? 'none' : 'pan-y',
                  willChange: 'transform',
                }}
              />
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center p-6 text-sm text-white pointer-events-none">
                  Laddar CV…
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar for page navigation - hidden on mobile */}
        {numPages > 0 && !isMobile && (
          <div className="w-10 overflow-y-auto rounded-lg bg-white/5 backdrop-blur-sm p-1.5 flex flex-col gap-1.5">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => scrollToPage(pageNum)}
                className={`
                  h-9 text-xs rounded flex items-center justify-center font-medium
                  transition-all duration-200
                  ${pageNum === currentPage
                    ? 'bg-white/20 text-white border border-white/40'
                    : 'bg-white/5 text-white border border-white/20 hover:bg-white/10 hover:text-white'
                  }
                `}
              >
                {pageNum}
              </button>
            ))}
          </div>
        )}
      </div>
      {numPages > 0 && (
        <div className="text-xs text-white text-center">Sida {currentPage} av {numPages}</div>
      )}
    </div>
  );
}

