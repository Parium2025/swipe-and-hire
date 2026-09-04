import { useQuery, useQueryClient } from '@tanstack/react-query';
import { safeReadJsonCache, safeSetItem } from '@/lib/safeStorage';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { createRealtimeChannel } from '@/lib/realtimeChannel';
import { useMemo, useEffect } from 'react';
import { isEmployerJobActive, getEmployerJobStatus } from '@/lib/jobStatus';

export interface JobPosting {
  id: string;
  title: string;
  description: string;
  requirements?: string;
  location: string;
  salary_min?: number;
  salary_max?: number;
  salary_type?: string;
  salary_transparency?: string;
  employment_type?: string;
  part_time_days?: string[] | null;
  part_time_shifts?: string[] | null;
  duration_amount?: number | null;
  duration_unit?: string | null;
  work_schedule?: string;
  work_start_time?: string;
  work_end_time?: string;
  positions_count?: number;
  workplace_city?: string;
  workplace_address?: string;
  workplace_postal_code?: string;
  workplace_county?: string;
  workplace_municipality?: string;
  workplace_name?: string;
  contact_email?: string;
  application_instructions?: string;
  is_active: boolean;
  views_count: number;
  applications_count: number;
  removed_applicants_count?: number;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  published_at?: string | null;

  employer_id: string;
  job_image_url?: string;
  company_logo_url?: string;
  overlay_text_color?: string | null;
  image_focus_position?: string;
  job_image_card_url?: string;
  job_image_desktop_url?: string;
  employer_profile?: {
    first_name: string;
    last_name: string;
  };
}

export interface Recruiter {
  id: string;
  first_name: string;
  last_name: string;
}

interface UseJobsDataOptions {
  scope?: 'personal' | 'organization';
  enableRealtime?: boolean;
}

// 🔒 Bakgrundsströmning: en aktiv ström per query-nyckel, med avsvalning efteråt
// så att sidbyten/refetches inte startar om hela genomströmningen i onödan.
const jobStreamRegistry = new Map<string, { running: boolean; completedAt: number; generation?: number }>();
const STREAM_COOLDOWN_MS = 60 * 1000;


// 🔥 localStorage cache for employer jobs - instant-load
// v4: egen nyckel per scope (personal/organization) + kravet på published_at,
// så gamla payloads (före published_at fanns) aldrig kan felklassa annonser.
const EMPLOYER_JOBS_CACHE_KEY = 'parium_employer_jobs_v4_';

const cacheKeyFor = (userId: string, scope: string) => `${EMPLOYER_JOBS_CACHE_KEY}${scope}_${userId}`;

interface CachedJobs {
  jobs: JobPosting[];
  scope: string;
  orgId: string | null;
  timestamp: number;
}

function readJobsCache(userId: string, scope: string, orgId: string | null): JobPosting[] | null {
  const key = cacheKeyFor(userId, scope);
  const cached = safeReadJsonCache<CachedJobs>(key, (value): value is CachedJobs => {
    const candidate = value as Partial<CachedJobs> | null;
    return !!candidate
      && Array.isArray(candidate.jobs)
      && typeof candidate.scope === 'string'
      && (candidate.orgId === null || typeof candidate.orgId === 'string')
      && typeof candidate.timestamp === 'number'
      // Varje rad måste ha statusfälten – annars klassas publicerade annonser som utkast.
      && candidate.jobs.every(j => !!j && typeof j === 'object' && 'published_at' in j && 'expires_at' in j);
  });

  if (!cached || cached.scope !== scope || cached.orgId !== orgId) return null;
  return cached.jobs;
}

function writeJobsCache(userId: string, scope: string, orgId: string | null, jobs: JobPosting[]): void {
  const key = cacheKeyFor(userId, scope);
  // 🔥 SCALE: Cachen får ALDRIG innehålla en trunkerad lista — då visar UI:t
  // "4 av 34". Är datasetet större än vad som ryms i localStorage skippar vi
  // cachen helt och hämtar färskt istället.
  if (jobs.length > 500) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return;
  }
  const cached: CachedJobs = {
    jobs,
    scope,
    orgId,
    timestamp: Date.now(),
  };
  safeSetItem(key, JSON.stringify(cached));
}

/**
 * 🪦 Tombstones: annonser som raderats i den här fliken. En bakgrundsström som
 * redan hunnit läsa raden innan raderingen får aldrig skriva tillbaka den i
 * sin auktoritativa slutskrivning ("ghost job").
 */
const deletedJobIds = new Set<string>();
const DELETED_TTL_MS = 5 * 60 * 1000;

export const dropDeletedJobs = <T extends { id: string }>(rows: T[]): T[] =>
  deletedJobIds.size === 0 ? rows : rows.filter((r) => !deletedJobIds.has(r.id));

const dropDeleted = dropDeletedJobs;

/**
 * Tar bort en annons ur localStorage-cachen direkt vid radering, så den aldrig
 * kan "blinka tillbaka" vid en omladdning innan servern hunnit svara.
 */
export function removeJobFromJobsCache(userId: string, jobId: string): void {
  removeJobsFromJobsCache(userId, [jobId]);
}

/**
 * Massradering: samma tombstone- och localStorage-städning som för en enskild
 * annons, men i ETT svep. Att loopa `removeJobFromJobsCache` skulle parsa och
 * skriva om hela localStorage-cachen en gång per annons (1 000 rader × 1 000
 * annonser = frusen flik).
 */
export function removeJobsFromJobsCache(userId: string, jobIds: string[]): void {
  if (!jobIds.length) return;
  const ids = new Set(jobIds);
  for (const id of ids) {
    deletedJobIds.add(id);
    setTimeout(() => deletedJobIds.delete(id), DELETED_TTL_MS);
  }
  for (const scope of ['personal', 'organization']) {
    const key = cacheKeyFor(userId, scope);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as CachedJobs;
      if (!parsed || !Array.isArray(parsed.jobs)) continue;
      parsed.jobs = parsed.jobs.filter((j) => !ids.has(j?.id));
      safeSetItem(key, JSON.stringify(parsed));
    } catch {
      /* ignore */
    }
  }
}

/**
 * 🔥 SCALE: hämtningen är UPPDELAD PER STATUS.
 *
 * Tidigare strömmade klienten hem varenda icke-raderad annons — med 100 000
 * historiska annonser i ett konto hade webbläsaren fått ladda ner och hålla
 * allihop i minnet. Nu gäller:
 *
 *  - Aktiva: strömmas hem helt (kan aldrig bli fler än några tusen eftersom
 *    en annons går ut efter 14 dagar). Sök/filter/sortering sker direkt i
 *    klienten → 0 ms.
 *  - Utgångna och Utkast: första sidan hämtas direkt (så tabben är förvärmd
 *    och känns instant), resten hämtas sidvis när användaren bläddrar.
 */
export type JobStatusKey = 'active' | 'expired' | 'draft';

const FIRST_PAGE = 200;
const ACTIVE_PAGE_SIZE = 1000;
const ARCHIVE_PAGE_SIZE = 200;
/** Skyddsnät: aktiva annonser kan i praktiken aldrig nå hit (14 dagars livslängd). */
const ACTIVE_STREAM_CAP = 20000;

const JOB_SELECT = `
  *,
  employer_profile:profiles!job_postings_employer_id_fkey (
    first_name,
    last_name
  )
`;

interface JobCursor { created_at: string; id: string }

const cursorOf = (rows: JobPosting[]): JobCursor | null => {
  const last = rows[rows.length - 1];
  return last ? { created_at: last.created_at, id: last.id } : null;
};

const sortJobsDesc = (rows: JobPosting[]): JobPosting[] =>
  rows.sort((a, b) => {
    if (a.created_at === b.created_at) return a.id < b.id ? 1 : -1;
    return a.created_at < b.created_at ? 1 : -1;
  });

/**
 * Statusreglerna speglar `src/lib/jobStatus.ts` exakt, fast i databasen:
 *  - utgången  = publicerad OCH utgångsdatum passerat
 *  - utkast    = inaktiv OCH inte utgången
 *  - aktiv     = aktiv OCH inte utgången
 */
function applyStatusFilter(query: any, status: JobStatusKey, nowIso: string) {
  if (status === 'expired') {
    return query.not('published_at', 'is', null).not('expires_at', 'is', null).lt('expires_at', nowIso);
  }
  const notExpired = `published_at.is.null,expires_at.is.null,expires_at.gte.${nowIso}`;
  if (status === 'active') return query.eq('is_active', true).or(notExpired);
  return query.eq('is_active', false).or(notExpired);
}

async function fetchJobsPage(params: {
  employerIds: string[];
  status: JobStatusKey;
  cursor: JobCursor | null;
  size: number;
}): Promise<JobPosting[]> {
  const { employerIds, status, cursor, size } = params;
  const nowIso = new Date().toISOString();

  let query: any = supabase
    .from('job_postings')
    .select(JOB_SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(size);

  query = applyStatusFilter(query, status, nowIso);

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
    );
  }

  const { data, error } = employerIds.length > 1
    ? await query.in('employer_id', employerIds)
    : await query.eq('employer_id', employerIds[0]);

  if (error) throw error;
  return (data ?? []) as JobPosting[];
}

/** Sidläge för Utgångna/Utkast — en post per query-nyckel och status. */
interface ArchivePageState { cursor: JobCursor | null; done: boolean; loading: boolean }
const archiveRegistry = new Map<string, ArchivePageState>();
const archiveListeners = new Set<() => void>();
const notifyArchive = () => archiveListeners.forEach((l) => l());
const archiveKey = (streamKey: string, status: JobStatusKey) => `${streamKey}|${status}`;

const readArchive = (streamKey: string, status: JobStatusKey): ArchivePageState =>
  archiveRegistry.get(archiveKey(streamKey, status)) ?? { cursor: null, done: false, loading: false };

/** Är `a` längre ner i listan (äldre) än `b`? */
const isDeeper = (a: JobCursor | null, b: JobCursor | null): boolean => {
  if (!a) return false;
  if (!b) return true;
  if (a.created_at !== b.created_at) return a.created_at < b.created_at;
  return a.id < b.id;
};

export const useJobsData = (options: UseJobsDataOptions = { scope: 'personal', enableRealtime: true }) => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { scope, enableRealtime = true } = options;

  // Check for cached data BEFORE query runs
  const hasCachedData = user ? readJobsCache(user.id, scope || 'personal', profile?.organization_id || null) !== null : false;

  // For organization scope, we need to fetch jobs from all users in the same organization
  const { data: jobs = [], isLoading: queryLoading, error, refetch } = useQuery({
    queryKey: ['jobs', scope, profile?.organization_id, user?.id],
    queryFn: async () => {
      if (!user) return [];

      const queryKey = ['jobs', scope, profile?.organization_id, user.id];
      const streamKey = JSON.stringify(queryKey);

      // Resolve scope → user-id-set
      let employerIds: string[] = [user.id];
      if (scope === 'organization' && profile?.organization_id) {
        const { data: orgUsers, error: orgError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('organization_id', profile.organization_id)
          .eq('is_active', true);
        if (orgError) throw orgError;
        const ids = orgUsers?.map(u => u.user_id) ?? [];
        if (ids.length > 0) employerIds = ids;
      }

      // Alla tre statusar hämtas parallellt → tabbarna är förvärmda direkt.
      const [activeFirst, expiredFirst, draftFirst] = await Promise.all([
        fetchJobsPage({ employerIds, status: 'active', cursor: null, size: FIRST_PAGE }),
        fetchJobsPage({ employerIds, status: 'expired', cursor: null, size: FIRST_PAGE }),
        fetchJobsPage({ employerIds, status: 'draft', cursor: null, size: FIRST_PAGE }),
      ]);

      const freshByStatus: Record<JobStatusKey, JobPosting[]> = {
        active: activeFirst,
        expired: expiredFirst,
        draft: draftFirst,
      };

      // Sidläget för arkivtabbarna: behåll ett djupare läge om användaren
      // redan bläddrat, annars börja om från första sidan.
      (['expired', 'draft'] as JobStatusKey[]).forEach((status) => {
        const rows = freshByStatus[status];
        const key = archiveKey(streamKey, status);
        const prev = archiveRegistry.get(key);
        const nextCursor = cursorOf(rows);
        const done = rows.length < FIRST_PAGE;
        if (!done && prev && isDeeper(prev.cursor, nextCursor)) {
          archiveRegistry.set(key, { cursor: prev.cursor, done: prev.done, loading: false });
        } else {
          archiveRegistry.set(key, { cursor: nextCursor, done, loading: false });
        }
      });
      archiveRegistry.set(archiveKey(streamKey, 'active'), {
        cursor: cursorOf(activeFirst),
        done: activeFirst.length < FIRST_PAGE,
        loading: false,
      });
      notifyArchive();

      // 🔒 INVARIANT: listan får ALDRIG krympa av en partiell hämtning.
      // Per status gäller: rader som saknas i det bekräftade fönstret är
      // raderade, medan djupare sidor användaren redan laddat behålls.
      const mergeWithCache = (): JobPosting[] => {
        const fresh = [...activeFirst, ...expiredFirst, ...draftFirst];
        const prev = queryClient.getQueryData<JobPosting[]>(queryKey);
        const byId = new Map<string, JobPosting>();
        for (const row of fresh) byId.set(row.id, row);
        if (!prev || prev.length === 0) return sortJobsDesc(Array.from(byId.values()));

        const floors: Record<JobStatusKey, { floor: string | null; isFull: boolean }> = {
          active: {
            floor: activeFirst[activeFirst.length - 1]?.created_at ?? null,
            isFull: activeFirst.length < FIRST_PAGE,
          },
          expired: {
            floor: expiredFirst[expiredFirst.length - 1]?.created_at ?? null,
            isFull: expiredFirst.length < FIRST_PAGE,
          },
          draft: {
            floor: draftFirst[draftFirst.length - 1]?.created_at ?? null,
            isFull: draftFirst.length < FIRST_PAGE,
          },
        };

        for (const row of prev) {
          if (byId.has(row.id)) continue;
          const status = getEmployerJobStatus(row) as JobStatusKey;
          const { floor, isFull } = floors[status];
          // Hela statusens dataset rymdes i ett svar → saknas raden är den borta.
          if (isFull) continue;
          // Inom det bekräftade fönstret men inte i svaret → raderad.
          if (floor && row.created_at >= floor) continue;
          byId.set(row.id, row);
        }

        return sortJobsDesc(Array.from(byId.values()));
      };

      const merged = dropDeleted(mergeWithCache());

      if (activeFirst.length < FIRST_PAGE) {
        writeJobsCache(user.id, scope || 'personal', profile?.organization_id || null, merged);
        return merged;
      }

      // 🔒 En aktiv-ström per nyckel. Utan detta startar varje sidbyte/refetch
      // en ny full genomströmning av alla sidor.
      const now = Date.now();
      const state = jobStreamRegistry.get(streamKey);
      if (state?.running || (state?.completedAt && now - state.completedAt < STREAM_COOLDOWN_MS)) {
        writeJobsCache(user.id, scope || 'personal', profile?.organization_id || null, merged);
        return merged;
      }

      const generation = (state?.generation ?? 0) + 1;
      jobStreamRegistry.set(streamKey, { running: true, completedAt: state?.completedAt ?? 0, generation });

      // Strömma resten av de AKTIVA annonserna i bakgrunden — blockerar aldrig
      // första renderingen. Utgångna/utkast hämtas istället på begäran.
      setTimeout(() => {
        void (async () => {
        const isCurrent = () => jobStreamRegistry.get(streamKey)?.generation === generation;
        try {
          let all = [...activeFirst];
          let cursor = cursorOf(activeFirst);
          const seen = new Set(all.map((j) => j.id));

          const commit = (rows: JobPosting[]) => {
            if (!isCurrent()) return;
            queryClient.setQueryData(queryKey, (prev: JobPosting[] | undefined) => {
              if (!prev || prev.length === 0) return dropDeleted(rows);
              const byId = new Map(prev.map((j) => [j.id, j] as const));
              for (const row of rows) if (!byId.has(row.id)) byId.set(row.id, row);
              return dropDeleted(sortJobsDesc(Array.from(byId.values())));
            });
          };

          // eslint-disable-next-line no-constant-condition
          while (cursor && all.length < ACTIVE_STREAM_CAP) {
            if (!isCurrent()) return;
            const batch = await fetchJobsPage({ employerIds, status: 'active', cursor, size: ACTIVE_PAGE_SIZE });
            if (batch.length === 0) break;
            const fresh = batch.filter((j) => !seen.has(j.id));
            fresh.forEach((j) => seen.add(j.id));
            all = [...all, ...fresh];
            commit(all);
            if (batch.length < ACTIVE_PAGE_SIZE) break;
            cursor = cursorOf(batch);
          }

          // Auktoritativ slutskrivning för AKTIVA: nu har vi hela den aktiva
          // listan, så aktiva rader som raderats på servern rensas bort.
          // Utgångna/utkast lämnas orörda — de ägs av sin egen sidhämtning.
          if (isCurrent()) {
            const finalActive = dropDeleted(all);
            queryClient.setQueryData(queryKey, (prev: JobPosting[] | undefined) => {
              const byId = new Map<string, JobPosting>();
              for (const row of finalActive) byId.set(row.id, row);
              for (const row of prev ?? []) {
                if (byId.has(row.id)) continue;
                if (getEmployerJobStatus(row) === 'active') continue;
                byId.set(row.id, row);
              }
              const next = dropDeleted(sortJobsDesc(Array.from(byId.values())));
              writeJobsCache(user.id, scope || 'personal', profile?.organization_id || null, next);
              return next;
            });
          }

        } catch {
          // Tyst fel — realtime/refetch återställer, första sidan visas ändå
        } finally {
          if (isCurrent()) {
            jobStreamRegistry.set(streamKey, { running: false, completedAt: Date.now(), generation });
          }
        }
        })();

      }, 0);


      return merged;
    },


    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 min fallback if realtime drops
    gcTime: Infinity, // Keep in cache permanently during session
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    // 🔥 Instant-load from localStorage cache
    initialData: () => {
      if (!user) return undefined;
      const cached = readJobsCache(user.id, scope || 'personal', profile?.organization_id || null);
      return cached ?? undefined;
    },
    initialDataUpdatedAt: () => {
      if (!user) return undefined;
      const cached = readJobsCache(user.id, scope || 'personal', profile?.organization_id || null);
      return cached ? 0 : undefined; // Cache ska visas direkt men alltid valideras i bakgrunden
    },
  });

  // Only show loading if we don't have cached data
  const isLoading = queryLoading && !hasCachedData;

  // Stable set of laddade job_ids för att SCOPE realtime-listenern.
  // 🔥 HÅL #3: Utan detta får varje arbetsgivare ALLA ansökningar i hela
  // systemet via realtime. Med >1000 samtidiga arbetsgivare = bandbredds-helvete.
  // Vi kollar var 5:e sekund om setet ändrats väsentligt → resubscribe.
  const jobIdsKey = useMemo(() => {
    if (!jobs || jobs.length === 0) return '';
    // Sortera för stabil nyckel; cap vid 200 (PostgREST filter-limit komfort).
    // Org med >200 jobb får fortfarande deltas för sina top-200 senaste; resten
    // kommer in via nästa polling/refetch — acceptabelt för UI-counts.
    const ids = jobs.slice(0, 200).map(j => j.id).sort();
    return ids.join(',');
  }, [jobs]);

  // Real-time subscription for job_postings changes
  // 🔥 SCALED: Filter by employer_id to avoid broadcasting all changes to all clients
  useEffect(() => {
    if (!enableRealtime || !user) return;

    // For personal scope, filter realtime to only this employer's jobs
    // For org scope, we still need broader listening but use a unique channel name
    // Varje effect-instans måste ha ett eget kanalnamn. React Strict Mode och
    // snabba dependency-byten kan starta nästa effect innan removeChannel för
    // den föregående är klar; återanvändning av namnet ger då en redan
    // subscribad kanal som inte accepterar fler callbacks.
    const effectInstanceId = crypto.randomUUID();
    const channelSuffix = `${user.id}-${scope}-${effectInstanceId}`;

    // Only filter for personal scope — org scope needs all org members' jobs
    const jobFilter = scope !== 'organization' ? `employer_id=eq.${user.id}` : undefined;

    // 🔥 HÅL #4: Debounce counts/stats invalidations.
    // Vid burst (många jobb-uppdateringar samtidigt) skickar vi MAX 1 invalidate
    // per 3 sekunder. UI:t blir alltid fräscht inom 3s, RPC-trycket sjunker 30×.
    let invalidateStatsTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleStatsInvalidate = () => {
      if (invalidateStatsTimer) return;
      invalidateStatsTimer = setTimeout(() => {
        invalidateStatsTimer = null;
        queryClient.invalidateQueries({ queryKey: ['employer-jobs-counts'] });
        queryClient.invalidateQueries({ queryKey: ['employer-dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['employer-inbox-stats'] });
      }, 3000);
    };

    const channel = createRealtimeChannel(`job-postings-rt-${channelSuffix}`)
      .on(
        'postgres_changes',
        jobFilter
          ? { event: '*' as const, schema: 'public' as const, table: 'job_postings' as const, filter: jobFilter }
          : { event: '*' as const, schema: 'public' as const, table: 'job_postings' as const },
        (payload) => {
          const listKey = ['jobs', scope, profile?.organization_id, user?.id];
          const dropRow = (id?: string) => {
            if (!id) return;
            queryClient.setQueryData(listKey, (oldData: JobPosting[] | undefined) =>
              oldData ? oldData.filter(job => job.id !== id) : oldData
            );
            if (user?.id) removeJobFromJobsCache(user.id, id);
          };

          if (payload.eventType === 'UPDATE') {
            // Serverns applications_count är sanning. Släpp eventuella optimistiska
            // deltas för samma jobb, annars adderas de ovanpå ett redan uppdaterat
            // värde och siffran dubbelräknas tills nästa event kommer in.
            if (payload.new?.id) pendingDeltas.delete(payload.new.id as string);
            // Soft-delete kommer in som UPDATE. Utan detta skulle raden ligga
            // kvar i den sammanslagna listan tills nästa full genomströmning.
            if ((payload.new as { deleted_at?: string | null })?.deleted_at) {
              dropRow(payload.new.id as string);
              scheduleStatsInvalidate();
              return;
            }
            queryClient.setQueryData(listKey, (oldData: JobPosting[] | undefined) => {
              if (!oldData) return oldData;
              return oldData.map(job =>
                job.id === payload.new.id
                  ? { ...job, ...payload.new }
                  : job
              );
            });
            scheduleStatsInvalidate();
          } else {
            if (payload.eventType === 'DELETE') dropRow((payload.old as { id?: string })?.id);
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            scheduleStatsInvalidate();
          }

        }
      )
      .subscribe();

    // 🔥 HÅL #2/#3: Listen to job_applications BARA för våra laddade jobb.
    // Buffra deltas och flush max 1×/sek (oförändrat).
    const pendingDeltas = new Map<string, number>();
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flushDeltas = () => {
      flushTimer = null;
      if (pendingDeltas.size === 0) return;
      const deltas = new Map(pendingDeltas);
      pendingDeltas.clear();
      queryClient.setQueryData(['jobs', scope, profile?.organization_id, user?.id], (oldData: JobPosting[] | undefined) => {
        if (!oldData) return oldData;
        let mutated = false;
        const next = oldData.map(job => {
          const delta = deltas.get(job.id);
          if (!delta) return job;
          mutated = true;
          return { ...job, applications_count: (job.applications_count || 0) + delta };
        });
        return mutated ? next : oldData;
      });
    };

    // Bygg PostgREST in-filter från laddade ids
    const idsArr = jobIdsKey ? jobIdsKey.split(',') : [];
    const appsFilter = idsArr.length > 0 && idsArr.length <= 200
      ? `job_id=in.(${idsArr.join(',')})`
      : undefined;

    const applicationsChannel = createRealtimeChannel(`job-apps-rt-${channelSuffix}`)
      .on(
        'postgres_changes',
        appsFilter
          ? { event: 'INSERT' as const, schema: 'public' as const, table: 'job_applications' as const, filter: appsFilter }
          : { event: 'INSERT' as const, schema: 'public' as const, table: 'job_applications' as const },
        (payload) => {
          const jobId = (payload.new as { job_id?: string })?.job_id;
          if (!jobId) return;
          pendingDeltas.set(jobId, (pendingDeltas.get(jobId) || 0) + 1);
          if (!flushTimer) flushTimer = setTimeout(flushDeltas, 1000);
        }
      )
      .subscribe();

    return () => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushDeltas();
      }
      if (invalidateStatsTimer) {
        clearTimeout(invalidateStatsTimer);
      }
      supabase.removeChannel(channel);
      supabase.removeChannel(applicationsChannel);
    };
  }, [enableRealtime, user, queryClient, scope, profile?.organization_id, jobIdsKey]);

  // Memoize stats to prevent unnecessary recalculations
  const activeJobsList = useMemo(() => 
    jobs.filter(job => isEmployerJobActive(job)), 
    [jobs]
  );
  
  const stats = useMemo(() => ({
    totalJobs: activeJobsList.length,
    activeJobs: activeJobsList.length,
    totalViews: activeJobsList.reduce((sum, job) => sum + (job.views_count || 0), 0),
    totalApplications: activeJobsList.reduce((sum, job) => sum + (job.applications_count || 0), 0),
  }), [activeJobsList]);

  const invalidateJobs = () => {
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
    // Statistikkorten (Annonser/Aktiva/Utgångna/Utkast/Visningar/Ansökningar)
    // hämtas via egna RPC-queries. Utan detta uppdaterades de först när
    // realtime-eventet hann fram (upp till 3s debounce) — eller inte alls.
    queryClient.invalidateQueries({ queryKey: ['employer-jobs-counts'] });
    queryClient.invalidateQueries({ queryKey: ['employer-dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['employer-inbox-stats'] });
  };

  // Get unique recruiters from jobs
  const recruiters: Recruiter[] = useMemo(() => {
    const recruiterMap = new Map<string, Recruiter>();
    
    jobs.forEach(job => {
      if (job.employer_id && job.employer_profile?.first_name && job.employer_profile?.last_name) {
        if (!recruiterMap.has(job.employer_id)) {
          recruiterMap.set(job.employer_id, {
            id: job.employer_id,
            first_name: job.employer_profile.first_name,
            last_name: job.employer_profile.last_name,
          });
        }
      }
    });
    
    return Array.from(recruiterMap.values());
  }, [jobs]);

  return {
    jobs,
    stats,
    recruiters,
    isLoading,
    error,
    refetch,
    invalidateJobs,
  };
};
