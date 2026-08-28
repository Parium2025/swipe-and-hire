import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Totalt antal profiler inklusive grundprofilen. */
export const MAX_CANDIDATE_PROFILES = 3;
/** Antal extra profiler utöver grundprofilen som kan sparas. */
export const MAX_EXTRA_CANDIDATE_PROFILES = MAX_CANDIDATE_PROFILES - 1;

export interface CandidateProfile {
  id: string;
  user_id: string;
  label: string;
  cv_url: string | null;
  cv_filename: string | null;
  video_url: string | null;
  profile_image_url: string | null;
  cover_image_url: string | null;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CandidateProfileInput {
  label: string;
  cv_url?: string | null;
  cv_filename?: string | null;
  video_url?: string | null;
  profile_image_url?: string | null;
  cover_image_url?: string | null;
  is_default?: boolean;
}

/**
 * Jobbsökarens sparade kandidatprofiler (max 3).
 * Varje profil är en egen kombination av CV, video och profilbild som kan
 * väljas vid ansökan. Vid ansökan tas en ögonblicksbild av vald profil.
 */
export function useCandidateProfiles(userId?: string) {
  const [profiles, setProfiles] = useState<CandidateProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setProfiles([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('candidate_profiles')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      setError(null);
      setProfiles((data ?? []) as CandidateProfile[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const clearDefaults = useCallback(async (exceptId?: string) => {
    if (!userId) return;
    let query = supabase
      .from('candidate_profiles')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true);
    if (exceptId) query = query.neq('id', exceptId);
    await query;
  }, [userId]);

  const createProfile = useCallback(async (input: CandidateProfileInput) => {
    if (!userId) return { error: 'Inte inloggad' } as const;
    if (profiles.length >= MAX_EXTRA_CANDIDATE_PROFILES) {
      return { error: `Du kan ha max ${MAX_CANDIDATE_PROFILES} profiler` } as const;
    }
    const makeDefault = input.is_default || profiles.length === 0;
    if (makeDefault) await clearDefaults();

    const { data, error } = await supabase
      .from('candidate_profiles')
      .insert({
        user_id: userId,
        label: input.label.trim(),
        cv_url: input.cv_url ?? null,
        cv_filename: input.cv_filename ?? null,
        video_url: input.video_url ?? null,
        profile_image_url: input.profile_image_url ?? null,
        cover_image_url: input.cover_image_url ?? null,
        is_default: makeDefault,
        // Undvik kollisioner efter borttagning: alltid högsta sort_order + 1.
        sort_order: profiles.reduce((max, p) => Math.max(max, p.sort_order ?? 0), -1) + 1,
      })
      .select('*')
      .single();

    if (error) return { error: error.message } as const;
    await load();
    return { data: data as CandidateProfile } as const;
  }, [userId, profiles.length, clearDefaults, load]);

  const updateProfile = useCallback(async (id: string, patch: Partial<CandidateProfileInput>) => {
    if (patch.is_default) await clearDefaults(id);
    const { error } = await supabase
      .from('candidate_profiles')
      .update({
        ...patch,
        ...(patch.label !== undefined ? { label: patch.label.trim() } : {}),
      })
      .eq('id', id);
    if (error) return { error: error.message } as const;
    await load();
    return {} as const;
  }, [clearDefaults, load]);

  const deleteProfile = useCallback(async (id: string) => {
    const removed = profiles.find(p => p.id === id);
    const { error } = await supabase.from('candidate_profiles').delete().eq('id', id);
    if (error) return { error: error.message } as const;

    // Se till att det alltid finns en standardprofil kvar.
    if (removed?.is_default) {
      const next = profiles.find(p => p.id !== id);
      if (next) {
        await supabase.from('candidate_profiles').update({ is_default: true }).eq('id', next.id);
      }
    }
    await load();
    return {} as const;
  }, [profiles, load]);

  const setDefaultProfile = useCallback(async (id: string) => {
    await clearDefaults(id);
    const { error } = await supabase
      .from('candidate_profiles')
      .update({ is_default: true })
      .eq('id', id);
    if (error) return { error: error.message } as const;
    await load();
    return {} as const;
  }, [clearDefaults, load]);

  return {
    profiles,
    loading,
    error,
    reload: load,
    createProfile,
    updateProfile,
    deleteProfile,
    setDefaultProfile,
    canCreateMore: profiles.length < MAX_EXTRA_CANDIDATE_PROFILES,
  };
}
