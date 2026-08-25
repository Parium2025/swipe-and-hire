import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { createRealtimeChannel } from '@/lib/realtimeChannel';
import {
  readCandidateApplicationsCache,
  writeCandidateApplicationsCache,
  fetchApplicationsForApplicant,
} from '@/lib/candidateApplicationsSource';
import type { ApplicationData } from '@/hooks/useApplicationsData';

/**
 * Alla ansökningar för vald kandidat i "Mina kandidater".
 *
 * Delar hämtning, cache och sortering med /candidates via
 * `candidateApplicationsSource` — ingen egen kopia av logiken.
 */
export function useMyCandidateApplications(
  applicantId: string | null,
  dialogOpen: boolean,
  fallback?: {
    profile_image_url?: string | null;
    video_url?: string | null;
    is_profile_video?: boolean | null;
  }
) {
  const { user } = useAuth();
  const userId = user?.id;
  // Cachen läses SYNKRONT vid första render. Tidigare låg läsningen i effekten
  // nedan, vilket gav en första målning utan "X jobb"-badge — den poppade in
  // en frame senare trots att svaret redan fanns lokalt.
  const [allApplications, setAllApplications] = useState<ApplicationData[]>(() =>
    applicantId && dialogOpen ? (readCandidateApplicationsCache(userId, applicantId) ?? []) : []
  );
  const [loading, setLoading] = useState(false);

  // Hooken lever kvar mellan kandidatbyten (dialogen monteras om inte). Därför
  // räcker inte lazy-init: byter man kandidat måste cachen läsas om i
  // renderfasen, annars ritas första framen utan "X jobb".
  const cacheKeyRef = useRef<string | null>(null);
  const currentKey = applicantId && dialogOpen ? `${userId || 'anon'}:${applicantId}` : null;
  if (currentKey !== cacheKeyRef.current) {
    cacheKeyRef.current = currentKey;
    const preloaded = applicantId && dialogOpen
      ? readCandidateApplicationsCache(userId, applicantId)
      : null;
    setAllApplications(preloaded ?? []);
  }

  const readCache = useCallback(
    (aid: string) => readCandidateApplicationsCache(userId, aid),
    [userId]
  );


  useEffect(() => {
    if (!applicantId || !userId || !dialogOpen) {
      setAllApplications([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    // Visa cache direkt
    const cached = readCandidateApplicationsCache(userId, applicantId);
    if (cached?.length) {
      setAllApplications(cached);
    }

    const fetchAll = async () => {
      try {
        const items = await fetchApplicationsForApplicant(userId, applicantId, fallback);
        if (cancelled) return;
        setAllApplications(items);
        if (items.length > 0) writeCandidateApplicationsCache(userId, applicantId, items);
      } catch (error) {
        console.error('Error fetching candidate applications:', error);
        if (!cancelled && !cached?.length) setAllApplications([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();

    // 🔴 Realtime: nya/uppdaterade ansökningar studsar in i öppen dialog
    const channel = createRealtimeChannel(`my-candidate-apps-${applicantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_applications',
          filter: `applicant_id=eq.${applicantId}`,
        },
        () => {
          if (!cancelled) fetchAll();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [applicantId, userId, dialogOpen, fallback?.profile_image_url, fallback?.video_url, fallback?.is_profile_video]);

  return { allApplications, loading, readCache };
}
