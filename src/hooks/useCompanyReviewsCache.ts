import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createRealtimeChannel } from '@/lib/realtimeChannel';
import { useAuth } from '@/hooks/useAuth';
import { useCallback, useEffect, useState } from 'react';
import { safeSetItem } from '@/lib/safeStorage';

export interface CachedReview {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  is_anonymous: boolean;
  created_at: string;
  profiles?: {
    first_name?: string;
    last_name?: string;
  };
}

interface CompanyReviewsData {
  reviews: CachedReview[];
  avgRating: number | undefined;
  /** Totalt antal recensioner i databasen (inte bara de hämtade). */
  reviewCount: number;
}

const CACHE_KEY = 'parium_company_reviews_cache';
// Sidstorlek: första sidan laddas direkt, "Visa fler" hämtar nästa sida.
// Håller vyn snabb även för företag med tusentals recensioner.
const PAGE_SIZE = 50;

// LocalStorage cache helpers - NO EXPIRY, always syncs in background
const getLocalCache = (companyId: string): { data: CompanyReviewsData; timestamp: number } | null => {
  const key = `${CACHE_KEY}_${companyId}`;
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    // Validera struktur — annars är cachen korrupt
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !parsed.data ||
      typeof parsed.data !== 'object' ||
      !Array.isArray(parsed.data.reviews)
    ) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      return null;
    }
    return parsed;
  } catch (e) {
    console.warn('Failed to read reviews cache:', e);
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return null;
  }
};

const setLocalCache = (companyId: string, data: CompanyReviewsData) => {
  try {
    safeSetItem(`${CACHE_KEY}_${companyId}`, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch (e) {
    console.warn('Failed to write reviews cache:', e);
  }
};

/** Hämta en sida recensioner + berika med profilnamn för icke-anonyma. */
async function fetchReviewsPage(companyId: string, from: number, to: number): Promise<CachedReview[]> {
  const { data: reviews, error } = await supabase
    .from('company_reviews_public')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    // Tiebreak så att sidorna inte kan tappa eller dubblera ett omdöme.
    .order('id', { ascending: false })
    .range(from, to);

  if (error) throw error;
  if (!reviews || reviews.length === 0) return [];

  const userIds = reviews.filter(r => !r.is_anonymous).map(r => r.user_id);
  if (userIds.length === 0) return reviews as CachedReview[];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name')
    .in('user_id', userIds);

  if (!profiles) return reviews as CachedReview[];

  const profileMap = new Map(profiles.map(p => [p.user_id, p]));
  return reviews.map(r => ({
    ...r,
    profiles: profileMap.get(r.user_id) || undefined,
  })) as CachedReview[];
}

/** Hämta totala antalet + snittbetyg över ALLA recensioner (serverräknat). */
async function fetchReviewStats(companyId: string): Promise<{ total: number; avg: number | undefined }> {
  const { data, error } = await supabase.rpc('get_company_review_stats', {
    p_company_id: companyId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const total = Number(row?.total_count ?? 0);
  const avg = row?.avg_rating != null ? Number(row.avg_rating) : undefined;
  return { total, avg };
}

/**
 * Förvärmning av recensionssidan (/reviews).
 *
 * Skriver EXAKT samma format till samma localStorage-cache och query-nyckel
 * som `useCompanyReviewsCache` läser, så vyn målas direkt vid första besöket
 * i stället för att visa skelett. Felar tyst — sidan hämtar själv vid behov.
 */
export async function prewarmCompanyReviews(
  queryClient: QueryClient,
  companyId?: string | null,
): Promise<void> {
  if (!companyId) return;
  if (queryClient.getQueryData(['company-reviews-cached', companyId])) return;

  try {
    const [reviews, stats] = await Promise.all([
      fetchReviewsPage(companyId, 0, PAGE_SIZE - 1),
      fetchReviewStats(companyId),
    ]);
    const result: CompanyReviewsData = {
      reviews,
      avgRating: stats.avg,
      reviewCount: stats.total,
    };
    setLocalCache(companyId, result);
    queryClient.setQueryData(['company-reviews-cached', companyId], result);
  } catch {
    // Tyst — förvärmning får aldrig störa UI.
  }
}

/**
 * Hook to get cached company reviews with instant load from localStorage
 * and background sync with the database.
 *
 * Första sidan (50 senaste) hämtas direkt. hasMore/loadMore hämtar nästa
 * sida vid behov — snittbetyg och totalräkning kommer alltid från servern
 * och gäller samtliga recensioner, inte bara de hämtade.
 */
export function useCompanyReviewsCache(companyId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { data, isLoading, refetch } = useQuery<CompanyReviewsData>({
    queryKey: ['company-reviews-cached', companyId],
    queryFn: async () => {
      if (!companyId) return { reviews: [], avgRating: undefined, reviewCount: 0 };

      const [reviews, stats] = await Promise.all([
        fetchReviewsPage(companyId, 0, PAGE_SIZE - 1),
        fetchReviewStats(companyId),
      ]);

      const result: CompanyReviewsData = {
        reviews,
        avgRating: stats.avg,
        reviewCount: stats.total,
      };

      // Cacha bara första sidan + statistik — aldrig en obegränsad lista.
      setLocalCache(companyId, result);

      return result;
    },
    enabled: !!companyId && !!user,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 10 * 60 * 1000, // 10 minutes
    // Initialize with localStorage cache for instant load
    initialData: () => {
      if (!companyId) return undefined;
      const cached = getLocalCache(companyId);
      return cached?.data;
    },
    initialDataUpdatedAt: () => {
      if (!companyId) return undefined;
      const cached = getLocalCache(companyId);
      return cached?.timestamp;
    },
  });

  // 📡 REALTIME: Prenumerera på recensionsändringar för detta företag
  useEffect(() => {
    if (!companyId) return;

    const channel = createRealtimeChannel(`company-reviews-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_reviews',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          // Invalidera cache och hämta färsk data
          queryClient.invalidateQueries({ queryKey: ['company-reviews-cached', companyId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, queryClient]);

  // Hämta nästa sida och lägg till i cachen (visas direkt, skrivs inte till localStorage)
  const loadMore = useCallback(async () => {
    if (!companyId) return;
    const current = queryClient.getQueryData<CompanyReviewsData>(['company-reviews-cached', companyId]);
    if (!current) return;
    if (current.reviews.length >= current.reviewCount) return;

    setIsLoadingMore(true);
    try {
      const from = current.reviews.length;
      const nextPage = await fetchReviewsPage(companyId, from, from + PAGE_SIZE - 1);
      if (nextPage.length > 0) {
        queryClient.setQueryData<CompanyReviewsData>(
          ['company-reviews-cached', companyId],
          { ...current, reviews: [...current.reviews, ...nextPage] }
        );
      } else {
        // Servern säger att det finns fler men sidan kom tillbaka tom —
        // räkna om totalen så knappen inte loopar.
        const stats = await fetchReviewStats(companyId);
        queryClient.setQueryData<CompanyReviewsData>(
          ['company-reviews-cached', companyId],
          { ...current, reviewCount: Math.min(current.reviews.length, stats.total), avgRating: stats.avg }
        );
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [companyId, queryClient]);

  // Prefetch reviews for a company (call when hovering over company card)
  const prefetchReviews = useCallback((targetCompanyId: string) => {
    if (!user?.id) return Promise.resolve();
    queryClient.prefetchQuery({
      queryKey: ['company-reviews-cached', targetCompanyId],
      queryFn: async () => {
        const [reviews, stats] = await Promise.all([
          fetchReviewsPage(targetCompanyId, 0, PAGE_SIZE - 1),
          fetchReviewStats(targetCompanyId),
        ]);

        const result: CompanyReviewsData = {
          reviews,
          avgRating: stats.avg,
          reviewCount: stats.total,
        };

        setLocalCache(targetCompanyId, result);
        return result;
      },
      staleTime: 30 * 1000,
    });
  }, [queryClient, user?.id]);

  return {
    reviews: data?.reviews || [],
    avgRating: data?.avgRating,
    reviewCount: data?.reviewCount || 0,
    isLoading: isLoading && !data,
    refetch,
    prefetchReviews,
    hasMore: (data?.reviews.length ?? 0) < (data?.reviewCount ?? 0),
    loadMore,
    isLoadingMore,
  };
}

/**
 * Batch prefetch reviews for multiple companies.
 * Call this when loading job search results.
 */
export function useBatchPrefetchReviews() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useCallback(async (companyIds: string[]) => {
    if (!user?.id || companyIds.length === 0) return;

    // Only prefetch for companies not already cached
    const uncachedIds = companyIds.filter(id => {
      const cached = queryClient.getQueryData(['company-reviews-cached', id]);
      return !cached && !getLocalCache(id);
    });

    if (uncachedIds.length === 0) return;

    // Batch fetch all reviews at once
    const { data: allReviews } = await supabase
      .from('company_reviews_public')
      .select('*')
      .in('company_id', uncachedIds)
      .order('created_at', { ascending: false })
      // Förhämtning ska vara billig — aldrig en obegränsad payload.
      .limit(600);

    if (!allReviews) return;

    // Get unique user ids for profile fetching
    const userIds = [...new Set(
      allReviews
        .filter(r => !r.is_anonymous)
        .map(r => r.user_id)
    )];

    let profileMap = new Map<string, { first_name?: string; last_name?: string }>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);

      if (profiles) {
        profileMap = new Map(profiles.map(p => [p.user_id, p]));
      }
    }

    // Hämta korrekt totalräkning + snitt för varje företag parallellt
    const statsByCompany = new Map<string, { total: number; avg: number | undefined }>();
    await Promise.all(uncachedIds.map(async (companyId) => {
      try {
        statsByCompany.set(companyId, await fetchReviewStats(companyId));
      } catch {
        // Statistikfältet fylls i av första riktiga hämtningen — ej kritiskt här.
      }
    }));

    // Group reviews by company and update cache
    const reviewsByCompany = new Map<string, CachedReview[]>();
    allReviews.forEach(r => {
      if (!reviewsByCompany.has(r.company_id)) {
        reviewsByCompany.set(r.company_id, []);
      }
      reviewsByCompany.get(r.company_id)!.push({
        ...r,
        profiles: profileMap.get(r.user_id) || undefined,
      });
    });

    // Update query cache for each company
    uncachedIds.forEach(companyId => {
      const reviews = reviewsByCompany.get(companyId) || [];
      const stats = statsByCompany.get(companyId);

      const result: CompanyReviewsData = {
        reviews,
        avgRating: stats?.avg ?? (reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : undefined),
        reviewCount: stats?.total ?? reviews.length,
      };

      queryClient.setQueryData(['company-reviews-cached', companyId], result);
      setLocalCache(companyId, result);
    });
  }, [queryClient, user?.id]);
}

/**
 * Batch prefetch company profiles for instant dialog load.
 * Call this when loading job search results.
 */
export function useBatchPrefetchCompanyProfiles() {
  const queryClient = useQueryClient();

  return useCallback(async (companyIds: string[]) => {
    if (companyIds.length === 0) return;

    // Only prefetch for companies not already cached
    const uncachedIds = companyIds.filter(id => {
      const cached = queryClient.getQueryData(['company-public-profile', id]);
      return !cached;
    });

    if (uncachedIds.length === 0) return;

    // Batch fetch all company profiles at once via safe RPC (public branding fields only)
    const { data: profiles } = await supabase
      .rpc('get_employer_public_profiles', { target_user_ids: uncachedIds });


    if (!profiles) return;

    // Update query cache for each company
    profiles.forEach(profile => {
      // OBS: egen nyckel för den PUBLIKA (trimmade) profilformen. Den fulla
      // egna profilen ligger under ['company-profile', id] — samma nyckel för
      // båda formerna gav fel data på /reviews efter egen förhandsgranskning.
      queryClient.setQueryData(['company-public-profile', profile.user_id], profile);
    });
  }, [queryClient]);
}
