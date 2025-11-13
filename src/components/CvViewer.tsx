import { useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - import worker file as URL string for Vite
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Button } from '@/components/ui/button';
import { createSignedUrl, convertToSignedUrl } from '@/utils/storageUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl as any;

interface CvViewerProps {
  src: string; // storage path or absolute URL
  fileName?: string;
  height?: number | string; // e.g. 600 or '70vh'
}

export function CvViewer({ src, fileName = 'cv.pdf', height = '70vh' }: CvViewerProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState(1.1);
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

  // Load and render PDF with pdfjs directly
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

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          if (cancelled) return;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          // Ensure visual zoom works reliably across DPI by separating CSS size and backing store size
          const dpr = window.devicePixelRatio || 1;
          const displayWidth = Math.floor(viewport.width);
          const displayHeight = Math.floor(viewport.height);

          // CSS size (what you see)
          canvas.style.width = `${displayWidth}px`;
          canvas.style.height = `${displayHeight}px`;

          // Backing store size (what we draw into)
          canvas.width = Math.floor(displayWidth * dpr);
          canvas.height = Math.floor(displayHeight * dpr);

          // Basic styling
          canvas.style.display = 'block';
          canvas.style.margin = '0 auto 16px auto';
          canvas.style.background = 'white';
          canvas.dataset.pageNumber = i.toString();
          container.appendChild(canvas);
          canvasRefs.current.set(i, canvas);

          const renderTask = page.render({
            canvas: canvas,
            canvasContext: ctx,
            viewport: viewport,
            transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
          });
          await renderTask.promise;
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
      const scrollTop = scrollContainer.scrollTop;
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

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button 
          type="button"
          variant="ghost" 
          size="sm" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Zoom out clicked, current scale:', scale);
            setScale(s => {
              const newScale = Math.max(0.6, s - 0.1);
              console.log('New scale:', newScale);
              return newScale;
            });
          }} 
          className="h-8 w-8 p-0 border border-white/30 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white active:scale-95 active:bg-white/20 active:duration-75"
        >
          -
        </Button>
        <span className="text-sm text-white">Zoom {(scale * 100).toFixed(0)}%</span>
        <Button 
          type="button"
          variant="ghost" 
          size="sm" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Zoom in clicked, current scale:', scale);
            setScale(s => {
              const newScale = Math.min(2.0, s + 0.1);
              console.log('New scale:', newScale);
              return newScale;
            });
          }} 
          className="h-8 w-8 p-0 border border-white/30 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white active:scale-95 active:bg-white/20 active:duration-75"
        >
          +
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
      </div>

      <div className="flex gap-3 w-full" style={{ height }}>
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto rounded-lg relative"
        >
          {error && (
            <div className="h-full flex items-center justify-center p-6 text-sm">{error}</div>
          )}
          {!error && (
            <>
              <div ref={containerRef} className="p-4 min-h-[220px]" />
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

