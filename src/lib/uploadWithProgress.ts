/**
 * 🚀 RESILIENT UPLOAD — XHR-baserad uppladdning till Supabase Storage
 *
 * Varför XHR och inte fetch?
 *   fetch() exponerar inte upload progress events. XHR gör det via
 *   xhr.upload.onprogress. Detta är enda vägen till "67% — 32 MB av 50 MB".
 *
 * Funktioner:
 *   ✅ Progress events (loaded/total bytes)
 *   ✅ Abort via AbortController
 *   ✅ Retry med exponential backoff (1s → 2s → 4s → 8s → 16s)
 *   ✅ Custom error-typer för bättre UI-feedback
 *   ✅ Fungerar parallellt med befintlig uploadMedia() — inga breaking changes
 */

import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export interface UploadProgress {
  /** Bytes uppladdade hittills */
  loaded: number;
  /** Total filstorlek i bytes */
  total: number;
  /** 0-100 */
  percent: number;
  /** Beräknad uppladdningshastighet i bytes/s (uppdateras kontinuerligt) */
  bytesPerSecond: number;
  /** Sekunder kvar (best-effort estimat) */
  secondsRemaining: number;
}

export interface UploadOptions {
  bucket: string;
  path: string;
  file: Blob | File;
  contentType?: string;
  cacheControl?: string;
  upsert?: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
}

export class UploadAbortedError extends Error {
  constructor() {
    super('Uppladdning avbruten');
    this.name = 'UploadAbortedError';
  }
}

export class UploadNetworkError extends Error {
  constructor(message = 'Nätverksfel') {
    super(message);
    this.name = 'UploadNetworkError';
  }
}

export class UploadServerError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'UploadServerError';
    this.status = status;
  }
}

/**
 * En enskild uppladdningsförsök via XHR. Inga retries här — det görs av wrappern.
 */
export function uploadOnce(opts: UploadOptions): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const { bucket, path, file, signal } = opts;

    if (signal?.aborted) {
      reject(new UploadAbortedError());
      return;
    }

    // Hämta auth-token för Authorization-header
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token ?? SUPABASE_KEY;

    const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURI(path)}`;
    const xhr = new XMLHttpRequest();

    // Progress tracking
    let lastReportTime = Date.now();
    let lastReportLoaded = 0;
    let smoothedBps = 0;

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable || !opts.onProgress) return;

      const now = Date.now();
      const dt = (now - lastReportTime) / 1000;
      if (dt > 0.1) {
        const dBytes = evt.loaded - lastReportLoaded;
        const instantBps = dBytes / dt;
        // Exponentiellt utjämnat medelvärde (jämnare ETA, mindre jitter)
        smoothedBps = smoothedBps === 0 ? instantBps : smoothedBps * 0.7 + instantBps * 0.3;
        lastReportTime = now;
        lastReportLoaded = evt.loaded;
      }

      const remaining = evt.total - evt.loaded;
      const secondsRemaining = smoothedBps > 0 ? remaining / smoothedBps : 0;

      opts.onProgress({
        loaded: evt.loaded,
        total: evt.total,
        percent: Math.round((evt.loaded / evt.total) * 100),
        bytesPerSecond: smoothedBps,
        secondsRemaining,
      });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new UploadServerError(xhr.status, xhr.responseText || `HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new UploadNetworkError());
    xhr.ontimeout = () => reject(new UploadNetworkError('Timeout'));
    xhr.onabort = () => reject(new UploadAbortedError());

    if (signal) {
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    xhr.open('POST', url, true);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('apikey', SUPABASE_KEY);
    xhr.setRequestHeader('x-upsert', String(opts.upsert ?? true));
    xhr.setRequestHeader('Content-Type', opts.contentType || (file as File).type || 'application/octet-stream');
    xhr.setRequestHeader('Cache-Control', opts.cacheControl || '31536000');

    xhr.send(file);
  });
}

/**
 * Uppladdning med automatisk retry + exponential backoff.
 *
 * Retry-strategi:
 *   - 5xx eller nätverksfel → retry
 *   - 4xx (klientfel, t.ex. fil för stor) → ingen retry
 *   - Abort → ingen retry
 *
 * Backoff: 1s, 2s, 4s, 8s, 16s (max 5 försök totalt)
 */
export async function uploadWithRetry(
  opts: UploadOptions & { maxAttempts?: number; onAttempt?: (attempt: number) => void },
): Promise<void> {
  const maxAttempts = opts.maxAttempts ?? 5;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (opts.signal?.aborted) throw new UploadAbortedError();
    opts.onAttempt?.(attempt);

    try {
      await uploadOnce(opts);
      return;
    } catch (err) {
      lastError = err;

      // Inga retries vid abort eller klientfel
      if (err instanceof UploadAbortedError) throw err;
      if (err instanceof UploadServerError && err.status >= 400 && err.status < 500) throw err;

      // Sista försöket failade — kasta vidare
      if (attempt === maxAttempts) break;

      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 16000);
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, backoffMs);
        opts.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new UploadAbortedError());
        }, { once: true });
      });
    }
  }

  throw lastError;
}

/** Formatera bytes till läsbart format (1.2 MB, 850 KB osv) */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Formatera sekunder till läsbart format ("12 sek kvar", "1 min kvar") */
export function formatTimeRemaining(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '';
  if (seconds < 60) return `${Math.ceil(seconds)} sek kvar`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} min kvar`;
}
