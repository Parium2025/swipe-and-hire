import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCandidateProfiles, type CandidateProfile } from '@/hooks/useCandidateProfiles';

export interface BaseApplicationProfile {
  label: 'Min profil';
  cv_url: string | null;
  profile_image_url: string | null;
  video_url: string | null;
}

export type ApplicationProfileSelection = CandidateProfile | null;

export function useApplicationProfileSelection(userId?: string) {
  const { profiles, loading: profilesLoading, reload } = useCandidateProfiles(userId);
  const [baseProfile, setBaseProfile] = useState<BaseApplicationProfile>({
    label: 'Min profil',
    cv_url: null,
    profile_image_url: null,
    video_url: null,
  });
  const [baseLoading, setBaseLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [selectionReset, setSelectionReset] = useState(false);

  // Hooken kan leva kvar genom ett kontobyte. Ett val från föregående konto får
  // aldrig användas medan nästa kontos profiler laddas in.
  useEffect(() => {
    setSelectedId(null);
    setInitialized(false);
    setSelectionReset(false);
    setBaseProfile({
      label: 'Min profil',
      cv_url: null,
      profile_image_url: null,
      video_url: null,
    });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setBaseLoading(true);
    supabase.rpc('get_my_profile').then(({ data }) => {
      if (!active) return;
      const rows = data as Array<Record<string, unknown>> | null;
      const row = Array.isArray(rows) ? rows[0] : null;
      setBaseProfile({
        label: 'Min profil',
        cv_url: typeof row?.cv_url === 'string' ? row.cv_url : null,
        profile_image_url: typeof row?.profile_image_url === 'string' ? row.profile_image_url : null,
        video_url: typeof row?.video_url === 'string' ? row.video_url : null,
      });
      setBaseLoading(false);
    }, () => {
      if (active) setBaseLoading(false);
    });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (profilesLoading || initialized) return;
    setSelectedId(profiles.find((profile) => profile.is_default)?.id ?? null);
    setInitialized(true);
  }, [initialized, profiles, profilesLoading]);

  useEffect(() => {
    if (!initialized || selectedId === null || profilesLoading) return;
    if (!profiles.some((profile) => profile.id === selectedId)) {
      setSelectedId(profiles.find((profile) => profile.is_default)?.id ?? null);
      setSelectionReset(true);
    }
  }, [initialized, profiles, profilesLoading, selectedId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`application-profile-selection:${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'candidate_profiles', filter: `user_id=eq.${userId}`,
      }, () => { void reload(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [reload, userId]);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedId) ?? null,
    [profiles, selectedId],
  );

  const selectProfile = useCallback((profile: ApplicationProfileSelection) => {
    setSelectedId(profile?.id ?? null);
    setSelectionReset(false);
  }, []);

  return {
    profiles,
    baseProfile,
    selectedProfile,
    selectedId,
    selectProfile,
    selectionReset,
    clearSelectionReset: () => setSelectionReset(false),
    loading: profilesLoading || baseLoading || !initialized,
  };
}