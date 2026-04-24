import { safeSetItem } from '@/lib/safeStorage';
import type { OutreachAutomation, OutreachDispatchLog, OutreachTemplate } from '@/lib/outreach';

const OUTREACH_STUDIO_CACHE_VERSION = 1;
const OUTREACH_STUDIO_CACHE_PREFIX = 'outreach-studio-cache:';
const OUTREACH_TEMPLATES_CACHE_PREFIX = 'outreach-templates-cache:';

type CachedEnvelope<T> = {
  version: number;
  userId: string;
  timestamp: number;
  data: T;
};

export type CachedOutreachStudioData = {
  templates: OutreachTemplate[];
  automations: OutreachAutomation[];
  logs: OutreachDispatchLog[];
};

const readCache = <T>(key: string, userId: string): CachedEnvelope<T> | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedEnvelope<T>;
    if (!parsed || typeof parsed !== 'object') {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      return null;
    }
    if (parsed.version !== OUTREACH_STUDIO_CACHE_VERSION) return null;
    if (parsed.userId !== userId) return null;

    return parsed;
  } catch {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return null;
  }
};

const writeCache = <T>(key: string, userId: string, data: T) => {
  safeSetItem(
    key,
    JSON.stringify({
      version: OUTREACH_STUDIO_CACHE_VERSION,
      userId,
      timestamp: Date.now(),
      data,
    } satisfies CachedEnvelope<T>),
  );
};

export const readCachedOutreachStudio = (userId: string) =>
  readCache<CachedOutreachStudioData>(`${OUTREACH_STUDIO_CACHE_PREFIX}${userId}`, userId)?.data ?? null;

export const writeCachedOutreachStudio = (userId: string, data: CachedOutreachStudioData) => {
  writeCache(`${OUTREACH_STUDIO_CACHE_PREFIX}${userId}`, userId, data);
};

export const readCachedOutreachTemplates = (userId: string) =>
  readCache<OutreachTemplate[]>(`${OUTREACH_TEMPLATES_CACHE_PREFIX}${userId}`, userId)?.data ?? null;

export const writeCachedOutreachTemplates = (userId: string, templates: OutreachTemplate[]) => {
  writeCache(`${OUTREACH_TEMPLATES_CACHE_PREFIX}${userId}`, userId, templates);
};