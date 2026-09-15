import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createRealtimeChannel } from '@/lib/realtimeChannel';
import { resolveCandidateMedia } from '@/lib/candidateMedia';
import { useAuth } from '@/hooks/useAuth';
import { MyCandidateData, CandidateStage } from '@/hooks/useMyCandidatesData';
import { toast } from 'sonner';
import { prefetchMediaUrl } from '@/hooks/useMediaUrl';
import { AVATAR_TRANSFORM } from '@/lib/mediaPresets';
import { safeReadJsonCache, safeSetItem } from '@/lib/safeStorage';

// Page size for scalable pagination
const PAGE_SIZE = 50;

// Samma lokala snabbcache som din egen lista har: första bilden ritas direkt ur
// cachen och listan hämtas ändå om från databasen i bakgrunden. Nyckeln är egen
// per kollega och lista, så ingens data kan blandas ihop med någon annans.
const COLLEAGUE_CACHE_KEY = 'parium_colleague_candidates_v1_';
const COLLEAGUE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface CachedColleagueCandidates {
  items: MyCandidateData[];
  timestamp: number;
}

function colleagueCacheKey(colleagueId: string, listId: string | null): string {
  return `${COLLEAGUE_CACHE_KEY}${colleagueId}${listId ? `_${listId}` : ''}`;
}

function readColleagueCache(colleagueId: string, listId: string | null): MyCandidateData[] | null {
  const cached = safeReadJsonCache<CachedColleagueCandidates>(
    colleagueCacheKey(colleagueId, listId),
    (value): value is CachedColleagueCandidates => {
      const cache = value as Partial<CachedColleagueCandidates>;
      return Array.isArray(cache.items) && typeof cache.timestamp === 'number';
    },
  );
  if (!cached || Date.now() - cached.timestamp > COLLEAGUE_CACHE_MAX_AGE_MS) return null;
  return cached.items;
}

function writeColleagueCache(colleagueId: string, listId: string | null, items: MyCandidateData[]): void {
  try {
    safeSetItem(
      colleagueCacheKey(colleagueId, listId),
      JSON.stringify({ items: items.slice(0, 100), timestamp: Date.now() }),
    );
  } catch {
    // Storage full — cachen är bara en snabbstart, inte en datakälla.
  }
}

/**
 * Hook to fetch and manage a colleague's candidates.
 * Uses cursor-based pagination for scalability (handles 100k+ candidates).
 */
type ColleagueRow = {
  id: string;
  recruiter_id: string;
  applicant_id: string;
  application_id: string;
  job_id: string | null;
  stage: string;
  notes: string | null;
  rating: number | null;
  created_at: string;
  updated_at: string;
};

export function useColleagueCandidates(
  colleagueId: string | null,
  listId: string | null = null,
  searchQuery: string = '',
) {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<MyCandidateData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  // Markören har id som tiebreaker: en massflytt ger många rader exakt samma
  // updated_at, och utan tiebreaker hoppades rader över mellan sidorna.
  const cursorRef = useRef<{ updated_at: string; id: string } | null>(null);
  // Realtime-uppdateringar och bakgrundsladdningen delade tidigare markör och
  // lista utan ordningsvakt: kom svaren i fel ordning dubblerades eller tappades
  // rader. Varje hämtning får nu ett löpnummer och bara den senaste får skriva.
  const requestSeqRef = useRef(0);
  const inFlightRef = useRef(false);
  const trimmedSearch = searchQuery.trim();

  const fetchColleagueCandidates = useCallback(async (loadMore = false) => {
    if (!colleagueId || !user) {
      setCandidates([]);
      setHasMore(false);
      return;
    }

    // En hämtning i taget. En ny full omladdning får däremot alltid gå före.
    if (inFlightRef.current && loadMore) return;

    const seq = ++requestSeqRef.current;
    inFlightRef.current = true;

    if (!loadMore) {
      setIsLoading(true);
      cursorRef.current = null;
    }

    try {
      const cursor = loadMore ? cursorRef.current : null;
      let myCandidates: ColleagueRow[];

      if (trimmedSearch) {
        // Samma serversökning som i din egen lista — kollegans lista söks alltså
        // i hela databasen, inte bara bland de rader som råkar vara nedladdade.
        const { data, error } = await (supabase.rpc as any)('search_my_candidates', {
          p_recruiter_id: colleagueId,
          p_search_query: trimmedSearch,
          p_limit: PAGE_SIZE,
          p_cursor_updated_at: cursor?.updated_at ?? null,
          p_cursor_id: cursor?.id ?? null,
          p_list_id: listId,
          p_stage: null,
        });
        if (error) throw error;
        myCandidates = ((data || []) as any[]).map((row) => ({
          id: row.my_candidate_id,
          recruiter_id: colleagueId,
          applicant_id: row.applicant_id,
          application_id: row.application_id,
          job_id: row.job_id,
          stage: row.stage,
          notes: row.notes,
          rating: row.rating,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }));
      } else {
        // Build query with cursor-based pagination
        let query = supabase
          .from('my_candidates')
          .select('*')
          .eq('recruiter_id', colleagueId)
          .order('updated_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(PAGE_SIZE);

        // Varje lista har sina egna kandidater
        if (listId) query = query.eq('list_id', listId);

        // Apply cursor for pagination
        if (cursor) {
          query = query.or(
            `updated_at.lt.${cursor.updated_at},and(updated_at.eq.${cursor.updated_at},id.lt.${cursor.id})`,
          );
        }

        const { data, error } = await query;
        if (error) throw error;
        myCandidates = (data || []) as unknown as ColleagueRow[];
      }

      // En nyare hämtning har startat under tiden → kasta det här svaret.
      if (seq !== requestSeqRef.current) return;
      if (!myCandidates || myCandidates.length === 0) {
        if (!loadMore) {
          setCandidates([]);
        }
        setHasMore(false);
        return;
      }

      // Get application IDs to fetch related data
      const applicationIds = myCandidates.map(mc => mc.application_id);

      // Fetch job applications data
      const { data: applications, error: appError } = await supabase
        .from('job_applications')
        .select(`
          id,
          applicant_id,
          first_name,
          last_name,
          email,
          phone,
          location,
          bio,
          cv_url,
          age,
          employment_status,
          work_schedule,
          availability,
          custom_answers,
          questions_snapshot,
          candidate_profile_label,
          profile_image_snapshot_url,
          video_snapshot_url,
          status,
          applied_at,
          viewed_at,
          job_postings!inner(title)
        `)
        .in('id', applicationIds);

      if (appError) throw appError;

      // Create a map for quick lookup
      const appMap = new Map(applications?.map(app => [app.id, app]) || []);

      // Fetch profile media for all applicants in ONE batch call (scales to millions)
      const applicantIds = [...new Set(myCandidates.map(mc => mc.applicant_id))];
      const profileMediaMap: Record<string, { profile_image_url: string | null; video_url: string | null; is_profile_video: boolean | null }> = {};

      // Single batch RPC call instead of N individual calls
      const { data: batchMediaData } = await supabase.rpc('get_applicant_profile_media_batch', {
        p_applicant_ids: applicantIds,
        p_employer_id: user.id,
      });

      if (batchMediaData && Array.isArray(batchMediaData)) {
        batchMediaData.forEach((row: any) => {
          profileMediaMap[row.applicant_id] = {
            profile_image_url: row.profile_image_url,
            video_url: row.video_url,
            is_profile_video: row.is_profile_video,
          };
        });
      }

      // Fill in nulls for any applicants not returned
      applicantIds.forEach((id) => {
        if (!profileMediaMap[id]) {
          profileMediaMap[id] = {
            profile_image_url: null,
            video_url: null,
            is_profile_video: null,
          };
        }
      });

      // Fetch latest activity data (latest_application_at across org + last_active_at)
      const activityMap: Record<string, { latest_application_at: string | null; last_active_at: string | null }> = {};
      const { data: activityData } = await supabase.rpc('get_applicant_latest_activity', {
        p_applicant_ids: applicantIds,
        p_employer_id: user.id,
      });

      if (activityData) {
        activityData.forEach((item: any) => {
          activityMap[item.applicant_id] = {
            latest_application_at: item.latest_application_at,
            last_active_at: item.last_active_at,
          };
        });
      }

      // Kollegans betyg ligger kanoniskt i candidate_ratings (en rad per rekryterare),
      // samma källa som din egen vy använder — den gamla kolumnen kan vara inaktuell.
      const ratingMap: Record<string, number> = {};
      const { data: ratingRows } = await supabase
        .from('candidate_ratings')
        .select('applicant_id, rating')
        .eq('recruiter_id', colleagueId)
        .in('applicant_id', applicantIds);
      (ratingRows || []).forEach((row: any) => {
        ratingMap[row.applicant_id] = Number(row.rating) || 0;
      });

      // Combine the data
      const result: MyCandidateData[] = myCandidates.map(mc => {
        const app = appMap.get(mc.application_id);
        const media = resolveCandidateMedia(app as any, profileMediaMap[mc.applicant_id]);
        const activity = activityMap[mc.applicant_id] || { latest_application_at: null, last_active_at: null };

        return {
          id: mc.id,
          recruiter_id: mc.recruiter_id,
          applicant_id: mc.applicant_id,
          application_id: mc.application_id,
          job_id: mc.job_id,
          stage: mc.stage as CandidateStage,
          notes: mc.notes,
          rating: ratingMap[mc.applicant_id] ?? (mc.rating || 0),
          created_at: mc.created_at,
          updated_at: mc.updated_at,
          first_name: app?.first_name || null,
          last_name: app?.last_name || null,
          email: app?.email || null,
          phone: app?.phone || null,
          location: app?.location || null,
          bio: app?.bio || null,
          cv_url: app?.cv_url || null,
          age: app?.age || null,
          employment_status: app?.employment_status || null,
          work_schedule: app?.work_schedule || null,
          availability: app?.availability || null,
          custom_answers: app?.custom_answers || null,
          questions_snapshot: app?.questions_snapshot || null,
          status: app?.status || 'pending',
          job_title: (app?.job_postings as any)?.title || null,
          profile_image_url: media.profile_image_url,
          video_url: media.video_url,
          is_profile_video: media.is_profile_video,
          applied_at: app?.applied_at || null,
          viewed_at: app?.viewed_at || null,
          latest_application_at: activity.latest_application_at,
          last_active_at: activity.last_active_at,
        };
      });

      // Update cursor for next page
      const lastItem = myCandidates[myCandidates.length - 1];
      cursorRef.current = { updated_at: lastItem.updated_at, id: lastItem.id };
      setHasMore(myCandidates.length === PAGE_SIZE);

      const imagePaths = result
        .map((item) => item.profile_image_url)
        .filter((path): path is string => typeof path === 'string' && path.trim() !== '')
        .slice(0, 12);
      const videoPaths = result
        .filter((item) => item.is_profile_video && item.video_url)
        .map((item) => item.video_url)
        .filter((path): path is string => typeof path === 'string' && path.trim() !== '')
        .slice(0, 8);

      // Matcha CandidateAvatar (40px, 2x retina)
      setTimeout(() => {
        void Promise.allSettled([
          ...imagePaths.map((path) => prefetchMediaUrl(path, 'profile-image', 86400, AVATAR_TRANSFORM)),
          ...videoPaths.map((path) => prefetchMediaUrl(path, 'profile-video')),
        ]);
      }, 0);

      if (loadMore) {
        setCandidates(prev => [...prev, ...result]);
      } else {
        setCandidates(result);
      }
    } catch (error) {
      console.error('Error fetching colleague candidates:', error);
      if (seq === requestSeqRef.current) {
        toast.error('Kunde inte ladda kollegans kandidater');
        if (!loadMore) {
          setCandidates([]);
        }
      }
    } finally {
      inFlightRef.current = false;
      if (seq === requestSeqRef.current) setIsLoading(false);
    }
  }, [colleagueId, listId, user, trimmedSearch]);

  // Ny sökning → ladda om från början (samma beteende som din egen lista).
  useEffect(() => {
    if (!colleagueId) return;
    void fetchColleagueCandidates(false);
  }, [colleagueId, listId, trimmedSearch, fetchColleagueCandidates]);

  // 📡 REALTIME: Prenumerera på kollegans kandidatändringar
  useEffect(() => {
    if (!colleagueId || !user) return;

    const channel = createRealtimeChannel(`colleague-candidates-${colleagueId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'my_candidates',
          filter: `recruiter_id=eq.${colleagueId}`,
        },
        () => {
          // Refresh hela listan vid ändringar
          fetchColleagueCandidates(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [colleagueId, user, fetchColleagueCandidates]);

  // PRE-FETCHING: en sida i förväg så att scrollen känns instant.
  // Taket är nödvändigt: varje laddad sida triggar den här effekten igen, så
  // utan gräns hade hela kollegans lista (kan vara hundratusentals rader)
  // laddats ner i bakgrunden direkt vid öppning. Resten hämtas när användaren
  // faktiskt scrollar (loadMoreCandidates).
  const PREFETCH_LIMIT = PAGE_SIZE * 2;
  useEffect(() => {
    if (hasMore && !isLoading && candidates.length > 0 && candidates.length < PREFETCH_LIMIT) {
      // Small delay to avoid blocking the main thread
      const timer = setTimeout(() => {
        fetchColleagueCandidates(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [candidates.length, hasMore, isLoading, fetchColleagueCandidates, PREFETCH_LIMIT]);

  // Load more candidates (for pagination)
  const loadMoreCandidates = useCallback(() => {
    if (hasMore && !isLoading) {
      fetchColleagueCandidates(true);
    }
  }, [hasMore, isLoading, fetchColleagueCandidates]);

  // Move candidate to different stage (in colleague's list)
  const moveCandidateInColleagueList = async (candidateId: string, newStage: CandidateStage) => {
    const previousCandidates = [...candidates];
    setCandidates(prev => prev.map(c => 
      c.id === candidateId ? { ...c, stage: newStage } : c
    ));

    try {
      // .select() krävs: databasen svarar "inget fel" även när noll rader
      // ändrades (t.ex. om behörigheten till kollegans lista saknas).
      const { data, error } = await supabase
        .from('my_candidates')
        .update({ stage: newStage })
        .eq('id', candidateId)
        .select('id');

      if (error) {
        setCandidates(previousCandidates);
        throw error;
      }
      if (!data || data.length === 0) {
        setCandidates(previousCandidates);
        throw new Error('Kandidaten kunde inte flyttas');
      }
    } catch (error: any) {
      toast.error(error.message || 'Kunde inte flytta kandidaten');
    }
  };

  // Remove candidate from colleague's list
  const removeCandidateFromColleagueList = async (candidateId: string) => {
const previousCandidates = [...candidates];
    setCandidates(prev => prev.filter(c => c.id !== candidateId));

    try {
      const { data, error } = await supabase
        .from('my_candidates')
        .delete()
        .eq('id', candidateId)
        .select('id');

      if (error) {
        setCandidates(previousCandidates);
        throw error;
      }
      if (!data || data.length === 0) {
        setCandidates(previousCandidates);
        throw new Error('Kandidaten kunde inte tas bort');
      }
      toast.success('Kandidat borttagen från kollegans lista');
    } catch (error: any) {
      toast.error(error.message || 'Kunde inte ta bort kandidaten');
    }
  };

  // Add candidate to colleague's list
  const addCandidateToColleagueList = async (
    applicationId: string, 
    applicantId: string, 
    jobId?: string,
    stage: CandidateStage = 'to_contact'
  ) => {
    if (!colleagueId) return;
try {
      const { data, error } = await supabase
        .from('my_candidates')
        .insert({
          recruiter_id: colleagueId,
          applicant_id: applicantId,
          application_id: applicationId,
          job_id: jobId || null,
          stage,
          list_id: listId,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error('Kandidaten finns redan i kollegans lista');
        } else {
          throw error;
        }
        return;
      }

      // Refetch to get full data
      await fetchColleagueCandidates();
      toast.success('Kandidat tillagd i kollegans lista');
    } catch (error: any) {
      toast.error(error.message || 'Kunde inte lägga till kandidaten');
    }
  };

  return {
    candidates,
    setCandidates,
    isLoading,
    hasMore,
    fetchColleagueCandidates,
    loadMoreCandidates,
    moveCandidateInColleagueList,
    removeCandidateFromColleagueList,
    addCandidateToColleagueList,
  };
}
