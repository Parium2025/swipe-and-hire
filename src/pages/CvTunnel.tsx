import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { createSignedUrl, convertToSignedUrl } from '@/utils/storageUtils';
import { CvViewer } from '@/components/CvViewer';

// Simple full-screen in-app PDF viewer ("CV-tunnel") to avoid popup blockers and CORS issues
export default function CvTunnel() {
  const [searchParams] = useSearchParams();
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const ref = useMemo(() => {
    const path = searchParams.get('path'); // storage path (preferred)
    const url = searchParams.get('url');   // absolute URL fallback
    return path || url || '';
  }, [searchParams]);

  const fileName = searchParams.get('name') || 'cv.pdf';

  useEffect(() => {
    let revoked: string | null = null;
    async function run() {
      setLoading(true);
      setError(null);
      setOpenUrl(null);
      try {
        if (!ref) throw new Error('Ingen CV-referens angavs.');
        const isStoragePath = !/^https?:\/\//i.test(ref);
        const signed = isStoragePath
          ? await createSignedUrl('job-applications', ref, 86400, fileName)
          : await convertToSignedUrl(ref, 'job-applications', 86400, fileName);
        const finalUrl = signed || ref;

        const res = await fetch(finalUrl);
        if (!res.ok) {
          if (res.status >= 400 && res.status < 500) {
            throw new Error(`Filen kunde inte hittas eller är inte tillgänglig (${res.status}). Den kan ha flyttats eller tagits bort.`);
          }
          throw new Error(`Kunde inte hämta filen (${res.status}).`);
        }
        const ct = res.headers.get('Content-Type') || '';
        const isPdf = ct.includes('pdf') || /\.pdf($|\?)/i.test(finalUrl) || /\.pdf$/i.test(fileName);
        if (!isPdf && !ct.includes('octet-stream')) {
          throw new Error('Filen är inte ett giltigt PDF-dokument.');
        }
        const buf = await res.arrayBuffer();
        const blob = new Blob([buf], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        revoked = url;
        setOpenUrl(url);
      } catch (e: any) {
        setError(e?.message || 'Kunde inte visa CV.');
      } finally {
        setLoading(false);
      }
    }
    run();
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [ref, fileName]);

  // Basic document title for clarity
  useEffect(() => {
    const prev = document.title;
    document.title = 'Visa CV | Parium';
    return () => { document.title = prev; };
  }, []);

  return (
    <div className="min-h-screen w-screen bg-background text-foreground flex flex-col">
      <header className="flex items-center justify-between p-3 border-b border-border/20 bg-background/80 backdrop-blur">
        <div className="text-sm opacity-80">CV‑visning</div>
        <div className="flex items-center gap-2">
          {openUrl && (
            <>
              <a
                href={openUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:inline-flex"
              >
                <Button variant="secondary">Öppna i ny flik</Button>
              </a>
              <a href={openUrl} download={fileName}>
                <Button variant="default">Ladda ner</Button>
              </a>
            </>
          )}
          <Button variant="ghost" onClick={() => window.history.back()}>Stäng</Button>
        </div>
      </header>

      <main className="flex-1">
        {loading && (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm">Laddar CV…</p>
          </div>
        )}
        {!loading && error && (
          <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm">{error}</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => window.location.reload()}>Försök igen</Button>
              {ref && (
                <Button
                  variant="default"
                  onClick={() => {
                    // Sista utväg: försök öppna originalet direkt
                    const isStoragePath = !/^https?:\/\//i.test(ref);
                    if (isStoragePath) return; // inget att göra
                    window.open(ref, '_blank');
                  }}
                >
                  Öppna direkt
                </Button>
              )}
            </div>
          </div>
        )}
        {!loading && !error && openUrl && (
          <iframe
            src={openUrl}
            title="CV"
            className="w-full h-[calc(100vh-56px)]"
          />
        )}
      </main>
    </div>
  );
}
