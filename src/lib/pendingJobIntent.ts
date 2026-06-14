// Hanterar "vänteläge"-intent för en jobbannons.
// Används när en utloggad användare klickar "Ansök" på /annons/:id —
// vi parkerar avsikten, slussar via /auth (+ ev. WelcomeTunnel), och
// återupptar sedan flödet direkt till rätt jobb. Speglar mönstret i
// src/lib/savedSearchIntent.ts.

const KEY = 'parium-pending-job-intent';
const TTL_MS = 60 * 60 * 1000; // 1h

export type PendingJobAction = 'apply' | 'view';

export interface PendingJobIntent {
  jobId: string;
  action: PendingJobAction;
}

export function setPendingJob(intent: PendingJobIntent | null | undefined) {
  if (!intent || !intent.jobId || typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ ...intent, ts: Date.now() })
    );
  } catch {
    /* ignore */
  }
}

export function readPendingJob(): (PendingJobIntent & { ts?: number }) | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.jobId) return null;
    if (typeof parsed.ts === 'number' && Date.now() - parsed.ts > TTL_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    if (parsed.action !== 'apply' && parsed.action !== 'view') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingJob() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Plockar ut intent + nollställer + returnerar destination-URL.
 * Returnerar null om ingen pending finns.
 */
export function consumePendingJobPath(): string | null {
  const intent = readPendingJob();
  if (!intent) return null;
  clearPendingJob();
  return intent.action === 'apply'
    ? `/job-application/${intent.jobId}`
    : `/annons/${intent.jobId}`;
}
