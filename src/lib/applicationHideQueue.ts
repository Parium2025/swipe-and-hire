/**
 * 🙈 OFFLINE QUEUE — "Dölj ansökan" för jobbsökare.
 *
 * En jobbsökare kan INTE radera en skickad ansökan. Papperskorgen döljer
 * endast ansökan i jobbsökarens egen lista (`hidden_by_applicant_at`);
 * arbetsgivaren behåller ansökan orörd.
 *
 * Offline: åtgärden köas i localStorage och replayas automatiskt när
 * nätet är tillbaka (flushas globalt via OfflineQueueRunner).
 */

import { supabase } from '@/integrations/supabase/client';
import { safeSetItem } from '@/lib/safeStorage';

export interface QueuedHide {
  applicationId: string;
  userId: string;
  hiddenAt: number;
  attempts: number;
}

const QUEUE_KEY = 'parium_offline_application_hide_queue';
const MAX_ATTEMPTS = 5;

function isValid(item: unknown): item is QueuedHide {
  if (!item || typeof item !== 'object') return false;
  const o = item as Record<string, unknown>;
  return (
    typeof o.applicationId === 'string' &&
    typeof o.userId === 'string' &&
    typeof o.hiddenAt === 'number' &&
    typeof o.attempts === 'number'
  );
}

export function getHideQueue(): QueuedHide[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValid);
  } catch {
    try { localStorage.removeItem(QUEUE_KEY); } catch { /* ignore */ }
    return [];
  }
}

function saveQueue(queue: QueuedHide[]): void {
  safeSetItem(QUEUE_KEY, JSON.stringify(queue));
}

/** Returnerar id:n som är köade för dölj (används för optimistisk filtrering). */
export function getQueuedHiddenIds(userId: string | undefined): string[] {
  if (!userId) return [];
  return getHideQueue().filter(q => q.userId === userId).map(q => q.applicationId);
}

export function enqueueHide(applicationId: string, userId: string): void {
  const queue = getHideQueue().filter(
    q => !(q.applicationId === applicationId && q.userId === userId),
  );
  queue.push({ applicationId, userId, hiddenAt: Date.now(), attempts: 0 });
  saveQueue(queue);
}

export function dequeueHide(applicationId: string, userId: string): void {
  saveQueue(getHideQueue().filter(q => !(q.applicationId === applicationId && q.userId === userId)));
}

/** Skickar en dölj-åtgärd till servern. Kastar aldrig — returnerar bool. */
export async function pushHide(applicationId: string, userId: string, hiddenAt: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('job_applications')
      .update({ hidden_by_applicant_at: new Date(hiddenAt).toISOString() })
      .eq('id', applicationId)
      .eq('applicant_id', userId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('[HideQueue] Kunde inte dölja ansökan:', err);
    return false;
  }
}

/** Flushar hela kön för en användare. Returnerar antal lyckade. */
export async function flushHideQueue(userId: string): Promise<number> {
  const mine = getHideQueue().filter(q => q.userId === userId);
  if (mine.length === 0) return 0;

  const remaining: QueuedHide[] = [];
  let synced = 0;

  for (const item of mine) {
    if (item.attempts > 0) {
      const delay = Math.min(1000 * Math.pow(2, item.attempts - 1), 30000);
      await new Promise(r => setTimeout(r, delay));
    }
    const ok = await pushHide(item.applicationId, item.userId, item.hiddenAt);
    if (ok) {
      synced++;
    } else if (item.attempts + 1 < MAX_ATTEMPTS) {
      remaining.push({ ...item, attempts: item.attempts + 1 });
    }
  }

  const others = getHideQueue().filter(q => q.userId !== userId);
  saveQueue([...others, ...remaining]);
  return synced;
}
