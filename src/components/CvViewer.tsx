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
  const [scale, setScale] = useState(1.1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

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
        if (!container) return;
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

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => setScale(s => Math.max(0.6, s - 0.1))}>-</Button>
        <span className="text-sm">Zoom {(scale * 100).toFixed(0)}%</span>
        <Button variant="secondary" onClick={() => setScale(s => Math.min(2.0, s + 0.1))}>+</Button>
        {resolvedUrl && (
          <>
            <a href={resolvedUrl} target="_blank" rel="noopener noreferrer" className="ml-auto">
              <Button variant="secondary">Öppna i ny flik</Button>
            </a>
            <a href={resolvedUrl} download={fileName}>
              <Button variant="default">Ladda ner</Button>
            </a>
          </>
        )}
      </div>

      <div
        className="w-full overflow-auto border border-white/10 rounded-md"
        style={{ height, background: 'transparent' }}
      >
        {error && (
          <div className="h-full flex items-center justify-center p-6 text-sm">{error}</div>
        )}
        {!error && loading && (
          <div className="h-full flex items-center justify-center p-6 text-sm">Laddar CV…</div>
        )}
        {!error && !loading && (
          <div ref={containerRef} className="p-4" />
        )}
      </div>
      {numPages > 0 && (
        <div className="text-xs opacity-70">Sidor: {numPages}</div>
      )}
    </div>
  );
}

