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
 * - Ny flik med inbäddad viewer + automatisk nedladdning som sista fallback
 */
export async function openCvFile({ cvUrl, fileName = 'cv.pdf', onSuccess, onError }: OpenCvOptions): Promise<void> {
  if (!cvUrl) {
    const error = new Error('No CV URL provided');
    onError?.(error);
    return;
  }

  try {
    // Förbered popup direkt för att undvika blockers
    const popup = window.open('', '_blank');

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
      if (!res.ok) throw new Error(`Kunde inte hämta filen (${res.status})`);
      const ct = res.headers.get('Content-Type') || '';
      const looksPdf = /\.pdf($|\?)/i.test(finalUrl) || /\.pdf($|\?)/i.test(cvUrl) || /\.pdf$/i.test(fileName) || ct.includes('pdf');
      const buffer = await res.arrayBuffer();
      blob = new Blob([buffer], { type: looksPdf ? 'application/pdf' : (ct || 'application/pdf') });
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
        const headers = new Headers({ 'Content-Type': blob.type || 'application/pdf' });
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

    // Rendera viewer i popup (iframe -> object -> auto-download)
    let opened = false;
    if (popup) {
      try {
        const doc = popup.document;
        const safeTitle = fileName || 'CV';
        doc.open();
        doc.write(`<!doctype html><html lang="sv"><head><meta charset="utf-8"><title>${safeTitle}</title><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>
          html,body{margin:0;height:100%;background:#111;color:#fff}
          #loading{position:absolute;top:16px;left:16px;font:14px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;opacity:.8}
          a#download{position:absolute;bottom:16px;right:16px;background:#2563eb;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none}
        </style></head><body>
        <div id="loading">Öppnar CV…</div>
        <iframe id="pdfFrame" src="${blobUrl}#toolbar=1&navpanes=0&view=FitH" style="width:100%;height:100%;border:0;display:block" allow="fullscreen"></iframe>
        <object id="pdfObject" data="${blobUrl}" type="${blob.type || 'application/pdf'}" style="width:100%;height:100%;display:none"></object>
        <a id="download" href="${blobUrl}" download="${safeTitle}" style="display:none">Ladda ner</a>
        <script>(function(){
          const iframe = document.getElementById('pdfFrame');
          const objectEl = document.getElementById('pdfObject');
          const dl = document.getElementById('download');
          let decided = false;
          function showIframe(){ if(decided) return; decided=true; objectEl.style.display='none'; iframe.style.display='block'; dl.style.display='none'; }
          function showObject(){ if(decided) return; decided=true; iframe.style.display='none'; objectEl.style.display='block'; dl.style.display='none'; }
          function showDownload(){ if(decided) return; decided=true; iframe.style.display='none'; objectEl.style.display='none'; dl.style.display='inline-flex'; try{ dl.click(); }catch(e){} }
          const timer = setTimeout(function(){ showObject(); setTimeout(showDownload, 1200); }, 1500);
          iframe.addEventListener('load', function(){ try{ clearTimeout(timer); showIframe(); }catch(e){} });
          objectEl.addEventListener('load', function(){ try{ showObject(); }catch(e){} });
          if(!navigator.mimeTypes || !navigator.mimeTypes['application/pdf']){ setTimeout(showDownload, 1500); }
        })();<\/script>
        </body></html>`);
        doc.close();
        opened = true;
      } catch {
        opened = false;
      }
    }

    // Om popup blockeras: tvinga nedladdning
    if (!opened) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    // Rensa minne (popup behåller egen referens)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);

    onSuccess?.('CV öppnat eller nedladdat; fungerar även offline via cache');
  } catch (error) {
    console.error('Error opening CV:', error);
    onError?.(error instanceof Error ? error : new Error('Unknown error opening CV'));
  }
}
