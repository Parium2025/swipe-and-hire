import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createSignedUrl, convertToSignedUrl } from '@/utils/storageUtils';

// Redirects directly to signed PDF URL - no iframe, no blocking
export default function CvTunnel() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const ref = useMemo(() => {
    const path = searchParams.get('path');
    const url = searchParams.get('url');
    return path || url || '';
  }, [searchParams]);

  const fileName = searchParams.get('name') || 'cv.pdf';

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        if (!ref) throw new Error('Ingen CV-referens angavs.');
        const isStoragePath = !/^https?:\/\//i.test(ref);
        const signed = isStoragePath
          ? await createSignedUrl('job-applications', ref, 86400, fileName)
          : await convertToSignedUrl(ref, 'job-applications', 86400, fileName);
        const finalUrl = signed || ref;
        
        if (!cancelled) {
          // Direct navigation to PDF - browser will handle it natively
          window.location.replace(finalUrl);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Kunde inte öppna CV.');
      }
    }
    run();
    return () => { cancelled = true; };
  }, [ref, fileName]);

  if (error) {
    return (
      <div className="min-h-screen w-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <p className="text-sm">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-primary hover:underline"
          >
            Gå tillbaka
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-background text-foreground flex items-center justify-center">
      <p className="text-sm">Öppnar CV…</p>
    </div>
  );
}
