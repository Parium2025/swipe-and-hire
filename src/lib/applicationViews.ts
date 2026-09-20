import { supabase } from '@/integrations/supabase/client';

/**
 * Per-person läsmarkering för ansökningar.
 *
 * Tidigare fanns en enda `viewed_at` per ansökan: den kollega som öppnade
 * kandidaten först nollade prickarna för hela teamet. Nu skrivs en rad per
 * (ansökan, person) i `job_application_views`, så varje teammedlem har sin
 * egen olästa-markering — precis som i en delad inkorg.
 *
 * `job_applications.viewed_at` finns kvar som "någon i teamet har sett" och
 * används av mejlsammanfattningar.
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
