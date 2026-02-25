import { useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - import worker file as URL string for Vite
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createSignedUrl, convertToSignedUrl } from '@/utils/storageUtils';
import { RotateCcw } from 'lucide-react';
import { useDevice } from '@/hooks/use-device';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl as any;

interface CvViewerProps {
  src: string; // storage path or absolute URL
  fileName?: string;
  height?: number | string; // e.g. 600 or '70vh'
  onClose?: () => void;
}

export function CvViewer({ src, fileName = 'cv.pdf', height = '70vh', onClose }: CvViewerProps) {
  const device = useDevice();
  const isMobile = device === 'mobile';
  
  const initialScale = 0.9;
  
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState(initialScale);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPanPosition, setStartPanPosition] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

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
          canvas.style.margin = '0 auto 16px auto';
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
    }
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [zoomLevel]);

  // Mouse panning (desktop only, when zoomed)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isZoomed) {
      setIsPanning(true);
      setStartPanPosition({
        x: e.clientX - panPosition.x,
        y: e.clientY - panPosition.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && isZoomed) {
      setPanPosition({
        x: e.clientX - startPanPosition.x,
        y: e.clientY - startPanPosition.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Touch panning — ONLY when zoomed in, otherwise let native scroll work
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isZoomed) return; // Let native scroll handle it
    if (e.touches.length === 1) {
      setIsPanning(true);
      setStartPanPosition({
        x: e.touches[0].clientX - panPosition.x,
        y: e.touches[0].clientY - panPosition.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isZoomed || !isPanning) return; // Let native scroll handle it
    if (e.touches.length === 1) {
      // Only prevent default when actually panning (zoomed in)
      e.preventDefault();
      setPanPosition({
        x: e.touches[0].clientX - startPanPosition.x,
        y: e.touches[0].clientY - startPanPosition.y
      });
    }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
  };

  const handleReset = () => {
    setZoomLevel(1.0);
    setPanPosition({ x: 0, y: 0 });
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

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
            <a href={resolvedUrl} download={fileName}>
              <button
                type="button"
                className={`${isMobile ? 'text-[11px] px-2 h-8' : 'text-[10px] px-2 h-6'} rounded-md border border-white/30 text-white bg-transparent transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 active:scale-95 active:bg-white/20 active:duration-75 touch-manipulation`}
              >
                Ladda ner
              </button>
            </a>
          )}
        </div>
      </div>

      {/* PDF content */}
      <div className="flex gap-2 w-full" style={{ height }}>
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto rounded-lg relative -webkit-overflow-scrolling-touch"
          style={{ 
            cursor: isZoomed ? (isPanning ? 'grabbing' : 'grab') : 'default',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
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
                  transition: isPanning ? 'none' : 'transform 0.2s ease-out',
                  // On mobile at 1x zoom, don't block touch events on the container
                  touchAction: isZoomed ? 'none' : 'auto',
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
