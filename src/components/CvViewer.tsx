import { useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - import worker file as URL string for Vite
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Button } from '@/components/ui/button';
import { createSignedUrl, convertToSignedUrl } from '@/utils/storageUtils';
import { RotateCcw, X, Maximize2, Minimize2 } from 'lucide-react';
import { useDevice } from '@/hooks/use-device';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl as any;

interface CvViewerProps {
  src: string; // storage path or absolute URL
  fileName?: string;
  height?: number | string; // e.g. 600 or '70vh'
  onClose?: () => void;
  renderMode?: 'canvas' | 'native'; // 'native' uses browser PDF viewer via iframe
}

export function CvViewer({ src, fileName = 'cv.pdf', height = '70vh', onClose, renderMode = 'canvas' }: CvViewerProps) {
  const device = useDevice();
  const isMobile = device === 'mobile';
  const isTablet = device === 'tablet';
  
  // Same scale for all devices to maintain consistent rendering
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  // Inject minimal styles for pdf.js textLayer (once)
  useEffect(() => {
    const id = 'pdf-textlayer-styles';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `
        .textLayer { position: absolute; inset: 0; color: transparent; }
        .textLayer span { position: absolute; white-space: pre; transform-origin: 0% 0%; color: transparent; text-shadow: 0 0 0 #000; -webkit-font-smoothing: antialiased; font-smooth: always; }
        .textLayer .endOfContent { display: none; }
      `;
      document.head.appendChild(style);
    }
  }, []);

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
          ? await createSignedUrl('job-applications', src, 86400)
          : await convertToSignedUrl(src, 'job-applications', 86400);
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

  // Mark load complete when using native iframe once URL is resolved
  useEffect(() => {
    if (renderMode === 'native' && resolvedUrl) {
      setLoading(false);
    }
  }, [renderMode, resolvedUrl]);

  // Load and render PDF with pdfjs directly - Ultra HiDPI rendering without textLayer
  useEffect(() => {
    if (!resolvedUrl || renderMode === 'native') return;
    let cancelled = false;
    async function render() {
      try {
        setLoading(true);
        const pdf = await pdfjsLib.getDocument({ url: resolvedUrl }).promise;
        if (cancelled) return;
        setNumPages(pdf.numPages);

        // Clear previous canvases
        const container = containerRef.current;
        if (!container) { setLoading(false); return; }
        container.innerHTML = '';
        canvasRefs.current.clear();

        // Ultra HiDPI rendering: aggressive scaling for crisp text
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const scrollEl = scrollContainerRef.current;
        const containerWidth = scrollEl ? scrollEl.clientWidth : window.innerWidth;
        const firstPage = await pdf.getPage(1);
        const unscaledViewport = firstPage.getViewport({ scale: 1 });
        const pageWidthPts = unscaledViewport.width;
        // Fit-to-width baseline scale
        const fitScale = containerWidth / pageWidthPts;
        const baseScale = Math.min(fitScale, initialScale);
        const effectiveScale = Math.max(0.5, baseScale * zoomLevel);
        // Ultra HiDPI: render at very high resolution (8x–16x)
        const outputScale = 16; // Force ultra HiDPI for maximal text clarity


        for (let i = 1; i <= pdf.numPages; i++) {
          const page = i === 1 ? firstPage : await pdf.getPage(i);
          if (cancelled) return;
          const viewport = page.getViewport({ scale: effectiveScale });

          // Page wrapper for canvas only (no textLayer)
          const pageContainer = document.createElement('div');
          pageContainer.style.position = 'relative';
          pageContainer.style.width = `${Math.floor(viewport.width)}px`;
          pageContainer.style.height = `${Math.floor(viewport.height)}px`;
          pageContainer.style.margin = '0 auto 16px auto';
          pageContainer.style.background = 'white';
          container.appendChild(pageContainer);

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { alpha: false });
          if (!ctx) continue;
          // Disable image smoothing for crisp rendering
          ctx.imageSmoothingEnabled = false;

          // Render at ultra high resolution
          canvas.width = Math.floor(viewport.width * outputScale);
          canvas.height = Math.floor(viewport.height * outputScale);
          // CSS size matches viewport exactly (1:1, no extra scaling)
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          canvas.style.position = 'absolute';
          canvas.style.left = '0';
          canvas.style.top = '0';
          ;(canvas.style as any).imageRendering = 'crisp-edges';

          const transform = [outputScale, 0, 0, outputScale, 0, 0];
          canvas.dataset.pageNumber = i.toString();
          pageContainer.appendChild(canvas);
          canvasRefs.current.set(i, canvas);
          
          await page.render({
            canvas: canvas,
            canvasContext: ctx,
            viewport: viewport,
            transform: transform
          }).promise;

          // NO textLayer injection - pure canvas rendering only
        }
        setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Kunde inte rendera CV.');
          setLoading(false);
        }
      }
    }
    render();
    return () => { cancelled = true; };
  }, [resolvedUrl, scale, zoomLevel, renderMode]);

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
        
        // Calculate visible area of this canvas
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

    scrollContainer.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check
    
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [numPages]);

  const scrollToPage = (pageNumber: number) => {
    const canvas = canvasRefs.current.get(pageNumber);
    if (canvas && scrollContainerRef.current) {
      canvas.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Reset pan when zoom changes
  useEffect(() => {
    if (zoomLevel === 1) {
      setPanPosition({ x: 0, y: 0 });
    }
  }, [zoomLevel]);
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsPanning(true);
      setStartPanPosition({
        x: e.clientX - panPosition.x,
        y: e.clientY - panPosition.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && zoomLevel > 1) {
      setPanPosition({
        x: e.clientX - startPanPosition.x,
        y: e.clientY - startPanPosition.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Handle touch panning (restored)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoomLevel > 1 && e.touches.length === 1) {
      setIsPanning(true);
      setStartPanPosition({
        x: e.touches[0].clientX - panPosition.x,
        y: e.touches[0].clientY - panPosition.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isPanning && zoomLevel > 1 && e.touches.length === 1) {
      setPanPosition({
        x: e.touches[0].clientX - startPanPosition.x,
        y: e.touches[0].clientY - startPanPosition.y
      });
    }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
  };

  // Fullscreen handlers
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.error('Fullscreen error', e);
    }
  };

  // Reset pan when zoom changes
  useEffect(() => {
    if (zoomLevel === 1) {
      setPanPosition({ x: 0, y: 0 });
    }
  }, [zoomLevel]);

  const handleReset = () => {
    setZoomLevel(1.0);
    setPanPosition({ x: 0, y: 0 });
  };

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex items-center gap-1 flex-wrap">
        <Button 
          type="button"
          variant="ghost" 
          size="sm" 
          onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.5))} 
          className={`${isMobile ? 'h-7 w-7' : 'h-5 w-5'} min-h-0 min-w-0 aspect-square p-0 leading-none rounded-md border border-white/30 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white active:scale-95 active:bg-white/20 active:duration-75`}
        >
          -
        </Button>
        <span className="text-[10px] text-white min-w-[36px] text-center">
          {Math.round(zoomLevel * 100)}%
        </span>
        <Button 
          type="button"
          variant="ghost" 
          size="sm" 
          onClick={() => setZoomLevel(z => Math.min(3.0, z + 0.5))} 
          className={`${isMobile ? 'h-7 w-7' : 'h-5 w-5'} min-h-0 min-w-0 aspect-square p-0 leading-none rounded-md border border-white/30 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white active:scale-95 active:bg-white/20 active:duration-75`}
        >
          +
        </Button>
        <Button 
          type="button"
          variant="ghost" 
          size="sm" 
          onClick={handleReset} 
          className={`${isMobile ? 'h-7 w-7' : 'h-5 w-5'} min-h-0 min-w-0 aspect-square p-0 leading-none rounded-md border border-white/30 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white active:scale-95 active:bg-white/20 active:duration-75`}
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
        
        {/* Quick zoom presets */}
        <div className="flex gap-0.5 ml-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setZoomLevel(1.0)}
            className={`${isMobile ? 'text-[9px] px-1.5 h-7' : 'text-[9px] px-1.5 h-6'} rounded-md border border-white/30 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white active:scale-95 active:bg-white/20 active:duration-75`}
          >
            100%
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setZoomLevel(1.5)}
            className={`${isMobile ? 'text-[9px] px-1.5 h-7' : 'text-[9px] px-1.5 h-6'} rounded-md border border-white/30 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white active:scale-95 active:bg-white/20 active:duration-75`}
          >
            150%
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setZoomLevel(2.0)}
            className={`${isMobile ? 'text-[9px] px-1.5 h-7' : 'text-[9px] px-1.5 h-6'} rounded-md border border-white/30 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white active:scale-95 active:bg-white/20 active:duration-75`}
          >
            200%
          </Button>
        </div>
        
        <div className="ml-auto flex items-center gap-1">
          {/* Fullscreen button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className={`${isMobile ? 'h-7 w-7' : 'h-5 w-5'} min-h-0 min-w-0 aspect-square p-0 leading-none rounded-md border border-white/30 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white active:scale-95 active:bg-white/20 active:duration-75`}
          >
            {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </Button>
          
          {onClose && (
            <Button 
              type="button"
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className={`${isMobile ? 'h-7 w-7' : 'h-5 w-5'} min-h-0 min-w-0 aspect-square p-0 leading-none rounded-md border border-white/30 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white active:scale-95 active:bg-white/20 active:duration-75`}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          {resolvedUrl && (
            <a href={resolvedUrl} download={fileName} target="_blank" rel="noopener noreferrer">
              <Button 
                type="button"
                variant="ghost" 
                size="sm" 
                className={`${isMobile ? 'text-[11px] px-2 h-7' : 'text-[10px] px-2 h-6'} rounded-md border border-white/30 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white active:scale-95 active:bg-white/20 active:duration-75`}
              >
                Öppna i ny flik
              </Button>
            </a>
          )}
        </div>
      </div>

      <div className="flex gap-2 w-full" style={{ height }}>
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto rounded-lg relative"
          style={{ cursor: zoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
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
              {renderMode === 'native' ? (
                <iframe
                  src={resolvedUrl || undefined}
                  title="CV"
                  className={isMobile ? "p-2 min-h-[220px] w-full h-full" : "p-4 min-h-[220px] w-full h-full"}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    background: 'white',
                    ...(panPosition.x !== 0 || panPosition.y !== 0
                      ? { transform: `translate(${panPosition.x}px, ${panPosition.y}px)`, transformOrigin: 'center center' }
                      : {}),
                    transition: isPanning ? 'none' : 'transform 0.2s ease-out'
                  }}
                  onLoad={() => setLoading(false)}
                  onError={() => { setError('Kunde inte visa PDF i denna vy.'); setLoading(false); }}
                />
              ) : (
                <div 
                  ref={containerRef} 
                  className={isMobile ? "p-2 min-h-[220px]" : "p-4 min-h-[220px]"}
                  style={{
                    ...(panPosition.x !== 0 || panPosition.y !== 0
                      ? { transform: `translate(${panPosition.x}px, ${panPosition.y}px)`, transformOrigin: 'center center' }
                      : {}),
                    transition: isPanning ? 'none' : 'transform 0.2s ease-out'
                  }}
                />
              )}
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center p-6 text-sm pointer-events-none">
                  Laddar CV…
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar for page navigation - hidden on mobile */}
        {numPages > 0 && !isMobile && (
          <div className={`${isTablet ? 'w-8' : 'w-10'} overflow-y-auto rounded-lg bg-white/5 backdrop-blur-sm p-1.5 flex flex-col gap-1.5`}>
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => scrollToPage(pageNum)}
                className={`
                  ${isTablet ? 'h-8 text-xs' : 'h-9 text-xs'} rounded flex items-center justify-center font-medium
                  transition-all duration-200
                  ${pageNum === currentPage
                    ? 'bg-white/20 text-white border border-white/40'
                    : 'bg-white/5 text-white/70 border border-white/20 hover:bg-white/10 hover:text-white'
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

