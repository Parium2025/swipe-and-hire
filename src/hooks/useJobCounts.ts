import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CITY_BY_SLUG } from '@/data/jobCities';
import { OCCUPATION_BY_SLUG } from '@/data/jobOccupations';

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export interface JobCountsData {
  /** Totalt antal aktiva jobb. */
  total: number;
  /** Antal jobb per city-slug. */
  byCity: Record<string, number>;
  /** Antal jobb per occupation-slug. */
  byOccupation: Record<string, number>;
  /** Antal jobb per "cityslug|occupationslug". */
  byCityOccupation: Record<string, number>;
}

const EMPTY: JobCountsData = {
  total: 0,
  byCity: {},
  byOccupation: {},
  byCityOccupation: {},
};

/**
 * Hämtar antalet aktiva jobb aggregerade per stad, yrke och
 * stad×yrke. Används av SEO-sidor för att visa äkta siffror och
 * inaktivera länkar som leder till tomma sidor.
 *
 * Cache: 5 minuter stale (publik data, ingen användarspecifik filter).
 */
export function useJobCounts() {
  return useQuery<JobCountsData>({
    queryKey: ['seo-job-counts'],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      // Publik funktion — utloggade besökare saknar direktläsning på
      // job_postings och fick tidigare 0 jobb på alla SEO-sidor.
      const { data, error } = await supabase.rpc('get_public_job_facets' as any);

      if (error || !data) return EMPTY;

      const rows = data as Array<{ city: string | null; occupation: string | null; job_count: number }>;

      const result: JobCountsData = {
        total: 0,
        byCity: {},
        byOccupation: {},
        byCityOccupation: {},
      };

      for (const row of rows) {
        const n = Number(row.job_count) || 0;
        result.total += n;
        const cityRaw = (row.city || '').toString().trim();
        const occRaw = (row.occupation || '').toString().trim();
        const citySlug = cityRaw ? slugify(cityRaw) : '';
        const occSlug = occRaw ? slugify(occRaw) : '';

        // Försök matcha mot vår fasta lista över städer / yrken
        const cityKey = citySlug && CITY_BY_SLUG[citySlug] ? citySlug : '';
        const occKey = occSlug && OCCUPATION_BY_SLUG[occSlug] ? occSlug : '';

        if (cityKey) result.byCity[cityKey] = (result.byCity[cityKey] || 0) + n;
        if (occKey) result.byOccupation[occKey] = (result.byOccupation[occKey] || 0) + n;
        if (cityKey && occKey) {
          const k = `${cityKey}|${occKey}`;
          result.byCityOccupation[k] = (result.byCityOccupation[k] || 0) + n;
        }
      }

      return result;
    },
  });
}

/** Hjälpfunktion: hämta antalet jobb för en given (stad, yrke). */
export function getJobCount(
  data: JobCountsData | undefined,
  opts: { citySlug?: string; occupationSlug?: string }
): number {
  if (!data) return 0;
  const { citySlug, occupationSlug } = opts;
  if (citySlug && occupationSlug) {
    return data.byCityOccupation[`${citySlug}|${occupationSlug}`] || 0;
  }
  if (citySlug) return data.byCity[citySlug] || 0;
  if (occupationSlug) return data.byOccupation[occupationSlug] || 0;
  return data.total;
}
