// Hanterar "Bevaka denna sökning"-intent som skickas från SEO-sidor till /auth.
// När användaren loggar in/registrerar sig: skapa saved_search + slussa till returnTo.

import { supabase } from '@/integrations/supabase/client';

const KEY = 'parium-saved-search-intent';

export interface SavedSearchIntent {
  city?: string;
  citySlug?: string;
  occupation?: string;
  occupationSlug?: string;
  returnTo?: string;
}

export function persistIntent(intent: SavedSearchIntent | null | undefined) {
  if (!intent || typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...intent, ts: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function readIntent(): (SavedSearchIntent & { ts?: number }) | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    // Slänger om äldre än 1 timme – då är intent inte längre relevant.
    if (typeof parsed.ts === 'number' && Date.now() - parsed.ts > 60 * 60 * 1000) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearIntent() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Skapar saved_search för intent om den inte redan finns för användaren.
 * Idempotent: dubblerar inte om samma stad+yrke redan finns.
 */
export async function consumeIntent(userId: string): Promise<string | null> {
  const intent = readIntent();
  if (!intent) return null;
  clearIntent();

  const city = intent.city || null;
  const occupation = intent.occupation || null;
  if (!city && !occupation) return intent.returnTo || null;

  try {
    // Kolla om motsvarande sökning redan finns
    const { data: existing } = await supabase
      .from('saved_searches')
      .select('id, city, search_query')
      .eq('user_id', userId);

    const dupe = (existing || []).find(
      (s) =>
        (s.city || '').toLowerCase() === (city || '').toLowerCase() &&
        (s.search_query || '').toLowerCase() === (occupation || '').toLowerCase()
    );

    if (!dupe) {
      const name = [occupation, city].filter(Boolean).join(' · ') || 'Bevakad sökning';
      await supabase.from('saved_searches').insert({
        user_id: userId,
        name,
        city,
        search_query: occupation,
      });
    }
  } catch (err) {
    console.warn('consumeIntent: kunde inte skapa saved_search', err);
  }

  return intent.returnTo || null;
}
