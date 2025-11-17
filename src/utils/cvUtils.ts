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
    const isEmbedded = window.self !== window.top; // inside editor/iframe (incognito often blocks iframe PDF)
    const isStoragePath = !/^https?:\/\//i.test(cvUrl);

    // Open a placeholder tab immediately on user gesture to avoid popup blocking
    const placeholderWin = isEmbedded ? window.open('', '_blank', 'noopener,noreferrer') : null;
    if (placeholderWin) {
      placeholderWin.document.write('<!doctype html><title>Öppnar PDF…</title><body style="margin:0;background:#121212;color:#fff;font:14px system-ui;display:grid;place-items:center;height:100vh">Öppnar PDF…</body>');
      placeholderWin.document.close();
    }

    // Prepare a signed URL up-front
    let finalUrl = cvUrl;
    if (isStoragePath) {
      finalUrl = (await createSignedUrl('job-applications', cvUrl, 86400, fileName)) || cvUrl;
    } else {
      finalUrl = (await convertToSignedUrl(cvUrl, 'job-applications', 86400, fileName)) || cvUrl;
    }

    if (isEmbedded) {
      try {
        const res = await fetch(finalUrl, { mode: 'cors', cache: 'no-store', credentials: 'omit', headers: { Accept: 'application/pdf' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const pdfBlob = blob.type && blob.type.includes('pdf') ? blob : new Blob([blob], { type: 'application/pdf' });
        const objectUrl = URL.createObjectURL(pdfBlob);
        if (placeholderWin) {
          const viewerHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${fileName}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{height:100%;margin:0;background:#121212;color:#fff} .bar{position:fixed;top:0;left:0;right:0;height:44px;background:#1b1b1b;border-bottom:1px solid #2a2a2a;display:flex;align-items:center;gap:12px;padding:0 12px;font:14px system-ui} .bar a{color:#fff;text-decoration:none;padding:6px 10px;border:1px solid #3a3a3a;border-radius:6px} iframe,embed{position:fixed;inset:44px 0 0 0;width:100%;height:calc(100% - 44px);border:0;background:#121212}</style></head><body><div class="bar"><span>PDF</span><a href="${objectUrl}" download="${fileName}">Ladda ner</a><a href="${finalUrl}" target="_blank" rel="noopener">Öppna källa</a></div><embed id="pdf" type="application/pdf" src="${objectUrl}" /><script>window.addEventListener('beforeunload',()=>URL.revokeObjectURL('${objectUrl}'));</script></body></html>`;
          placeholderWin.document.open();
          placeholderWin.document.write(viewerHtml);
          placeholderWin.document.close();
        } else {
          // Fallback: navigate current tab to blob URL
          window.location.href = objectUrl;
        }
        onSuccess?.('CV öppnas som PDF');
        return;
      } catch (blobErr) {
        // Fallback: direct URL if fetch was blocked by an extension
        if (placeholderWin) {
          placeholderWin.location.href = finalUrl;
        } else {
          window.location.href = finalUrl;
        }
        onSuccess?.('CV öppnas i ny flik');
        return;
      }
    }

    // Otherwise use in-app viewer (CV-tunnel)
    const params = new URLSearchParams();
    if (isStoragePath) params.set('path', cvUrl);
    else params.set('url', cvUrl);
    if (fileName) params.set('name', fileName);

    onSuccess?.('Öppnar CV…');
    window.location.href = `/cv-tunnel?${params.toString()}`;
  } catch (error) {
    console.error('Error opening CV:', error);
    onError?.(error instanceof Error ? error : new Error('Unknown error opening CV'));
  }
}
