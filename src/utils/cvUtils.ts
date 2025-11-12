import { createSignedUrl, convertToSignedUrl } from '@/utils/storageUtils';

interface OpenCvOptions {
  cvUrl: string;
  fileName?: string;
  onSuccess?: (message?: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Centralized utility to open CV files from storage
 * Robust against blockers: tries new tab with blob URL, then falls back to auto-download
 */
export async function openCvFile({ cvUrl, fileName = 'cv.pdf', onSuccess, onError }: OpenCvOptions): Promise<void> {
  if (!cvUrl) {
    const error = new Error('No CV URL provided');
    onError?.(error);
    return;
  }

  try {
    // Prepare a popup immediately to avoid blockers
    const popup = window.open('', '_blank');

    // Determine URL type
    const isStoragePath = !cvUrl.startsWith('http');
    const isPrivateBucket = cvUrl.includes('/job-applications/') || isStoragePath;

    let finalUrl = cvUrl;

    // Generate signed URL for private buckets
    if (isStoragePath || isPrivateBucket) {
      if (isStoragePath) {
        finalUrl = (await createSignedUrl('job-applications', cvUrl, 86400)) || cvUrl;
      } else {
        finalUrl = (await convertToSignedUrl(cvUrl, 'job-applications', 86400)) || cvUrl;
      }
    }

    // Fetch the file and open via blob URL to avoid extension blocks
    let blob: Blob | null = null;
    try {
      const res = await fetch(finalUrl);
      if (!res.ok) throw new Error(`Kunde inte hämta filen (${res.status})`);
      blob = await res.blob();
    } catch (fetchErr) {
      // Offline or blocked – try cache fallback
      try {
        if ('caches' in window) {
          const cache = await caches.open('parium-images-v1');
          const cached = await cache.match(finalUrl);
          if (cached) blob = await cached.blob();
        }
      } catch {}
      if (!blob) throw fetchErr;
    }
    const blobUrl = URL.createObjectURL(blob);

    // Try to persist in cache for offline reuse
    try {
      if ('caches' in window && blob) {
        const cache = await caches.open('parium-images-v1');
        const headers = new Headers({ 'Content-Type': blob.type || 'application/octet-stream' });
        await cache.put(finalUrl, new Response(blob, { headers }));
      }
    } catch (e) {
      // Non-fatal
      console.debug('Cache store skipped:', e);
    }

    let opened = false;
    if (popup) {
      try {
        const doc = popup.document;
        const safeTitle = fileName || 'CV';
        doc.open();
        doc.write(`<!doctype html><html lang="sv"><head><meta charset="utf-8"><title>${safeTitle}</title><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>
          html,body{margin:0;height:100%;background:#111;color:#fff}
          #loading{position:absolute;top:16px;left:16px;font:14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif;opacity:.8}
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
          function showDownload(){ if(decided) return; decided=true; iframe.style.display='none'; objectEl.style.display='none'; dl.style.display='inline-flex'; }
          const timer = setTimeout(function(){ showObject(); setTimeout(showDownload, 1200); }, 1500);
          iframe.addEventListener('load', function(){ clearTimeout(timer); showIframe(); });
          objectEl.addEventListener('load', function(){ showObject(); });
          if(!navigator.mimeTypes || !navigator.mimeTypes['application/pdf']){
            setTimeout(showDownload, 1500);
          }
        })();<\/script>
        </body></html>`);
        doc.close();
        opened = true;
      } catch {
        opened = false;
      }
    }

    // Fallback: force download via hidden anchor if popup/new tab is blocked
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

    // Revoke the object URL later to free memory (popup keeps its own reference)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);

    onSuccess?.('CV öppnat (eller nedladdat om fliken blockerades)');
  } catch (error) {
    console.error('Error opening CV:', error);
    onError?.(error instanceof Error ? error : new Error('Unknown error opening CV'));
  }
}

