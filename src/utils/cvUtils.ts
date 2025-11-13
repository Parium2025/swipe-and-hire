import { createSignedUrl, convertToSignedUrl, getStoragePathFromUrl } from '@/utils/storageUtils';

interface OpenCvOptions {
  cvUrl: string;
  fileName?: string;
  onSuccess?: (message?: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Öppna CV-filer robust:
 * - Signerade länkar för privata buckets
 * - Tvingar rätt MIME-typ (application/pdf) för inbäddad visning
 * - Stabil cache-nyckel (baserad på storage path) för offline-åtkomst
 * - Direkt öppning i ny flik för både mobile och desktop
 * - Enhanced error handling för 4xx-fel och icke-PDF-filer
 */
export async function openCvFile({ cvUrl, fileName = 'cv.pdf', onSuccess, onError }: OpenCvOptions): Promise<void> {
  if (!cvUrl) {
    const error = new Error('No CV URL provided');
    onError?.(error);
    return;
  }

  try {
    // Typ av URL
    const isStoragePath = !cvUrl.startsWith('http');
    const isPrivateBucket = cvUrl.includes('/job-applications/') || isStoragePath;

    let finalUrl = cvUrl;

    // Skapa signerad URL vid behov
    if (isStoragePath || isPrivateBucket) {
      if (isStoragePath) {
        finalUrl = (await createSignedUrl('job-applications', cvUrl, 86400)) || cvUrl;
      } else {
        finalUrl = (await convertToSignedUrl(cvUrl, 'job-applications', 86400)) || cvUrl;
      }
    }

    // Stabil cache-nyckel byggd på storage path (konstant över tid)
    const storagePath = getStoragePathFromUrl(finalUrl) || (isStoragePath ? cvUrl : null);
    const cacheStableUrl = storagePath
      ? `https://cache.parium.local/cv/${encodeURIComponent(storagePath)}`
      : finalUrl;

    // Hämta filen som ArrayBuffer och tvinga korrekt MIME-typ
    let blob: Blob | null = null;
    try {
      const res = await fetch(finalUrl);
      
      // Enhanced error handling for 4xx errors (file not found, access denied, etc.)
      if (!res.ok) {
        if (res.status >= 400 && res.status < 500) {
          throw new Error(`Filen kunde inte hittas eller är inte tillgänglig (${res.status}). Den kan ha flyttats, ändrats eller tagits bort.`);
        }
        throw new Error(`Kunde inte hämta filen (${res.status})`);
      }
      
      const ct = res.headers.get('Content-Type') || '';
      const looksPdf = /\.pdf($|\?)/i.test(finalUrl) || /\.pdf($|\?)/i.test(cvUrl) || /\.pdf$/i.test(fileName) || ct.includes('pdf');
      
      // Validate content type - must be PDF
      if (!looksPdf && !ct.includes('pdf') && !ct.includes('octet-stream')) {
        throw new Error('Filen är inte ett giltigt PDF-dokument. Kontrollera att rätt fil har laddats upp.');
      }
      
      const buffer = await res.arrayBuffer();
      blob = new Blob([buffer], { type: 'application/pdf' });
    } catch (fetchErr) {
      // Offline/blockerad – försök från cache med stabil nyckel först
      try {
        if ('caches' in window) {
          const cache = await caches.open('parium-cv-v1');
          let cached = await cache.match(cacheStableUrl);
          if (!cached) cached = await cache.match(finalUrl);
          if (cached) blob = await cached.blob();
        }
      } catch {}
      if (!blob) throw fetchErr as Error;
    }

    const blobUrl = URL.createObjectURL(blob);

    // Cacha för offline-återanvändning under både stabil och signerad nyckel
    try {
      if ('caches' in window && blob) {
        const cache = await caches.open('parium-cv-v1');
        const headers = new Headers({ 'Content-Type': 'application/pdf' });
        const response = new Response(blob, { headers });
        await cache.put(finalUrl, response.clone());
        if (cacheStableUrl !== finalUrl) {
          await cache.put(cacheStableUrl, response.clone());
        }
      }
    } catch (e) {
      // Icke-kritiskt
      console.debug('Cache store skipped:', e);
    }

    // FÖRBÄTTRAD DESKTOP-LÖSNING: Öppna direkt i ny flik
    // Detta undviker popup-blockerare och cross-origin iframe-problem
    try {
      // Försök öppna PDF direkt i ny flik
      const newTab = window.open(blobUrl, '_blank', 'noopener,noreferrer');
      
      if (!newTab) {
        // Om popup blockeras, trigga automatisk nedladdning
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      // Fallback: tvinga nedladdning
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    // Rensa minne efter en minut
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);

    onSuccess?.('CV öppnat eller nedladdat; fungerar även offline via cache');
  } catch (error) {
    console.error('Error opening CV:', error);
    onError?.(error instanceof Error ? error : new Error('Unknown error opening CV'));
  }
}
