import { supabase } from '@/integrations/supabase/client';

/**
 * Hämtar kalenderfilen för en intervju som inloggad deltagare och laddar ner
 * den. Filen hämtas med användarens session — ingen öppen länk behövs.
 */
export async function downloadInterviewIcs(interviewId: string): Promise<boolean> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return false;

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-interview-ics?id=${encodeURIComponent(interviewId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) return false;

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `intervju-${interviewId.slice(0, 8)}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch {
    return false;
  }
}
