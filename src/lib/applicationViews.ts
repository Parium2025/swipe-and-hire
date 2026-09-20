import { supabase } from '@/integrations/supabase/client';

/**
 * Läsmarkering för ansökningar — ägarregeln.
 *
 * - EGNA annonser: varje teammedlem har sin egen olästa-markering. Att en
 *   kollega öppnar kandidaten nollar inte din prick (delad inkorg-känsla).
 * - KOLLEGORS annonser: delad status. När någon i teamet öppnat ansökan
 *   räknas den som sedd för alla — man jobbar i den tillsammans.
 *
 * Tekniskt skrivs en rad per (ansökan, person) i `job_application_views`, och
 * `job_applications.viewed_at` sätts alltid när någon i teamet sett ansökan
 * (används även av mejlsammanfattningar). `resolveApplicationViewedAt` väljer
 * vilken källa som gäller utifrån vem som äger annonsen.
 */

/** Markerar ansökan som läst för den inloggade personen (idempotent). */
export async function markApplicationViewedForMe(applicationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_application_viewed', {
    p_application_id: applicationId,
  });
  if (error) throw error;
}

/** Hämtar vilka av dessa ansökningar den inloggade personen redan öppnat. */
export async function fetchMyApplicationViews(
  applicationIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(applicationIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  const result = new Map<string, string>();
  // Håll URL:en kort även när en sida innehåller tusentals rader.
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('job_application_views')
      .select('application_id, viewed_at')
      .in('application_id', slice);
    if (error) throw error;
    for (const row of data || []) {
      result.set(row.application_id as string, row.viewed_at as string);
    }
  }
  return result;
}

/**
 * Väljer rätt läst-källa för en ansökan: personlig markering på egna
 * annonser, delad `viewed_at` på kollegors annonser.
 */
export function resolveApplicationViewedAt(
  app: { viewed_at?: string | null; job_postings?: { employer_id?: string | null } | null } | null | undefined,
  myViews: Map<string, string>,
  userId: string,
  applicationId: string,
): string | null {
  if (app?.job_postings?.employer_id === userId) {
    return myViews.get(applicationId) ?? null;
  }
  return app?.viewed_at ?? null;
}
