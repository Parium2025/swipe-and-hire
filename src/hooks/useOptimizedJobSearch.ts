import { useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getTimeRemaining } from '@/lib/date';
import { expandSearchTerms, detectSalarySearch, allKnownLocationTerms } from '@/lib/smartSearch';
import { safeSetItem } from '@/lib/safeStorage';
import { imageCache } from '@/lib/imageCache';

// 🔥 Offline-cache: senaste lyckade sökresultat per query-nyckel.
// Används som fallback när nätverket är borta så att jobbkort fortfarande
// kan visas. Påverkar inte online-flödet — vi skriver bara över initialData
// när det finns en cache, query:n hämtar nytt så snart nätet finns.
const SEARCH_CACHE_PREFIX = 'parium_job_search_cache_v1_';
const SEARCH_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 dagar

interface CachedSearch {
  jobs: SearchJob[];
  timestamp: number;
}

function searchCacheKey(parts: unknown[]): string {
  try {
    return SEARCH_CACHE_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(parts)))).slice(0, 120);
  } catch {
    return SEARCH_CACHE_PREFIX + JSON.stringify(parts).slice(0, 120);
  }
}

function readSearchCache(key: string): SearchJob[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: CachedSearch = JSON.parse(raw);
    if (!parsed?.jobs || !Array.isArray(parsed.jobs)) return null;
    if (Date.now() - parsed.timestamp > SEARCH_CACHE_TTL) return null;
    return parsed.jobs;
  } catch {
    return null;
  }
}

/**
 * Normalisera en logo-URL till en stabil public-URL som imageCache kan blob-cacha.
 * - Full http(s)-URL → strippa query (signed-tokens m.m.)
 * - Storage-path → konvertera via supabase.storage public URL
 * Returnerar null om vi inte kan ta fram en användbar URL.
 */
function normalizeLogoUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.split('?')[0];
  }
  try {
    const publicUrl = supabase.storage.from('company-logos').getPublicUrl(trimmed).data.publicUrl;
    return publicUrl ? publicUrl.split('?')[0] : null;
  } catch {
    return null;
  }
}

/**
 * 🔥 Förvärm blob-cache med arbetsgivares logotyper för givna sökresultat.
 * Kör i idle/bakgrund — blockerar aldrig render. Effekten:
 *   - Online: nästa render läser logon synkront från blob-cache → noll flimmer.
 *   - Offline: SW + blob-cache har redan blobben → logon visas direkt utan nät.
 */
function warmCompanyLogos(jobs: SearchJob[]): void {
  if (!jobs || jobs.length === 0) return;

  const seen = new Set<string>();
  const urls: string[] = [];
  for (const job of jobs) {
    const normalized = normalizeLogoUrl(job.company_logo_url);
    if (normalized && !seen.has(normalized) && !imageCache.isCached(normalized)) {
      seen.add(normalized);
      urls.push(normalized);
    }
  }
  if (urls.length === 0) return;

  const run = () => {
    void imageCache.preloadImages(urls);
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as any).requestIdleCallback(run, { timeout: 1500 });
  } else {
    setTimeout(run, 0);
  }
}

function writeSearchCache(key: string, jobs: SearchJob[]): void {
  if (!jobs || jobs.length === 0) return;
  // Spara max 60 jobb för att hålla localStorage-fotavtrycket litet
  const trimmed = jobs.slice(0, 60);
  const payload: CachedSearch = { jobs: trimmed, timestamp: Date.now() };
  safeSetItem(key, JSON.stringify(payload));
  // 🔥 Förvärm logotyper i bakgrunden så de finns redo offline
  warmCompanyLogos(trimmed);
}

export interface SearchJob {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  workplace_city: string | null;
  workplace_county: string | null;
  workplace_municipality: string | null;
  workplace_address: string | null;
  workplace_name: string | null;
  workplace_postal_code: string | null;
  employment_type: string | null;
  work_schedule: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_type: string | null;
  salary_transparency: string | null;
  positions_count: number | null;
  occupation: string | null;
  category: string | null;
  pitch: string | null;
  requirements: string | null;
  benefits: string[] | null;
  remote_work_possible: string | null;
  work_location_type: string | null;
  contact_email: string | null;
  application_instructions: string | null;
  job_image_url: string | null;
  job_image_desktop_url: string | null;
  employer_id: string;
  is_active: boolean;
  views_count: number;
  applications_count: number;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  search_rank: number;
  image_focus_position: string;
  company_name: string;
  company_logo_url?: string;
  company_avg_rating?: number;
  company_review_count?: number;
}

interface UseOptimizedJobSearchOptions {
  searchQuery: string;
  city: string;
  employmentTypes: string[];
  category: string;
  subcategories: string[];
  enabled?: boolean;
}

const normalizeSwedish = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/é/g, 'e')
    .replace(/è/g, 'e');
};

const levenshteinDistance = (a: string, b: string): number => {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

const typoCorrections: Record<string, string[]> = {
  utveklare: ['utvecklare'],
  utvekalre: ['utvecklare'],
  utvecklre: ['utvecklare'],
  saljare: ['säljare'],
  saeljare: ['säljare'],
  seljare: ['säljare'],
  ingenjor: ['ingenjör'],
  ingenior: ['ingenjör'],
  ingenjorr: ['ingenjör'],
  sjukskotare: ['sjuksköterska'],
  sjukskoetrska: ['sjuksköterska'],
  sjukskoterska: ['sjuksköterska'],
  larare: ['lärare'],
  laerare: ['lärare'],
  lerare: ['lärare'],
  ekonom: ['ekonom', 'ekonomi'],
  bokforing: ['bokföring'],
  marknadsforing: ['marknadsföring'],
  projektledning: ['projektledare'],
  kundtjanst: ['kundtjänst'],
  lastbilschauffor: ['lastbilschaufför', 'lastbilsförare'],
  chauffeur: ['chaufför', 'förare'],
  forare: ['förare'],
  programerare: ['programmerare'],
  programmare: ['programmerare'],
  adminstrator: ['administratör'],
  assitent: ['assistent'],
  konsullt: ['konsult'],
  recptionist: ['receptionist'],
  chef: ['chef'],
  cheff: ['chef'],
  ledre: ['ledare'],
  teknker: ['tekniker'],
  stocholm: ['stockholm', 'stockholms'],
  stockolm: ['stockholm', 'stockholms'],
  stokholm: ['stockholm', 'stockholms'],
  goteborg: ['göteborg', 'göteborgs'],
  goeteborg: ['göteborg', 'göteborgs'],
  malmo: ['malmö'],
  malmoe: ['malmö'],
  helsingbrog: ['helsingborg'],
  hellsingborg: ['helsingborg'],
  helsingbourg: ['helsingborg'],
  linkoping: ['linköping'],
  linkoepping: ['linköping'],
  jonkoping: ['jönköping'],
  jonkoeping: ['jönköping'],
  norrkoping: ['norrköping'],
  norkoping: ['norrköping'],
  orebro: ['örebro'],
  oerebro: ['örebro'],
  vasteras: ['västerås'],
  vaesteras: ['västerås'],
  umea: ['umeå'],
  lulea: ['luleå'],
  sundvall: ['sundsvall'],
  karlsatd: ['karlstad'],
  vaxjo: ['växjö'],
  vaexjoe: ['växjö'],
  uppsla: ['uppsala'],
  uppsal: ['uppsala'],
};

const expandSearchWithFuzzy = (searchTerm: string): string[] => {
  const normalizedTerm = normalizeSwedish(searchTerm.trim());
  const expandedTerms = new Set(expandSearchTerms(searchTerm));

  for (const [typo, corrections] of Object.entries(typoCorrections)) {
    const maxDistance = normalizedTerm.length <= 4 ? 1 : 2;
    if (levenshteinDistance(normalizedTerm, typo) <= maxDistance) {
      corrections.forEach((correction) => expandedTerms.add(correction));
    }
  }

  if (normalizedTerm.length >= 4) {
    for (const [typo, corrections] of Object.entries(typoCorrections)) {
      if (normalizedTerm.includes(typo) || typo.includes(normalizedTerm)) {
        corrections.forEach((correction) => expandedTerms.add(correction));
      }
    }
  }

  return [...expandedTerms];
};

function mapEmploymentTypes(employmentTypes: string[]) {
  return employmentTypes.map((type) => {
    const typeMap: Record<string, string> = {
      heltid: 'heltid',
      deltid: 'deltid',
      vikariat: 'vikariat',
      provanstallning: 'provanstallning',
      praktik: 'praktik',
      sommarjobb: 'sommarjobb',
      timanstallning: 'timanstallning',
    };

    return typeMap[type] || type;
  });
}

function useSearchParamsState(options: UseOptimizedJobSearchOptions) {
  const { searchQuery, city, employmentTypes, category, subcategories } = options;

  const selectedLocations = useMemo(
    () => city.split(' | ').map((value) => value.trim()).filter(Boolean),
    [city]
  );

  const hasMultipleLocations = selectedLocations.length > 1;
  const primaryLocation = selectedLocations[0] || '';
  const isCounty = primaryLocation.endsWith(' län');
  const baseCityFilter = hasMultipleLocations ? '' : isCounty ? '' : primaryLocation;
  const baseCountyFilter = hasMultipleLocations ? '' : isCounty ? primaryLocation : '';

  const detectedLocationSearch = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed || trimmed.length < 3) return null;
    if (allKnownLocationTerms.has(trimmed)) return trimmed;

    let bestMatch: string | null = null;
    for (const term of allKnownLocationTerms) {
      if (term.startsWith(trimmed) && (!bestMatch || term.length < bestMatch.length)) {
        bestMatch = term;
      }
    }
    if (bestMatch) return bestMatch;

    const normalized = normalizeSwedish(trimmed);
    for (const [typo, corrections] of Object.entries(typoCorrections)) {
      if (normalized === typo || levenshteinDistance(normalized, typo) <= 1) {
        for (const correction of corrections) {
          if (allKnownLocationTerms.has(correction)) return correction;
        }
      }
    }

    for (const term of allKnownLocationTerms) {
      if (normalizeSwedish(term).startsWith(normalized) && (!bestMatch || term.length < bestMatch.length)) {
        bestMatch = term;
      }
    }

    return bestMatch;
  }, [searchQuery]);

  const { expandedSearchQuery, salarySearch } = useMemo(() => {
    if (!searchQuery.trim()) return { expandedSearchQuery: '', salarySearch: null };
    if (detectedLocationSearch) return { expandedSearchQuery: '', salarySearch: null };

    const salaryResult = detectSalarySearch(searchQuery);
    if (salaryResult.isSalarySearch) {
      return { expandedSearchQuery: '', salarySearch: salaryResult };
    }

    return {
      expandedSearchQuery: expandSearchWithFuzzy(searchQuery).join(' '),
      salarySearch: null,
    };
  }, [searchQuery, detectedLocationSearch]);

  const employmentCodes = useMemo(() => mapEmploymentTypes(employmentTypes), [employmentTypes]);

  const categoryFilter = useMemo(() => {
    if (category && category !== 'all' && category !== 'all-categories') return category;
    return '';
  }, [category]);

  const categorySearchTerms = useMemo(() => {
    return subcategories.length > 0 ? subcategories.join(' ') : '';
  }, [subcategories]);

  const cityFilter = useMemo(() => {
    if (detectedLocationSearch && !baseCityFilter) {
      if (detectedLocationSearch.endsWith(' län')) return '';
      return detectedLocationSearch;
    }
    return baseCityFilter;
  }, [detectedLocationSearch, baseCityFilter]);

  const countyFilter = useMemo(() => {
    if (detectedLocationSearch && !baseCountyFilter && detectedLocationSearch.endsWith(' län')) {
      return detectedLocationSearch;
    }
    return baseCountyFilter;
  }, [detectedLocationSearch, baseCountyFilter]);

  const fullSearchQuery = useMemo(() => {
    return [expandedSearchQuery, categorySearchTerms].filter(Boolean).join(' ');
  }, [expandedSearchQuery, categorySearchTerms]);

  return {
    selectedLocations,
    cityFilter,
    countyFilter,
    employmentCodes,
    categoryFilter,
    fullSearchQuery,
    salarySearch,
  };
}

interface JobReviewMap {
  [employerId: string]: {
    avgRating?: number;
    reviewCount: number;
  };
}

interface LiveJobBrandingMap {
  [jobId: string]: Partial<SearchJob>;
}

interface RealtimeJobPosting extends Partial<SearchJob> {
  id: string;
  deleted_at?: string | null;
}

const isRealtimeJobVisible = (job?: RealtimeJobPosting | null) => Boolean(job?.is_active && !job?.deleted_at);

function useCompanyReviews(employerIds: string[]) {
  return useQuery({
    queryKey: ['company-reviews-batch', employerIds],
    queryFn: async (): Promise<JobReviewMap> => {
      if (employerIds.length === 0) return {};

      const { data } = await supabase
        .from('company_reviews')
        .select('company_id, rating')
        .in('company_id', employerIds);

      const ratingsMap: JobReviewMap = {};
      if (data) {
        const acc: Record<string, { total: number; count: number }> = {};
        data.forEach((row) => {
          if (!acc[row.company_id]) acc[row.company_id] = { total: 0, count: 0 };
          acc[row.company_id].total += row.rating;
          acc[row.company_id].count++;
        });

        Object.keys(acc).forEach((id) => {
          ratingsMap[id] = {
            avgRating: acc[id].total / acc[id].count,
            reviewCount: acc[id].count,
          };
        });
      }

      return ratingsMap;
    },
    enabled: employerIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
  });
}

function useLiveJobBranding(jobIds: string[]) {
  return useQuery({
    queryKey: ['search-job-live-branding', jobIds],
    queryFn: async (): Promise<LiveJobBrandingMap> => {
      if (jobIds.length === 0) return {};

      const { data, error } = await supabase
        .from('job_postings')
        .select(`
          id,
          title,
          description,
          location,
          workplace_city,
          workplace_county,
          workplace_municipality,
          workplace_address,
          workplace_name,
          workplace_postal_code,
          employment_type,
          work_schedule,
          salary_min,
          salary_max,
          salary_type,
          salary_transparency,
          positions_count,
          occupation,
          pitch,
          requirements,
          benefits,
          remote_work_possible,
          work_location_type,
          contact_email,
          application_instructions,
          job_image_url,
          job_image_desktop_url,
          employer_id,
          is_active,
          views_count,
          applications_count,
          created_at,
          updated_at,
          expires_at,
          image_focus_position,
          company_logo_url
        `)
        .in('id', jobIds);

      if (error) throw error;

      return (data || []).reduce<LiveJobBrandingMap>((acc, job) => {
        acc[job.id] = {
          ...job,
          company_logo_url: job.company_logo_url || undefined,
        } as Partial<SearchJob>;
        return acc;
      }, {});
    },
    enabled: jobIds.length > 0,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function useOptimizedJobSearch(options: UseOptimizedJobSearchOptions) {
  const { enabled = true } = options;
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    selectedLocations,
    cityFilter,
    countyFilter,
    employmentCodes,
    categoryFilter,
    fullSearchQuery,
    salarySearch,
  } = useSearchParamsState(options);

  const cacheKey = useMemo(
    () => searchCacheKey([
      'optimized-job-search',
      fullSearchQuery,
      cityFilter,
      countyFilter,
      employmentCodes,
      categoryFilter,
      salarySearch?.targetSalary,
      salarySearch?.isMinimumSearch,
    ]),
    [fullSearchQuery, cityFilter, countyFilter, employmentCodes, categoryFilter, salarySearch?.targetSalary, salarySearch?.isMinimumSearch]
  );

  const { data: rawJobs = [], isLoading, error, refetch } = useQuery({
    queryKey: [
      'optimized-job-search',
      fullSearchQuery,
      cityFilter,
      countyFilter,
      employmentCodes,
      categoryFilter,
      salarySearch?.targetSalary,
      salarySearch?.isMinimumSearch,
    ],
    queryFn: async () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      try {
        const { data, error } = await supabase.rpc('search_jobs', {
          p_search_query: fullSearchQuery || null,
          p_city: cityFilter || null,
          p_county: countyFilter || null,
          p_employment_types: employmentCodes.length > 0 ? employmentCodes : null,
          p_category: categoryFilter || null,
          p_salary_min: salarySearch?.isMinimumSearch ? salarySearch.targetSalary : (salarySearch?.targetSalary || null),
          p_salary_max: salarySearch?.isMinimumSearch ? null : (salarySearch?.targetSalary || null),
          p_limit: 100,
          p_offset: 0,
          p_cursor_created_at: null,
        });

        if (error) throw error;
        const jobs = (data || []) as SearchJob[];
        // 🔥 Spara senaste lyckade resultat som offline-fallback
        writeSearchCache(cacheKey, jobs);
        return jobs;
      } catch (err) {
        // Vid nätverksfel: använd cachad data om den finns, annars kasta vidare
        const cached = readSearchCache(cacheKey);
        if (cached && cached.length > 0) {
          // 🔥 Förvärm logotyper även i offline-fallet så blob-cache fylls på
          warmCompanyLogos(cached);
          return cached;
        }
        throw err;
      }
    },
    enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    // 🔥 Visa cachad data direkt (offline eller ej) — query refetchar i bakgrunden
    initialData: () => {
      const cached = readSearchCache(cacheKey);
      if (cached && cached.length > 0) {
        // 🔥 Förvärm logotyper för cachade kort så de renderas utan flimmer
        warmCompanyLogos(cached);
        return cached;
      }
      return undefined;
    },
    initialDataUpdatedAt: () => {
      const cached = readSearchCache(cacheKey);
      // Sätt äldre timestamp så att refetch triggas direkt när nätet finns
      return cached && cached.length > 0 ? Date.now() - 60_000 : undefined;
    },
  });

  const employerIds = useMemo(() => [...new Set(rawJobs.map((job) => job.employer_id).filter(Boolean))], [rawJobs]);
  const jobIds = useMemo(() => [...new Set(rawJobs.map((job) => job.id).filter(Boolean))], [rawJobs]);

  // 🔥 SCALE: useLiveJobBranding togs bort — RPC:n search_jobs returnerar redan
  // workplace_name + company_logo_url + alla branding-fält. Realtime-listenern
  // nedan håller datan färsk om en arbetsgivare byter logo eller namn.
  const { data: reviewsData = {} } = useCompanyReviews(employerIds);

  const enrichedJobs = useMemo(() => {
    const jobs = rawJobs
      .map((job) => {
        return {
          ...job,
          company_name: job.workplace_name?.trim() || 'Okänt företag',
          company_logo_url: job.company_logo_url || undefined,
          company_avg_rating: reviewsData[job.employer_id]?.avgRating,
          company_review_count: reviewsData[job.employer_id]?.reviewCount || 0,
          views_count: job.views_count || 0,
          applications_count: job.applications_count || 0,
        };
      })
      .filter((job) => !getTimeRemaining(job.created_at, job.expires_at).isExpired);

    if (selectedLocations.length <= 1) return jobs;

    return jobs.filter((job) => {
      const searchableFields = [
        job.location,
        job.workplace_city,
        job.workplace_county,
        job.workplace_municipality,
        job.workplace_address,
        job.workplace_name,
      ]
        .filter(Boolean)
        .map((value) => value!.toLowerCase());

      return selectedLocations.some((selectedLocation) => {
        const normalizedSelection = selectedLocation.toLowerCase();
        return searchableFields.some((field) => field === normalizedSelection || field.includes(normalizedSelection));
      });
    });
  }, [rawJobs, liveJobBranding, reviewsData, selectedLocations]);

  useEffect(() => {
    const channel = supabase
      .channel('optimized-search-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_postings' }, (payload) => {
        const nextJob = payload.new as RealtimeJobPosting;
        const previousJob = payload.old as RealtimeJobPosting;

        if (payload.eventType === 'UPDATE') {
          queryClient.setQueriesData<SearchJob[]>({ queryKey: ['optimized-job-search'] }, (existingJobs) => {
            if (!existingJobs) return existingJobs;

            if (!isRealtimeJobVisible(nextJob)) {
              return existingJobs.filter((job) => job.id !== nextJob.id);
            }

            return existingJobs.map((job) => (
              job.id === nextJob.id
                ? {
                    ...job,
                    ...nextJob,
                    company_name: nextJob.workplace_name?.trim() || job.company_name || 'Okänt företag',
                    company_logo_url: nextJob.company_logo_url ?? job.company_logo_url,
                  }
                : job
            ));
          });

          queryClient.setQueriesData<LiveJobBrandingMap>({ queryKey: ['search-job-live-branding'] }, (existingMap) => {
            if (!existingMap) return existingMap;

            if (!isRealtimeJobVisible(nextJob)) {
              if (!(nextJob.id in existingMap)) return existingMap;
              const { [nextJob.id]: _removed, ...rest } = existingMap;
              return rest;
            }

            return {
              ...existingMap,
              [nextJob.id]: {
                ...existingMap[nextJob.id],
                ...nextJob,
                company_logo_url: nextJob.company_logo_url || undefined,
              },
            };
          });
        }

        if (payload.eventType === 'DELETE') {
          queryClient.setQueriesData<SearchJob[]>({ queryKey: ['optimized-job-search'] }, (existingJobs) => {
            if (!existingJobs) return existingJobs;
            return existingJobs.filter((job) => job.id !== previousJob.id);
          });

          queryClient.setQueriesData<LiveJobBrandingMap>({ queryKey: ['search-job-live-branding'] }, (existingMap) => {
            if (!existingMap || !(previousJob.id in existingMap)) return existingMap;
            const { [previousJob.id]: _removed, ...rest } = existingMap;
            return rest;
          });
        }

        queryClient.invalidateQueries({ queryKey: ['optimized-job-search'] });
        queryClient.invalidateQueries({ queryKey: ['search-job-live-branding'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  return {
    jobs: enrichedJobs,
    isLoading,
    error,
    refetch,
    totalCount: enrichedJobs.length,
  };
}

interface UseInfiniteJobSearchOptions extends UseOptimizedJobSearchOptions {
  pageSize?: number;
}

export function useInfiniteJobSearch(options: UseInfiniteJobSearchOptions) {
  const { enabled = true, pageSize = 20 } = options;
  const queryClient = useQueryClient();
  const { cityFilter, countyFilter, employmentCodes, categoryFilter, fullSearchQuery, salarySearch } = useSearchParamsState(options);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: [
      'infinite-job-search',
      fullSearchQuery,
      cityFilter,
      countyFilter,
      employmentCodes,
      categoryFilter,
      salarySearch?.targetSalary,
    ],
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('search_jobs', {
        p_search_query: fullSearchQuery || null,
        p_city: cityFilter || null,
        p_county: countyFilter || null,
        p_employment_types: employmentCodes.length > 0 ? employmentCodes : null,
        p_category: categoryFilter || null,
        p_salary_min: salarySearch?.isMinimumSearch ? salarySearch.targetSalary : (salarySearch?.targetSalary || null),
        p_salary_max: salarySearch?.isMinimumSearch ? null : (salarySearch?.targetSalary || null),
        p_limit: pageSize,
        p_offset: 0,
        p_cursor_created_at: pageParam || null,
      });

      if (error) throw error;
      return (data || []) as SearchJob[];
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < pageSize) return undefined;
      return lastPage[lastPage.length - 1]?.created_at || undefined;
    },
    enabled,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });

  const allJobs = useMemo(() => data?.pages.flat() || [], [data]);

  useEffect(() => {
    const channel = supabase
      .channel('infinite-search-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_postings' }, () => {
        queryClient.invalidateQueries({ queryKey: ['infinite-job-search'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    jobs: allJobs,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    totalCount: allJobs.length,
  };
}

export function useJobSearchCount(options: Omit<UseOptimizedJobSearchOptions, 'enabled'>) {
  const { cityFilter, countyFilter, employmentCodes, categoryFilter, fullSearchQuery, salarySearch } = useSearchParamsState({
    ...options,
    enabled: true,
  });

  const { data: count = 0 } = useQuery({
    queryKey: ['job-search-count', fullSearchQuery, cityFilter, countyFilter, employmentCodes, categoryFilter, salarySearch?.targetSalary],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('count_search_jobs', {
        p_search_query: fullSearchQuery || null,
        p_city: cityFilter || null,
        p_county: countyFilter || null,
        p_employment_types: employmentCodes.length > 0 ? employmentCodes : null,
        p_category: categoryFilter || null,
        p_salary_min: salarySearch?.isMinimumSearch ? salarySearch.targetSalary : (salarySearch?.targetSalary || null),
        p_salary_max: salarySearch?.isMinimumSearch ? null : (salarySearch?.targetSalary || null),
      });

      if (error) {
        console.error('Count search jobs error:', error);
        return 0;
      }

      return data || 0;
    },
    staleTime: 60000,
    gcTime: 5 * 60 * 1000,
  });

  return count;
}
