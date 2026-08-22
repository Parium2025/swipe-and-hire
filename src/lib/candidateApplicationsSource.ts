import { supabase } from '@/integrations/supabase/client';
import { safeSetItem, safeReadJsonCache } from '@/lib/safeStorage';
import { mapRawToApplicationData } from '@/lib/candidateApplicationMapper';
import type { ApplicationData } from '@/hooks/useApplicationsData';

/**
 * 🎯 EN ENDA SANNING för "alla ansökningar från den här kandidaten".
 *
 * Tidigare fanns två separata implementationer (useCandidateBatchPrefetch för
 * /candidates och useMyCandidateApplications för /my-candidates) med olika
 * cache-nycklar, olika TTL och olika sortering. Det gav olika svar i de två
 * vyerna för exakt samma kandidat. Allt går nu genom den här modulen.
 *
 * Viktigast: jobbomfånget är ORGANISATIONSBRETT, precis som kandidatlistan.
 * Innan detta filtrerades ansökningarna på `employer_id = auth.uid()`, vilket
 * gjorde att en kollegas annonser saknades i "X jobb"-väljaren.
 */

const CACHE_PREFIX = 'candidate_apps_cache_v3_';
/** Hur länge cachen räknas som *färsk* (ingen ny hämtning behövs). */
const CACHE_TTL_MS = 60 * 1000;
/**
 * Hur länge cachen får *visas* medan en ny hämtning pågår
 * (stale-while-revalidate). Utan detta försvann "X jobb"-badgen efter 60 s och
 * blinkade tillbaka när svaret kom — nu ritas rätt siffra direkt.
 */
const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

// Städa bort de två gamla, nu oanvända cacheformaten en gång per session så att
// de inte ligger kvar och äter lagringsutrymme hos befintliga användare.
if (typeof window !== 'undefined') {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('candidate_apps_cache_v1_') || key.startsWith('candidate_apps_cache_v2_')) {
        localStorage.removeItem(key);
      }
    }
  } catch { /* ignore */ }
}

const APPLICATION_COLUMNS = `
  id, job_id, applicant_id, first_name, last_name, email, phone,
  location, bio, cv_url, age, employment_status, work_schedule,
  availability, custom_answers, questions_snapshot, status, applied_at, updated_at,
  profile_image_snapshot_url, video_snapshot_url, candidate_profile_label
`;

interface CachedEnvelope {
  items: ApplicationData[];
  cachedAt: number;
}

const isValidEnvelope = (value: unknown): value is CachedEnvelope => {
  if (!value || typeof value !== 'object') return false;
  const env = value as Partial<CachedEnvelope>;
  return Array.isArray(env.items) && typeof env.cachedAt === 'number';
};

export const candidateAppsCacheKey = (userId: string | undefined, applicantId: string) =>
  `${CACHE_PREFIX}${userId || 'anon'}_${applicantId}`;

/**
 * Läser cachen för visning. Returnerar även äldre (stale) data upp till
 * CACHE_MAX_AGE_MS — anroparen hämtar alltid färskt i bakgrunden ändå.
 */
export function readCandidateApplicationsCache(
  userId: string | undefined,
  applicantId: string,
): ApplicationData[] | null {
  if (!applicantId || typeof window === 'undefined') return null;
  const key = candidateAppsCacheKey(userId, applicantId);
  const env = safeReadJsonCache<CachedEnvelope>(key, isValidEnvelope);
  if (!env || env.items.length === 0) return null;
  if (Date.now() - env.cachedAt > CACHE_MAX_AGE_MS) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return null;
  }
  return env.items;
}

/** True när cachen är färsk nog att slippa en ny hämtning (prefetch-beslut). */
export function isCandidateApplicationsCacheFresh(
  userId: string | undefined,
  applicantId: string,
): boolean {
  if (!applicantId || typeof window === 'undefined') return false;
  const env = safeReadJsonCache<CachedEnvelope>(candidateAppsCacheKey(userId, applicantId), isValidEnvelope);
  if (!env || env.items.length === 0) return false;
  return Date.now() - env.cachedAt <= CACHE_TTL_MS;
}

export function writeCandidateApplicationsCache(
  userId: string | undefined,
  applicantId: string,
  items: ApplicationData[],
) {
  if (!applicantId || items.length === 0 || typeof window === 'undefined') return;
  try {
    safeSetItem(
      candidateAppsCacheKey(userId, applicantId),
      JSON.stringify({ items, cachedAt: Date.now() } satisfies CachedEnvelope),
    );
  } catch { /* storage full — cachen är bara en genväg */ }
}

/** Nyast först. Samma ordning i alla vyer. `id` som tie-break = stabil sortering. */
export function sortApplicationsNewestFirst(items: ApplicationData[]): ApplicationData[] {
  return [...items].sort((a, b) => {
    const da = a.applied_at ? new Date(a.applied_at).getTime() : 0;
    const db = b.applied_at ? new Date(b.applied_at).getTime() : 0;
    if (db !== da) return db - da;
    return (b.id || '').localeCompare(a.id || '');
  });
}

// ── Synligt jobbomfång (org-brett), memoiserat kort ──────────────────

interface JobScope {
  jobIds: string[];
  titleById: Map<string, string>;
}

let jobScopeCache: { userId: string; at: number; scope: JobScope } | null = null;
let jobScopeInFlight: { userId: string; promise: Promise<JobScope> } | null = null;
const JOB_SCOPE_TTL_MS = 60 * 1000;

// PostgREST returnerar max 1000 rader per anrop. Utan paginering trunkeras
// resultatet tyst så fort ett konto passerar 1000 annonser/ansökningar.
const PAGE_ROWS = 1000;
/** Max antal job_id per `in()`-filter så URL:en inte spränger längdgränsen. */
const JOB_ID_CHUNK = 250;
/** Hård säkerhetsspärr så en trasig query aldrig kan loopa i evighet. */
const MAX_ROWS = 50000;

async function fetchAllPages<T>(
  build: (from: number, to: number) => PromiseLike<{ data: any; error: any }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_ROWS) {
    const { data, error } = await build(from, from + PAGE_ROWS - 1);
    if (error) throw error;
    const rows = (data || []) as T[];
    out.push(...rows);
    if (rows.length < PAGE_ROWS) break;
  }
  return out;
}

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};


export function invalidateCandidateJobScope() {
  jobScopeCache = null;
  jobScopeInFlight = null;
}

async function loadJobScope(userId: string): Promise<JobScope> {
  // Alla aktiva medlemmar i samma organisation — samma regel som
  // search_employer_candidates använder på serversidan.
  let employerIds: string[] = [userId];

  const { data: myRole } = await supabase
    .from('user_roles')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .not('organization_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (myRole?.organization_id) {
    const { data: members } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('organization_id', myRole.organization_id)
      .eq('is_active', true);

    if (members?.length) {
      employerIds = Array.from(new Set([userId, ...members.map((m) => m.user_id)]));
    }
  }

  const jobs = await fetchAllPages<{ id: string; title: string }>((from, to) =>
    supabase
      .from('job_postings')
      .select('id, title')
      .in('employer_id', employerIds)
      .order('id', { ascending: true })
      .range(from, to),
  );

  return {
    jobIds: jobs.map((j) => j.id),
    titleById: new Map(jobs.map((j) => [j.id, j.title as string])),
  };
}


export async function getCandidateJobScope(userId: string): Promise<JobScope> {
  if (jobScopeCache && jobScopeCache.userId === userId && Date.now() - jobScopeCache.at < JOB_SCOPE_TTL_MS) {
    return jobScopeCache.scope;
  }
  if (jobScopeInFlight && jobScopeInFlight.userId === userId) {
    return jobScopeInFlight.promise;
  }
  const promise = loadJobScope(userId)
    .then((scope) => {
      jobScopeCache = { userId, at: Date.now(), scope };
      return scope;
    })
    .finally(() => {
      jobScopeInFlight = null;
    });
  jobScopeInFlight = { userId, promise };
  return promise;
}

// ── Hämtning ─────────────────────────────────────────────────────────

interface MediaFallback {
  profile_image_url?: string | null;
  video_url?: string | null;
  is_profile_video?: boolean | null;
}

/**
 * Alla ansökningar för EN kandidat, inom hela organisationens annonser.
 */
export async function fetchApplicationsForApplicant(
  userId: string,
  applicantId: string,
  fallback?: MediaFallback,
): Promise<ApplicationData[]> {
  const scope = await getCandidateJobScope(userId);
  if (scope.jobIds.length === 0) return [];

  const data: any[] = [];
  for (const jobIds of chunk(scope.jobIds, JOB_ID_CHUNK)) {
    const rows = await fetchAllPages<any>((from, to) =>
      supabase
        .from('job_applications')
        .select(APPLICATION_COLUMNS)
        .eq('applicant_id', applicantId)
        .in('job_id', jobIds)
        .order('id', { ascending: true })
        .range(from, to),
    );
    data.push(...rows);
  }


  const mapped = (data || []).map((app: any) =>
    mapRawToApplicationData(app, {
      jobTitle: scope.titleById.get(app.job_id),
      fallbackProfileImageUrl: fallback?.profile_image_url,
      fallbackVideoUrl: fallback?.video_url,
      fallbackIsProfileVideo: fallback?.is_profile_video,
    }),
  );

  return sortApplicationsNewestFirst(mapped);
}

/**
 * Batch: alla ansökningar för många kandidater på en gång (chunkat).
 * Returnerar en map applicant_id → sorterade ansökningar.
 */
export async function fetchApplicationsForApplicants(
  userId: string,
  applicantIds: string[],
  fallbackByApplicant?: Map<string, MediaFallback>,
): Promise<Map<string, ApplicationData[]>> {
  const result = new Map<string, ApplicationData[]>();
  if (applicantIds.length === 0) return result;

  const scope = await getCandidateJobScope(userId);
  if (scope.jobIds.length === 0) return result;

  const rows: any[] = [];

  for (const applicantChunk of chunk(applicantIds, 200)) {
    for (const jobIds of chunk(scope.jobIds, JOB_ID_CHUNK)) {
      const page = await fetchAllPages<any>((from, to) =>
        supabase
          .from('job_applications')
          .select(APPLICATION_COLUMNS)
          .in('applicant_id', applicantChunk)
          .in('job_id', jobIds)
          .order('id', { ascending: true })
          .range(from, to),
      );
      rows.push(...page);
    }
  }


  const grouped = new Map<string, any[]>();
  for (const row of rows) {
    const list = grouped.get(row.applicant_id) || [];
    list.push(row);
    grouped.set(row.applicant_id, list);
  }

  for (const [applicantId, list] of grouped) {
    const fallback = fallbackByApplicant?.get(applicantId);
    const mapped = list.map((app: any) =>
      mapRawToApplicationData(app, {
        jobTitle: scope.titleById.get(app.job_id),
        fallbackProfileImageUrl: fallback?.profile_image_url,
        fallbackVideoUrl: fallback?.video_url,
        fallbackIsProfileVideo: fallback?.is_profile_video,
      }),
    );
    result.set(applicantId, sortApplicationsNewestFirst(mapped));
  }

  return result;
}
