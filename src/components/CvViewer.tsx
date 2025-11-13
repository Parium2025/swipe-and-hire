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

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          if (cancelled) return;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.display = 'block';
          canvas.style.margin = '0 auto 16px auto';
          canvas.style.background = 'white';
          container.appendChild(canvas);
          await page.render({
            canvas: canvas,
            canvasContext: ctx,
            viewport: viewport
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

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setScale(s => Math.max(0.6, s - 0.1))} 
          className="h-8 w-8 p-0 border border-white/30 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white active:scale-95 active:bg-white/20 active:duration-75"
        >
          -
        </Button>
        <span className="text-sm text-white">Zoom {(scale * 100).toFixed(0)}%</span>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setScale(s => Math.min(2.0, s + 0.1))} 
          className="h-8 w-8 p-0 border border-white/30 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white active:scale-95 active:bg-white/20 active:duration-75"
        >
          +
        </Button>
        {resolvedUrl && (
          <>
            <a href={resolvedUrl} target="_blank" rel="noopener noreferrer" className="ml-auto">
              <Button 
                variant="ghost" 
                size="sm" 
                className="border border-white/30 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white active:scale-95 active:bg-white/20 active:duration-75"
              >
                Öppna i ny flik
              </Button>
            </a>
            <a href={resolvedUrl} download={fileName}>
              <Button 
                variant="ghost" 
                size="sm" 
                className="border border-white/30 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 md:hover:text-white active:scale-95 active:bg-white/20 active:duration-75"
              >
                Ladda ner
              </Button>
            </a>
          </>
        )}
      </div>

      <div
        ref={scrollContainerRef}
        className="w-full overflow-auto rounded-lg relative"
        style={{ height }}
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
      {numPages > 0 && (
        <div className="text-xs text-white">Sida {currentPage} av {numPages}</div>
      )}
    </div>
  );
}

