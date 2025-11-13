import { useEffect, useMemo, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
// Vite-friendly worker (string URL)
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&url';
import { Button } from '@/components/ui/button';
import { createSignedUrl, convertToSignedUrl } from '@/utils/storageUtils';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker as any;

interface CvViewerProps {
  src: string; // storage path or absolute URL
  fileName?: string;
  height?: number | string; // e.g. 600 or '70vh'
}

export function CvViewer({ src, fileName = 'cv.pdf', height = '70vh' }: CvViewerProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState(1.2);
  const [error, setError] = useState<string | null>(null);

  const isStoragePath = useMemo(() => !/^https?:\/\//i.test(src), [src]);

  useEffect(() => {
    let mounted = true;
    setResolvedUrl(null);
    setError(null);
    (async () => {
      try {
        const signed = isStoragePath
          ? await createSignedUrl('job-applications', src, 86400, fileName)
          : await convertToSignedUrl(src, 'job-applications', 86400, fileName);
        if (mounted) setResolvedUrl(signed || src);
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Kunde inte ladda CV.');
      }
    })();
    return () => { mounted = false; };
  }, [src, isStoragePath, fileName]);

  const onDocumentLoad = ({ numPages }: { numPages: number }) => setNumPages(numPages);

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => setScale(s => Math.max(0.5, s - 0.1))}>-</Button>
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

      <div className="w-full overflow-auto border border-white/10 rounded-md bg-white/5" style={{ height }}>
        {error && (
          <div className="h-full flex items-center justify-center p-6 text-sm">{error}</div>
        )}
        {!error && !resolvedUrl && (
          <div className="h-full flex items-center justify-center p-6 text-sm">Laddar CV…</div>
        )}
        {!error && resolvedUrl && (
          <Document file={resolvedUrl} onLoadSuccess={onDocumentLoad} onLoadError={(e) => setError(String(e))} loading={null}>
            {Array.from(new Array(numPages), (el, index) => (
              <Page key={`page_${index + 1}`} pageNumber={index + 1} scale={scale} width={undefined} loading={null} renderTextLayer={false} renderAnnotationLayer={false} />
            ))}
          </Document>
        )}
      </div>
    </div>
  );
}
