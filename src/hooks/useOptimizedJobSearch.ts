import { APP_RESUME_EVENT } from '@/lib/appResume';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { buildCardImageUrl } from '@/hooks/useCardImage';
import { useAuth } from '@/hooks/useAuth';
import { createBulletproofChannel } from '@/lib/bulletproofChannel';
import { getTimeRemaining } from '@/lib/date';
import { detectSalarySearch, allKnownLocationTerms } from '@/lib/smartSearch';
import { OCCUPATION_CATEGORIES } from '@/lib/occupations';
import { safeSetItem } from '@/lib/safeStorage';
import { imageCache } from '@/lib/imageCache';
import { readThroughCache, clearPersistentCacheByPrefix } from '@/lib/performanceGuards';
import { measurePerformance } from '@/lib/realtimePerformance';
import { resolveCompanyLogoUrl } from '@/lib/companyLogoUrl';
import { typoCorrections, SYNONYM_CLUSTERS } from '../../supabase/functions/_shared/jobSearchLexicon.ts';

// 🔥 Offline-cache: senaste lyckade sökresultat per query-nyckel.
// Används som fallback när nätverket är borta så att jobbkort fortfarande
// kan visas. Påverkar inte online-flödet — vi skriver bara över initialData
// när det finns en cache, query:n hämtar nytt så snart nätet finns.
const SEARCH_CACHE_PREFIX = 'parium_job_search_cache_v1_';
const SEARCH_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 dagar
const HOT_SEARCH_CACHE_PREFIX = 'parium_hot_job_search_v1_';
const HOT_SEARCH_CACHE_TTL = 20 * 1000;
const COUNT_CACHE_PREFIX = 'parium_job_search_count_v1_';
const COUNT_CACHE_TTL = 30 * 1000;

interface CachedSearch {
  jobs: SearchJob[];
  timestamp: number;
}

function cacheKeyWithPrefix(prefix: string, parts: unknown[]): string {
  try {
    return prefix + btoa(unescape(encodeURIComponent(JSON.stringify(parts)))).slice(0, 120);
  } catch {
    return prefix + JSON.stringify(parts).slice(0, 120);
  }
}

function searchCacheKey(parts: unknown[]): string {
  return cacheKeyWithPrefix(SEARCH_CACHE_PREFIX, parts);
}

export function hotSearchCacheKey(parts: unknown[]): string {
  return cacheKeyWithPrefix(HOT_SEARCH_CACHE_PREFIX, parts);
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
function normalizeLogoUrl(job: SearchJob): string | null {
  const raw = job.company_logo_url;
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return resolveCompanyLogoUrl(trimmed);
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
    const normalized = normalizeLogoUrl(job);
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
  duration_amount: number | null;
  duration_unit: string | null;
  part_time_days: string[] | null;
  part_time_shifts: string[] | null;
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
  image_updated_at?: string | null;
  expires_at: string | null;
  start_date: string | null;
  search_rank: number;
  image_focus_position: string;
  image_focus_position_desktop: string;
  company_name: string;
  company_logo_url?: string;
  overlay_text_color?: string | null;
  company_avg_rating?: number;
  company_review_count?: number;
}

export type JobSearchSort = 'newest' | 'oldest' | 'most-views';

/**
 * Keyset-markör. Måste innehålla ALLA fält som ingår i serverns ORDER BY,
 * annars kan rader hoppas över eller dubbleras när flera jobb delar samma
 * created_at (vanligt vid massimport).
 */
interface SearchCursor {
  createdAt: string;
  id: string;
  rank: number;
  views: number;
}

interface UseOptimizedJobSearchOptions {
  searchQuery: string;
  city: string;
  employmentTypes: string[];
  category: string;
  subcategories: string[];
  enabled?: boolean;
  /** 🔥 SCALE: Filtrera på arbetsgivar-ID i DB istället för i klienten. */
  employerIds?: string[];
  /** 🔥 SCALE: ISO-timestamp; jobb skapade efter denna tid filtreras i DB. */
  createdAfter?: string | null;
  /** Antal jobb per batch. Default 100. */
  pageSize?: number;
  /** Sortering körs i databasen — gäller hela resultatet, inte bara laddade sidor. */
  sort?: JobSearchSort;
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

// ─────────────────────────────────────────────────────────────
// TYPO-KORRIGERING: normaliserad token (utan å/ä/ö) → korrekt stavning.
// Används INNAN kluster-expansion. Täcker vanliga svenska felstavningar.
// ─────────────────────────────────────────────────────────────
// typoCorrections + SYNONYM_CLUSTERS delas med bevakningsmatchningen.

// ─────────────────────────────────────────────────────────────
// SYNONYMKLUSTER: ord som betyder ungefär samma sak — söker du på ETT
// får du träffar på ALLA i klustret. Bidirektionellt, expansivt.
// Målet: skriver du "chaufför" ska "Budbilsförare sökes" hittas, och tvärtom.
// ─────────────────────────────────────────────────────────────

// Normalisera ett token (utan Å/Ä/Ö och mellanslag) för uppslag.
const normalizeToken = (t: string): string =>
  t.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/\s+/g, '');

const SEARCH_STOP_WORDS = new Set([
  'i', 'pa', 'på', 'vid', 'och', 'eller', 'med', 'som', 'till', 'for', 'för', 'av', 'en', 'ett', 'den', 'det',
]);

const addTermForms = (target: Set<string>, term: string) => {
  const lower = term.trim().toLowerCase();
  if (!lower) return;

  target.add(lower);
  const normalized = normalizeToken(lower);
  if (normalized) target.add(normalized);

  lower
    .split(/[\s,/()&+-]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !SEARCH_STOP_WORDS.has(normalizeToken(part)))
    .forEach((part) => {
      target.add(part);
      target.add(normalizeToken(part));
    });
};

const OCCUPATION_KNOWN_TERMS = OCCUPATION_CATEGORIES.flatMap((category) => [
  category.label,
  category.value,
  ...category.keywords,
  ...category.subcategories,
]);

// Bygg lookup: normaliserat token → array av alla kluster-medlemmar i både originalform och normaliserad form.
const CLUSTER_LOOKUP: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const cluster of SYNONYM_CLUSTERS) {
    const memberForms = new Set<string>();
    cluster.forEach((term) => addTermForms(memberForms, term));

    const members = Array.from(memberForms).filter((t) => t.length >= 2 && !SEARCH_STOP_WORDS.has(normalizeToken(t)));
    for (const member of members) {
      const key = normalizeToken(member);
      if (!m.has(key)) m.set(key, members);
    }
  }
  return m;
})();

// Pre-computed pool av kända kanoniska termer för Levenshtein-fallback.
const knownCanonicalTerms: string[] = Array.from(
  new Set([
    ...Object.values(typoCorrections).map((v) => normalizeToken(v)),
    ...SYNONYM_CLUSTERS.flat().map((v) => normalizeToken(v)),
    ...OCCUPATION_KNOWN_TERMS.map((v) => normalizeToken(v)),
    ...Array.from(CLUSTER_LOOKUP.keys()),
  ])
).filter((t) => t.length >= 4);

const resolveKnownLocationTerm = (raw: string, allowPrefix = false): string | null => {
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned || cleaned.length < 3) return null;

  const normalized = normalizeSwedish(cleaned);
  const normalizedToken = normalizeToken(cleaned);
  const corrected = typoCorrections[normalizedToken];
  const candidates = [cleaned, normalized, corrected, corrected ? normalizeSwedish(corrected) : null]
    .filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (allKnownLocationTerms.has(candidate)) return candidate;
  }

  let bestMatch: string | null = null;
  for (const term of allKnownLocationTerms) {
    const termNorm = normalizeSwedish(term);
    const exact = candidates.some((candidate) => termNorm === normalizeSwedish(candidate));
    const prefix = allowPrefix && candidates.some((candidate) => termNorm.startsWith(normalizeSwedish(candidate)));
    if ((exact || prefix) && (!bestMatch || term.length < bestMatch.length)) {
      bestMatch = term;
    }
  }

  return bestMatch;
};

const fuzzyFindCanonical = (norm: string): string | null => {
  if (norm.length < 5) return null;
  const allowedDistance = norm.length >= 8 ? 2 : 1;
  let best: { term: string; dist: number } | null = null;

  for (const term of knownCanonicalTerms) {
    if (Math.abs(term.length - norm.length) > allowedDistance) continue;
    if (term[0] !== norm[0] && allowedDistance < 2) continue;
    const dist = levenshteinDistance(term, norm);
    if (dist <= allowedDistance && (!best || dist < best.dist)) {
      best = { term, dist };
    }
  }
  return best ? best.term : null;
};

/**
 * 🔥 Fras-extraktion: hitta plats i multi-word input.
 * "affärsområdeschef i Malmö" → { location: "malmö", rest: "affärsområdeschef" }
 */
export function extractPhraseLocation(searchQuery: string): { location: string; rest: string } | null {
  const trimmed = searchQuery.trim();
  if (!trimmed || !trimmed.includes(' ')) return null;

  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2) return null;

  for (const take of [3, 2, 1]) {
    if (tokens.length <= take) continue;
    const candidateRaw = tokens.slice(-take).join(' ').toLowerCase();
    const candidate = candidateRaw.replace(/^(i|pa|på|vid)\s+/, '').trim();
    if (candidate.length < 3) continue;

    const matchTerm = resolveKnownLocationTerm(candidate);

    if (matchTerm) {
      let rest = tokens.slice(0, -take).join(' ').trim();
      rest = rest.replace(/\s+(i|pa|på|vid)$/i, '').trim();
      return { location: matchTerm, rest };
    }
  }

  return null;
}

/**
 * 🔥 Detektera plats i söksträngen. Enskilt ord eller fras.
 */
export function detectLocationInQuery(searchQuery: string): { location: string; rest: string } | null {
  const trimmed = searchQuery.trim().toLowerCase();
  if (!trimmed || trimmed.length < 3) return null;

  const phrase = extractPhraseLocation(searchQuery);
  if (phrase) return phrase;

  const match = resolveKnownLocationTerm(trimmed, true);
  if (match) return { location: match, rest: '' };

  return null;
}

const stripSwedishEnding = (value: string): string => {
  if (value.length <= 4) return value;
  return value
    .replace(/(ets|ens)$/i, '')
    .replace(/(arnas|ernas|ornas)$/i, '')
    .replace(/(arna|erna|orna)$/i, '')
    .replace(/(ande|ende)$/i, '')
    .replace(/(het|en|et|ar|er|or|s)$/i, '');
};

const getTokenLookupKeys = (token: string): string[] => {
  const norm = normalizeToken(token);
  const stripped = stripSwedishEnding(norm);
  return Array.from(new Set([norm, stripped, typoCorrections[norm] ? normalizeToken(typoCorrections[norm]) : '', typoCorrections[stripped] ? normalizeToken(typoCorrections[stripped]) : '']))
    .filter((key) => key.length >= 2 && !SEARCH_STOP_WORDS.has(key));
};

const addClusterExpansion = (expanded: Set<string>, key: string) => {
  const cluster = CLUSTER_LOOKUP.get(normalizeToken(key));
  if (!cluster) return false;
  for (const member of cluster) expanded.add(member);
  return true;
};

const buildCompoundCandidates = (leftRaw: string, rightRaw: string): string[] => {
  const left = leftRaw.trim().toLowerCase();
  const right = rightRaw.trim().toLowerCase();
  const rightNorm = normalizeToken(right);
  if (!left || !right || SEARCH_STOP_WORDS.has(normalizeToken(left)) || SEARCH_STOP_WORDS.has(rightNorm)) return [];

  const leftBase = left
    .replace(/(ets|ens)$/i, 'e')
    .replace(/(arnas|ernas|ornas)$/i, '')
    .replace(/(arna|erna|orna)$/i, '')
    .replace(/(en|et)$/i, '')
    .replace(/s$/i, '');

  const normalizedBase = stripSwedishEnding(normalizeToken(left));
  return Array.from(new Set([
    `${left}${right}`,
    `${left}s${right}`,
    `${leftBase}${right}`,
    `${leftBase}s${right}`,
    `${normalizedBase}${rightNorm}`,
    `${normalizedBase}s${rightNorm}`,
  ])).filter((candidate) => candidate.length >= 5);
};

/**
 * 🔥 Smart titelsökning — expansiv, bidirektionell, felstavningstolerant.
 *
 * För varje token i inputen:
 *   1. Normalisera (utan å/ä/ö).
 *   2. Kolla typo-korrigering (utveklare → utvecklare).
 *   3. Kolla synonymkluster (chaufför ↔ bud ↔ budbil ↔ kurir ↔ ...).
 *      → Returnerar ALLA kluster-medlemmar så DB:n får OR-match på alla.
 *   4. "s"-suffix (chaufförs → chaufför) fångas.
 *   5. Fuzzy Levenshtein för okända stavfel.
 *
 * Alla utökade termer sammanfogas med mellanslag → DB:ns tsquery blir en OR
 * (via v_or_tsquery i search_jobs-RPC) så jobb som innehåller NÅGON av
 * termerna matchar. Rank prioriterar exakta träffar först.
 */
const smartenTitleQuery = (raw: string): string => {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '';

  const expanded = new Set<string>();

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.length < 2) {
      expanded.add(token);
      continue;
    }
    const norm = normalizeToken(token);
    if (SEARCH_STOP_WORDS.has(norm)) continue;

    // Alltid behåll originaltoken (så användarens exakta stavning finns med).
    expanded.add(token.toLowerCase());
    expanded.add(norm);

    // 1. Typo-korrigering → kanonisk form.
    let canonical = typoCorrections[norm];

    // 2. Prova svensk böjning/genitiv: "chaufförs", "affärsområdets", "elektrikern".
    if (!canonical && norm.length > 4) {
      const stripped = stripSwedishEnding(norm);
      canonical = typoCorrections[stripped];
      if (canonical) expanded.add(stripped);
    }

    if (canonical) {
      expanded.add(canonical);
      expanded.add(normalizeToken(canonical));
    }

    // 3. Synonymkluster (för både originalet och den ev. korrigerade formen).
    const lookupKeys = [...getTokenLookupKeys(token), canonical ? normalizeToken(canonical) : null].filter(Boolean) as string[];
    let foundCluster = false;
    for (const key of lookupKeys) {
      foundCluster = addClusterExpansion(expanded, key) || foundCluster;
    }

    // 4. Fuzzy fallback för okända stavfel.
    if (!canonical && !foundCluster) {
      const fuzzy = lookupKeys.map((key) => fuzzyFindCanonical(key)).find(Boolean) || null;
      if (fuzzy) {
        expanded.add(fuzzy);
        addClusterExpansion(expanded, fuzzy);
      }
    }

    // 5. Svenska sammansättningar: "affärsområdets chef" → "affärsområdeschef".
    const nextToken = tokens[index + 1];
    if (nextToken) {
      for (const compound of buildCompoundCandidates(token, nextToken)) {
        expanded.add(compound);
        expanded.add(normalizeToken(compound));
        const compoundFuzzy = fuzzyFindCanonical(normalizeToken(compound));
        if (compoundFuzzy) {
          expanded.add(compoundFuzzy);
          addClusterExpansion(expanded, compoundFuzzy);
        }
        addClusterExpansion(expanded, compound);
      }
    }
  }

  // Filtrera bort för korta termer och begränsa till max 80 tokens (skydd mot query-explosion).
  const result = Array.from(expanded).filter((t) => t.length >= 2 && !SEARCH_STOP_WORDS.has(normalizeToken(t))).slice(0, 80);
  return result.join(' ');
};

function mapEmploymentTypes(employmentTypes: string[]) {
  return employmentTypes.map((type) => {
    const typeMap: Record<string, string> = {
      full_time: 'full_time',
      heltid: 'full_time',
      part_time: 'part_time',
      deltid: 'part_time',
      contract: 'contract',
      konsult: 'contract',
      temporary: 'temporary',
      vikariat: 'temporary',
      interim: 'interim',
      internship: 'internship',
      praktik: 'internship',
      lia: 'lia',
      summer_job: 'summer_job',
      sommarjobb: 'summer_job',
      timanstallning: 'part_time',
    };

    return typeMap[normalizeSwedish(type).replace(/\s+/g, '_')] || type;
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

  const phraseLocationExtract = useMemo(() => extractPhraseLocation(searchQuery), [searchQuery]);

  const detectedLocationSearch = useMemo(() => {
    // 1. Fras-extraktion har högsta prio
    if (phraseLocationExtract) return phraseLocationExtract.location;

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
    for (const [typo, correction] of Object.entries(typoCorrections)) {
      if (normalized === typo || levenshteinDistance(normalized, typo) <= 1) {
        const locationMatch = resolveKnownLocationTerm(correction);
        if (locationMatch) return locationMatch;
      }
    }

    for (const term of allKnownLocationTerms) {
      if (normalizeSwedish(term).startsWith(normalized) && (!bestMatch || term.length < bestMatch.length)) {
        bestMatch = term;
      }
    }

    return bestMatch;
  }, [searchQuery, phraseLocationExtract]);

  const { expandedSearchQuery, salarySearch } = useMemo(() => {
    if (!searchQuery.trim()) return { expandedSearchQuery: '', salarySearch: null };

    // Fras med plats: sök på RESTEN som titel + använd platsen som filter
    if (phraseLocationExtract && phraseLocationExtract.rest) {
      return {
        expandedSearchQuery: smartenTitleQuery(phraseLocationExtract.rest),
        salarySearch: null,
      };
    }

    if (detectedLocationSearch) return { expandedSearchQuery: '', salarySearch: null };

    const salaryResult = detectSalarySearch(searchQuery);
    if (salaryResult.isSalarySearch) {
      return { expandedSearchQuery: '', salarySearch: salaryResult };
    }

    return {
      expandedSearchQuery: smartenTitleQuery(searchQuery),
      salarySearch: null,
    };
  }, [searchQuery, detectedLocationSearch, phraseLocationExtract]);

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

interface RealtimeJobPosting extends Partial<SearchJob> {
  id: string;
  deleted_at?: string | null;
  published_at?: string | null;
}

const realtimeTimestampChanged = (
  previous?: RealtimeJobPosting | null,
  next?: RealtimeJobPosting | null,
) => previous?.created_at !== next?.created_at || previous?.published_at !== next?.published_at;

/**
 * Sökrelevanta fält: ändras något av dem måste servern räkna om listan, annars
 * kan en redigerad annons ligga kvar på fel plats eller i fel filter.
 */
const REALTIME_SEARCH_FIELDS = [
  'title',
  'occupation',
  'category',
  'employment_type',
  'work_schedule',
  'part_time_shifts',
  'part_time_days',
  'location',
  'workplace_city',
  'workplace_municipality',
  'workplace_county',
  'work_location_type',
  'remote_work_possible',
  'salary_min',
  'salary_max',
  'salary_type',
  'expires_at',
] as const;

const realtimeSearchFieldsChanged = (
  previous?: RealtimeJobPosting | null,
  next?: RealtimeJobPosting | null,
) => {
  if (!previous || !next) return true;
  return REALTIME_SEARCH_FIELDS.some(
    (field) => (previous as any)[field] !== (next as any)[field],
  );
};

/**
 * Måste spegla samma regel som `search_jobs`-RPC:n: publicerad, aktiv, ej
 * raderad OCH ej utgången. Utan expires_at-kontrollen blev en annons som
 * gick ut medan jobbsökaren hade listan öppen kvar i listan tills nästa
 * refetch — sökningen och realtidsströmmen hade två olika sanningar.
 */
/**
 * Letar upp en annons i det redan hämtade sökresultatet. Används som ersättning
 * för `payload.old`, som bara garanterat innehåller primärnyckeln.
 */
const findCachedRealtimeJob = (
  client: ReturnType<typeof useQueryClient>,
  jobId: string,
): RealtimeJobPosting | null => {
  const entries = client.getQueriesData<{ pages: SearchJob[][] }>({ queryKey: ['optimized-job-search'] });
  for (const [, data] of entries) {
    const pages = data?.pages;
    if (!pages) continue;
    for (const page of pages) {
      const hit = page.find((job) => job.id === jobId);
      if (hit) return hit as RealtimeJobPosting;
    }
  }
  return null;
};

const isRealtimeJobVisible = (job?: RealtimeJobPosting | null) => {
  if (!job?.is_active || job?.deleted_at) return false;
  const expiresAt = job.expires_at;
  if (job.published_at && expiresAt) {
    const ts = new Date(expiresAt).getTime();
    if (!Number.isNaN(ts) && ts < Date.now()) return false;
  }
  return true;
};


/**
 * Snittbetyg och antal recensioner räknas i DATABASEN, inte i klienten.
 * Tidigare hämtades varje enskild recensionsrad för alla arbetsgivare i
 * sökresultatet — ett företag med 10 000 recensioner drog då 10 000 rader
 * bara för att visa en stjärna på ett jobbkort. Nu returnerar servern en
 * rad per företag.
 */
function useCompanyReviews(employerIds: string[], isEnabled: boolean) {
  const sortedIds = useMemo(() => [...employerIds].sort(), [employerIds]);
  const idsKey = sortedIds.join(',');

  return useQuery({
    queryKey: ['company-reviews-batch', idsKey],
    queryFn: async (): Promise<JobReviewMap> => {
      if (sortedIds.length === 0) return {};

      const { data, error } = await supabase.rpc('get_company_review_stats_batch', {
        p_company_ids: sortedIds,
      });
      if (error) throw error;

      const ratingsMap: JobReviewMap = {};
      (data || []).forEach((row: { company_id: string; total_count: number | string; avg_rating: number | string | null }) => {
        const count = Number(row.total_count ?? 0);
        if (!row.company_id || count === 0) return;
        ratingsMap[row.company_id] = {
          avgRating: row.avg_rating != null ? Number(row.avg_rating) : undefined,
          reviewCount: count,
        };
      });

      return ratingsMap;
    },
    enabled: isEnabled && sortedIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useOptimizedJobSearch(options: UseOptimizedJobSearchOptions) {
  const { enabled = true, employerIds: employerIdsFilter, createdAfter, pageSize = 100, sort = 'newest' } = options;
  const queryClient = useQueryClient();
  const { user } = useAuth();
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

  // Stabil nyckel för employerIds (sortad) så att vi inte triggar refetch
  // bara för att array-referensen ändras.
  const employerIdsKey = useMemo(() => {
    if (!employerIdsFilter || employerIdsFilter.length === 0) return '';
    return [...employerIdsFilter].sort().join(',');
  }, [employerIdsFilter]);

  const employerIdsArray = useMemo(() => {
    return employerIdsKey ? employerIdsKey.split(',') : null;
  }, [employerIdsKey]);

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
      employerIdsKey,
      createdAfter || '',
      sort,
    ]),
    [fullSearchQuery, cityFilter, countyFilter, employmentCodes, categoryFilter, salarySearch?.targetSalary, salarySearch?.isMinimumSearch, employerIdsKey, createdAfter, sort]
  );

  // 🔥 SCALE: useInfiniteQuery med cursor-paginering på created_at.
  // Första sidan visas direkt; fetchNextPage() laddar nästa batch (default 100)
  // utan att hämta om tidigare sidor. Detta tar bort 100-jobbs-taket och
  // skalar till miljoner rader eftersom DB:n bara läser pageSize rader per call.
  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [
      'optimized-job-search',
      fullSearchQuery,
      cityFilter,
      countyFilter,
      employmentCodes,
      categoryFilter,
      salarySearch?.targetSalary,
      salarySearch?.isMinimumSearch,
      employerIdsKey,
      createdAfter || '',
      sort,
    ],
    queryFn: async ({ pageParam }) => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      const cursor = pageParam as SearchCursor | null;

      try {
        return readThroughCache<SearchJob[]>(
          hotSearchCacheKey([fullSearchQuery, cityFilter, countyFilter, employmentCodes, categoryFilter, salarySearch?.targetSalary, salarySearch?.isMinimumSearch, pageSize, sort, cursor ? `${cursor.createdAt}|${cursor.id}` : '', employerIdsKey, createdAfter || '']),
          HOT_SEARCH_CACHE_TTL,
          async () => {
            const { data, error } = await measurePerformance('search', () => supabase.rpc('search_jobs', {
              p_search_query: fullSearchQuery || null,
              p_city: cityFilter || null,
              p_county: countyFilter || null,
              p_employment_types: employmentCodes.length > 0 ? employmentCodes : null,
              p_category: categoryFilter || null,
              p_salary_min: salarySearch?.isMinimumSearch ? salarySearch.targetSalary : (salarySearch?.targetSalary || null),
              p_salary_max: salarySearch?.isMinimumSearch ? null : (salarySearch?.targetSalary || null),
              p_limit: pageSize,
              p_offset: 0,
              p_cursor_created_at: cursor?.createdAt ?? null,
              p_cursor_id: cursor?.id ?? null,
              p_cursor_rank: cursor?.rank ?? null,
              p_cursor_views: cursor?.views ?? null,
              p_sort: sort,
              p_employer_ids: employerIdsArray,
              p_created_after: createdAfter || null,
            } as any));

            if (error) throw error;
            return (data || []) as unknown as SearchJob[];
          },
          Array.isArray,
        );
      } catch (err) {
        // Vid första sidan + nätverksfel: använd cachad data om den finns
        if (!cursor) {
          const cached = readSearchCache(cacheKey);
          if (cached && cached.length > 0) {
            warmCompanyLogos(cached);
            return cached;
          }
        }
        throw err;
      }
    },
    initialPageParam: null as SearchCursor | null,
    getNextPageParam: (lastPage): SearchCursor | undefined => {
      if (!lastPage || lastPage.length < pageSize) return undefined;
      const last = lastPage[lastPage.length - 1];
      if (!last?.created_at || !last?.id) return undefined;
      return {
        createdAt: last.created_at,
        id: last.id,
        rank: typeof last.search_rank === 'number' ? last.search_rank : 0,
        views: typeof last.views_count === 'number' ? last.views_count : 0,
      };
    },
    enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const rawJobs = useMemo(() => {
    const flat = data?.pages.flat() || [];
    // Persistera första sidan som offline-fallback
    if (flat.length > 0 && (data?.pages.length ?? 0) === 1) {
      writeSearchCache(cacheKey, flat);
    }
    return flat;
  }, [data, cacheKey]);

  const employerIds = useMemo(() => [...new Set(rawJobs.map((job) => job.employer_id).filter(Boolean))], [rawJobs]);
  const jobIds = useMemo(() => [...new Set(rawJobs.map((job) => job.id).filter(Boolean))], [rawJobs]);

  // 🔥 SCALE: useLiveJobBranding togs bort — RPC:n search_jobs returnerar redan
  // workplace_name + company_logo_url + alla branding-fält. Realtime-listenern
  // nedan håller datan färsk om en arbetsgivare byter logo eller namn.
  const { data: reviewsData = {}, isSuccess: reviewsFetched } = useCompanyReviews(employerIds, !!user);

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
  }, [rawJobs, reviewsData, selectedLocations]);

  // Delad, coalesce:ad invalidering. Både den id-filtrerade kanalen (redigerad
  // annons som redan visas) och den breda kanalen (ny/återpublicerad annons)
  // använder samma timer, så flera händelser i följd ger EN refetch.
  //
  // SKALA: en ren debounce som nollställs vid varje händelse skulle kunna svälta
  // helt när tusentals annonser ändras per minut (timern hinner aldrig löpa ut),
  // och samtidigt trigga en refetch-storm hos varje besökare. Därför:
  //  • första händelsen schemalägger en refetch om ~400 ms (samma känsla som förut)
  //  • fler händelser under tiden slås ihop i samma refetch
  //  • som mest en refetch var 5:e sekund
  //  • i dold flik väntar vi till användaren är tillbaka
  const invalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInvalidateAtRef = useRef(0);
  const pendingWhileHiddenRef = useRef(false);
  const MIN_INVALIDATE_INTERVAL_MS = 5000;

  const runSearchInvalidate = useCallback(() => {
    invalidateTimerRef.current = null;
    lastInvalidateAtRef.current = Date.now();
    // Viktigt: den korta hot-cachen måste tömmas först, annars läser
    // refetchen tillbaka exakt samma gamla resultat och listan står still.
    clearPersistentCacheByPrefix(HOT_SEARCH_CACHE_PREFIX);
    queryClient.invalidateQueries({ queryKey: ['optimized-job-search'] });
  }, [queryClient]);

  const scheduleSearchInvalidate = useCallback(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      pendingWhileHiddenRef.current = true;
      return;
    }
    if (invalidateTimerRef.current) return;
    const sinceLast = Date.now() - lastInvalidateAtRef.current;
    const wait = Math.max(400, MIN_INVALIDATE_INTERVAL_MS - sinceLast);
    invalidateTimerRef.current = setTimeout(runSearchInvalidate, wait);
  }, [runSearchInvalidate]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (!pendingWhileHiddenRef.current) return;
      pendingWhileHiddenRef.current = false;
      scheduleSearchInvalidate();
    };
    // Efter en stund i bakgrunden kan realtime ha missat ändringar: hämta om listan
    // så att annonsvyn får färsk data att visa direkt.
    const onResume = () => {
      pendingWhileHiddenRef.current = false;
      scheduleSearchInvalidate();
      void queryClient.invalidateQueries({ queryKey: ['company-reviews-batch'] });
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(APP_RESUME_EVENT, onResume);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(APP_RESUME_EVENT, onResume);
    };
  }, [scheduleSearchInvalidate, queryClient]);

  useEffect(() => () => {
    if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
  }, []);


  // 🔥 SCALE: Realtime-listenern är scope:ad till de jobb som faktiskt visas.
  // PostgREST in.()-filter cap:as på 200 ids; vi prenumererar på max 200 av
  // de mest relevanta (första sidan), inte hela det infinitivt växande resultatet.
  const realtimeJobIdsKey = useMemo(() => {
    if (jobIds.length === 0) return '';
    return jobIds.slice(0, 200).sort().join(',');
  }, [jobIds]);


  useEffect(() => {
    if (!realtimeJobIdsKey) return;
    const ids = realtimeJobIdsKey.split(',');
    const filter = `id=in.(${ids.join(',')})`;

    return createBulletproofChannel({
      channelName: `optimized-search-realtime-${ids.length}`,
      subscriptions: [{
        event: '*',
        schema: 'public',
        table: 'job_postings',
        filter,
        callback: (payload) => {
          const nextJob = payload.new as RealtimeJobPosting;
          const previousJob = payload.old as RealtimeJobPosting;

          if (payload.eventType === 'UPDATE') {
            queryClient.setQueriesData<{ pages: SearchJob[][]; pageParams: unknown[] }>(
              { queryKey: ['optimized-job-search'] },
              (existing) => {
                if (!existing?.pages) return existing;
                return {
                  ...existing,
                  pages: existing.pages.map((page) => {
                    if (!isRealtimeJobVisible(nextJob)) {
                      return page.filter((job) => job.id !== nextJob.id);
                    }
                    return page.map((job) => (
                      job.id === nextJob.id
                        ? {
                            ...job,
                            ...nextJob,
                            company_name: nextJob.workplace_name?.trim() || (job as any).company_name || 'Okänt företag',
                            company_logo_url: nextJob.company_logo_url ?? job.company_logo_url,
                          }
                        : job
                    ));
                  }),
                };
              }
            );
            // Patchen ovan ger omedelbar visuell uppdatering, men en redigerad
            // annons kan ha bytt ort, yrke, lön eller titel — och matchar då
            // kanske inte längre sökningen (eller sorteras om). Därför låter vi
            // alltid servern räkna om resultatet direkt efteråt (debounce:at).
            scheduleSearchInvalidate();
          }

          if (payload.eventType === 'DELETE') {
            queryClient.setQueriesData<{ pages: SearchJob[][]; pageParams: unknown[] }>(
              { queryKey: ['optimized-job-search'] },
              (existing) => {
                if (!existing?.pages) return existing;
                return {
                  ...existing,
                  pages: existing.pages.map((page) => page.filter((job) => job.id !== previousJob.id)),
                };
              }
            );
          }
        },
      }],
    });
  }, [queryClient, realtimeJobIdsKey, scheduleSearchInvalidate]);


  // 🆕 Nya annonser: id-filtrerade kanalen ovan kan per definition inte se rader
  // som ännu inte finns i resultatet. En separat lyssnare håller listan live.
  // Vi lyssnar på både INSERT (helt nya annonser) och UPDATE (t.ex. återpublicering
  // eller status active) — en annons som blir synlig men saknas i resultatet
  // triggar en invalidering så att den dyker upp utan omladdning.
  useEffect(() => {
    const scheduleInvalidate = scheduleSearchInvalidate;

    const cleanupChannel = createBulletproofChannel({
      channelName: 'optimized-search-new-jobs',
      subscriptions: [
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_postings',
          callback: (payload) => {
          if (!isRealtimeJobVisible(payload.new as RealtimeJobPosting)) return;
          scheduleInvalidate();
          },
        },
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_postings',
          callback: (payload) => {
            const nextJob = payload.new as RealtimeJobPosting;
            if (!nextJob?.id || !isRealtimeJobVisible(nextJob)) return;

            // Vi jämför mot vårt EGET cachade tillstånd i stället för payload.old.
            // Skälet: payload.old innehåller bara primärnyckeln om tabellen inte
            // kör REPLICA IDENTITY FULL. Genom att läsa cachen fungerar logiken
            // med båda inställningarna — och databasen slipper skriva hela den
            // gamla raden till WAL vid varje uppdatering.
            const cachedJob = findCachedRealtimeJob(queryClient, nextJob.id);

            // Återpublicering behåller samma ID för att alla ansökningar,
            // meddelanden och urval ska ligga kvar. RPC:n flyttar created_at och
            // published_at till nu, vilket är den stabila realtidssignalen för
            // att samma rad ska behandlas som en helt ny annons i sökresultatet.
            // En redigerad annons som ännu inte finns i resultatet (cachedJob=null)
            // kan ha börjat matcha sökningen — då räknar servern om listan.
            // Den id-filtrerade kanalen täcker bara de 200 första annonserna i
            // listan. En redigerad annons längre ner måste därför fångas här:
            // om något sökrelevant fält skiljer sig mot vår cache räknar servern
            // om listan så sortering, filter och visat innehåll blir korrekt.
            if (
              !cachedJob ||
              realtimeTimestampChanged(cachedJob, nextJob) ||
              realtimeSearchFieldsChanged(cachedJob, nextJob)
            ) {
              scheduleInvalidate();
            }

          },
        },
      ],
    });

    return cleanupChannel;
  }, [queryClient, scheduleSearchInvalidate]);





  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  return {
    jobs: enrichedJobs,
    isLoading,
    companyReviewsReady: employerIds.length === 0 || reviewsFetched,
    error,
    refetch,
    totalCount: enrichedJobs.length,
    fetchNextPage,
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
  };
}
