import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Gemensam källa för "finns det redan ett bokat möte för den här ansökan?".
 *
 * Nyckeln och hämtaren delas av BookInterviewDialog och förvärmningen, så att
 * dialogen kan öppnas färdigifylld (ombokning, tid, plats, meddelande) i stället
 * för att först visa nybokningsläget och sedan hoppa när svaret kommer.
 */
export interface ExistingInterviewRow {
  id: string;
  employer_id: string;
  scheduled_at: string;
  duration_minutes: number | null;
  location_type: string | null;
  location_details: string | null;
  subject: string | null;
  message: string | null;
}

export const existingInterviewQueryKey = (applicationId: string) =>
  ['existing-interview', applicationId] as const;

export async function fetchExistingInterview(
  applicationId: string,
): Promise<ExistingInterviewRow | null> {
  const { data, error } = await supabase
    .from('interviews')
    .select('id, employer_id, scheduled_at, duration_minutes, location_type, location_details, subject, message')
    .eq('application_id', applicationId)
    .in('status', ['pending', 'confirmed'])
    .order('scheduled_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // Ett möte som redan är över ska inte bokas om – då är det ett nytt möte.
  const end = new Date(data.scheduled_at).getTime() + (data.duration_minutes || 30) * 60_000;
  return end > Date.now() ? (data as ExistingInterviewRow) : null;
}

/** Förvärmer cachen så att bokningsdialogen öppnas färdig. */
export function prefetchExistingInterview(queryClient: QueryClient, applicationId?: string | null) {
  if (!applicationId) return;
  void queryClient
    .prefetchQuery({
      queryKey: existingInterviewQueryKey(applicationId),
      queryFn: () => fetchExistingInterview(applicationId),
      staleTime: 30_000,
    })
    .catch(() => {
      // Förvärmning får aldrig störa UI – dialogen hämtar själv vid behov.
    });
}

/**
 * Batchförvärmning för en hel kandidatlista: ETT anrop i stället för ett per rad.
 * Skriver samma nyckel/form som dialogen läser, så "Boka om" öppnas färdigifyllt
 * även när dialogen öppnas direkt med touch (ingen hover att förvärma på).
 */
export async function prewarmExistingInterviews(
  queryClient: QueryClient,
  applicationIds: string[],
): Promise<void> {
  const ids = [...new Set(applicationIds.filter((id): id is string => !!id && id.trim() !== ''))];
  if (ids.length === 0) return;

  try {
    const { data, error } = await supabase
      .from('interviews')
      .select('id, employer_id, application_id, scheduled_at, duration_minutes, location_type, location_details, subject, message')
      .in('application_id', ids)
      .in('status', ['pending', 'confirmed'])
      .order('scheduled_at', { ascending: false });
    if (error) return;

    const now = Date.now();
    const byApplication = new Map<string, ExistingInterviewRow>();
    for (const row of (data || []) as (ExistingInterviewRow & { application_id: string })[]) {
      if (byApplication.has(row.application_id)) continue; // senaste mötet vinner
      const end = new Date(row.scheduled_at).getTime() + (row.duration_minutes || 30) * 60_000;
      if (end <= now) continue; // passerade möten är inte ombokningsbara
      const { application_id, ...interview } = row;
      byApplication.set(application_id, interview as ExistingInterviewRow);
    }

    for (const id of ids) {
      queryClient.setQueryData(existingInterviewQueryKey(id), byApplication.get(id) ?? null);
    }
  } catch {
    // Förvärmning får aldrig störa UI.
  }
}
