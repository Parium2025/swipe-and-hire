import { useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - import worker file as URL string for Vite
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Button } from '@/components/ui/button';
import { createSignedUrl, convertToSignedUrl } from '@/utils/storageUtils';
import { RotateCcw, X } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl as any;

interface CvViewerProps {
  src: string; // storage path or absolute URL
  fileName?: string;
  height?: number | string; // e.g. 600 or '70vh'
  onClose?: () => void;
}

export function CvViewer({ src, fileName = 'cv.pdf', height = '70vh', onClose }: CvViewerProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState(0.9);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPanPosition, setStartPanPosition] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

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

  // Load and render PDF with pdfjs directly (render once, zoom is CSS transform only)
  useEffect(() => {
    if (!resolvedUrl) return;
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

        // Use 4x resolution for maximum clarity at 100% zoom
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

  // Handle touch panning
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
      <div className="flex items-center gap-2 flex-wrap">
        <Button 
          type="button"
          variant="ghost" 
          size="sm" 
          onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.5))} 
          className="h-8 w-8 p-0 border border-white/30 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white active:scale-95 active:bg-white/20 active:duration-75"
        >
          -
        </Button>
        <span className="text-sm text-white">Zoom {Math.round(zoomLevel * 100)}%</span>
        <Button 
          type="button"
          variant="ghost" 
          size="sm" 
          onClick={() => setZoomLevel(z => Math.min(3.0, z + 0.5))} 
          className="h-8 w-8 p-0 border border-white/30 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white active:scale-95 active:bg-white/20 active:duration-75"
        >
          +
        </Button>
        <Button 
          type="button"
          variant="ghost" 
          size="sm" 
          onClick={handleReset} 
          className="h-8 w-8 p-0 border border-white/30 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white active:scale-95 active:bg-white/20 active:duration-75"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        {resolvedUrl && (
          <a href={resolvedUrl} download={fileName} className="ml-auto">
            <Button 
              variant="ghost" 
              size="sm" 
              className="border border-white/30 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white active:scale-95 active:bg-white/20 active:duration-75"
            >
              Ladda ner
            </Button>
          </a>
        )}
        {onClose && (
          <Button 
            type="button"
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="h-8 w-8 p-0 border border-white/30 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white active:scale-95 active:bg-white/20 active:duration-75"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex gap-3 w-full" style={{ height }}>
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
              <div 
                ref={containerRef} 
                className="p-4 min-h-[220px]"
                style={{
                  transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                  transformOrigin: 'center center',
                  transition: isPanning ? 'none' : 'transform 0.2s ease-out'
                }}
              />
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center p-6 text-sm pointer-events-none">
                  Laddar CV…
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar for page navigation */}
        {numPages > 0 && (
          <div className="w-16 overflow-y-auto rounded-lg bg-white/5 backdrop-blur-sm p-2 flex flex-col gap-2">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => scrollToPage(pageNum)}
                className={`
                  h-12 rounded flex items-center justify-center text-sm font-medium
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
        <div className="text-xs text-white">Sida {currentPage} av {numPages}</div>
      )}
    </div>
  );
}

