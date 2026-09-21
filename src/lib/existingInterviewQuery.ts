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
