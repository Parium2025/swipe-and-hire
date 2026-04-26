import { notifyAppFailure, reportAppException } from '@/lib/statusAlerts';

export type AppFailureSeverity = 'warning' | 'critical';

export type AppFailure = {
  id: string;
  kind: 'runtime_error' | 'unhandled_rejection' | 'backend_error';
  severity: AppFailureSeverity;
  title: string;
  message: string;
  route: string;
  createdAt: number;
  fingerprint: string;
  occurrenceCount: number;
  lastSeenAt: number;
  source?: string;
  status?: number;
  stacktrace?: string;
};

const HISTORY_KEY = 'parium_app_failure_history_v1';
const subscribers = new Set<() => void>();
let installed = false;
let ownerUserId: string | null = null;
let originalFetch: typeof window.fetch | null = null;

function readHistory(): AppFailure[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, 50) : [];
  } catch {
    return [];
  }
}

function writeHistory(items: AppFailure[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 50)));
  } catch {
    // Best effort only.
  }
}

function storeFailure(failure: AppFailure) {
  const existing = readHistory();
  const match = existing.find((item) => item.fingerprint === failure.fingerprint);
  const nextFailure = match
    ? { ...match, ...failure, occurrenceCount: match.occurrenceCount + 1, lastSeenAt: failure.createdAt }
    : failure;
  writeHistory([nextFailure, ...existing.filter((item) => item.fingerprint !== failure.fingerprint)]);
  subscribers.forEach((callback) => callback());
}

function route() {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}`;
}

function normalizeMessage(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value).slice(0, 500);
  } catch {
    return String(value);
  }
}

function normalizeStack(value: unknown): string | undefined {
  if (value instanceof Error && value.stack) return value.stack.slice(0, 4000);
  if (typeof value === 'object' && value && 'stack' in value && typeof (value as { stack?: unknown }).stack === 'string') {
    return (value as { stack: string }).stack.slice(0, 4000);
  }
  return undefined;
}

function fingerprint(kind: AppFailure['kind'], message: string, source?: string, status?: number): string {
  const raw = `${kind}:${status ?? ''}:${source ?? ''}:${message.slice(0, 180)}`;
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) hash = Math.imul(31, hash) + raw.charCodeAt(index) | 0;
  return `${kind}-${Math.abs(hash)}`;
}

function shouldTrackUrl(input: RequestInfo | URL): boolean {
  const value = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return /\/rest\/v1\//.test(value) || /\/functions\/v1\//.test(value) || /supabase\.co/.test(value) || /lovable/.test(value);
}

type CreateFailureInput = Omit<AppFailure, 'id' | 'route' | 'createdAt' | 'fingerprint' | 'occurrenceCount' | 'lastSeenAt'> & {
  fingerprint?: string;
  occurrenceCount?: number;
  lastSeenAt?: number;
};

function createFailure(partial: CreateFailureInput): AppFailure {
  const createdAt = Date.now();
  return {
    ...partial,
    id: `${partial.kind}-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    route: route(),
    createdAt,
    lastSeenAt: createdAt,
    occurrenceCount: partial.occurrenceCount ?? 1,
    fingerprint: partial.fingerprint ?? fingerprint(partial.kind, partial.message, partial.source, partial.status),
  };
}

function recordFailure(failure: AppFailure) {
  storeFailure(failure);
  if (ownerUserId) {
    void reportAppException(failure, ownerUserId).catch((error) => {
      console.warn('App exception reporting failed:', error);
    });
    void notifyAppFailure(failure, ownerUserId).catch((error) => {
      console.warn('App failure alert failed:', error);
    });
  }
}

export function installAppFailureMonitor(getOwnerUserId: () => string | null | undefined) {
  ownerUserId = getOwnerUserId() ?? null;

  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    recordFailure(createFailure({
      kind: 'runtime_error',
      severity: 'critical',
      title: 'Appfel upptäckt',
      message: normalizeMessage(event.error || event.message),
      source: event.filename,
      stacktrace: normalizeStack(event.error),
    }));
  });

  window.addEventListener('unhandledrejection', (event) => {
    recordFailure(createFailure({
      kind: 'unhandled_rejection',
      severity: 'warning',
      title: 'Misslyckat async-flöde',
      message: normalizeMessage(event.reason),
      stacktrace: normalizeStack(event.reason),
    }));
  });

  originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const startedAt = performance.now();
    try {
      const response = await originalFetch!(input, init);
      if (shouldTrackUrl(input) && response.status >= 500) {
        recordFailure(createFailure({
          kind: 'backend_error',
          severity: 'critical',
          title: 'Backend-anrop failade',
          message: `${response.status} ${response.statusText || 'Server error'} efter ${Math.round(performance.now() - startedAt)} ms`,
          source: typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
          status: response.status,
        }));
      }
      return response;
    } catch (error) {
      if (shouldTrackUrl(input)) {
        recordFailure(createFailure({
          kind: 'backend_error',
          severity: 'critical',
          title: 'Backend-anrop kunde inte nås',
          message: normalizeMessage(error),
          source: typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
        }));
      }
      throw error;
    }
  };
}

export function updateAppFailureMonitorOwner(userId: string | null | undefined) {
  ownerUserId = userId ?? null;
}

export function getAppFailureHistory(): AppFailure[] {
  return readHistory();
}

export function subscribeToAppFailures(callback: () => void): () => void {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}
