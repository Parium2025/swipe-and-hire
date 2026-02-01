import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCallback, useEffect } from 'react';

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
  reviewCount: number;
}

const CACHE_KEY = 'parium_company_reviews_cache';

// LocalStorage cache helpers - NO EXPIRY, always syncs in background
const getLocalCache = (companyId: string): { data: CompanyReviewsData; timestamp: number } | null => {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY}_${companyId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Always return cached data - background sync will update
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to read reviews cache:', e);
  }
  return null;
};

const setLocalCache = (companyId: string, data: CompanyReviewsData) => {
  try {
    localStorage.setItem(`${CACHE_KEY}_${companyId}`, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch (e) {
    console.warn('Failed to write reviews cache:', e);
  }
};

/**
 * Hook to get cached company reviews with instant load from localStorage
 * and background sync with the database.
 */
export function useCompanyReviewsCache(companyId: string | null) {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<CompanyReviewsData>({
    queryKey: ['company-reviews-cached', companyId],
    queryFn: async () => {
      if (!companyId) return { reviews: [], avgRating: undefined, reviewCount: 0 };

      // Fetch reviews from database
      const { data: reviews, error } = await supabase
        .from('company_reviews')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user profiles for non-anonymous reviews
      let enrichedReviews: CachedReview[] = reviews || [];
      
      if (reviews && reviews.length > 0) {
        const userIds = reviews
          .filter(r => !r.is_anonymous)
          .map(r => r.user_id);
        
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, first_name, last_name')
            .in('user_id', userIds);
          
          if (profiles) {
            const profileMap = new Map(profiles.map(p => [p.user_id, p]));
            enrichedReviews = reviews.map(r => ({
              ...r,
              profiles: profileMap.get(r.user_id) || undefined,
            }));
          }
        }
      }

      // Calculate average rating
      const avgRating = enrichedReviews.length > 0
        ? enrichedReviews.reduce((sum, r) => sum + r.rating, 0) / enrichedReviews.length
        : undefined;

      const result: CompanyReviewsData = {
        reviews: enrichedReviews,
        avgRating,
        reviewCount: enrichedReviews.length,
      };

      // Update localStorage cache
      setLocalCache(companyId, result);

      return result;
    },
    enabled: !!companyId,
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

    const channel = supabase
      .channel(`company-reviews-${companyId}`)
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

  // Prefetch reviews for a company (call when hovering over company card)
  const prefetchReviews = useCallback((targetCompanyId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['company-reviews-cached', targetCompanyId],
      queryFn: async () => {
        const { data: reviews, error } = await supabase
          .from('company_reviews')
          .select('*')
          .eq('company_id', targetCompanyId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        let enrichedReviews: CachedReview[] = reviews || [];
        
        if (reviews && reviews.length > 0) {
          const userIds = reviews
            .filter(r => !r.is_anonymous)
            .map(r => r.user_id);
          
          if (userIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('user_id, first_name, last_name')
              .in('user_id', userIds);
            
            if (profiles) {
              const profileMap = new Map(profiles.map(p => [p.user_id, p]));
              enrichedReviews = reviews.map(r => ({
                ...r,
                profiles: profileMap.get(r.user_id) || undefined,
              }));
            }
          }
        }

        const avgRating = enrichedReviews.length > 0
          ? enrichedReviews.reduce((sum, r) => sum + r.rating, 0) / enrichedReviews.length
          : undefined;

        const result: CompanyReviewsData = {
          reviews: enrichedReviews,
          avgRating,
          reviewCount: enrichedReviews.length,
        };

        setLocalCache(targetCompanyId, result);
        return result;
      },
      staleTime: 30 * 1000,
    });
  }, [queryClient]);

  return {
    reviews: data?.reviews || [],
    avgRating: data?.avgRating,
    reviewCount: data?.reviewCount || 0,
    isLoading: isLoading && !data,
    refetch,
    prefetchReviews,
  };
}

/**
 * Batch prefetch reviews for multiple companies.
 * Call this when loading job search results.
 */
export function useBatchPrefetchReviews() {
  const queryClient = useQueryClient();

  return useCallback(async (companyIds: string[]) => {
    if (companyIds.length === 0) return;

    // Only prefetch for companies not already cached
    const uncachedIds = companyIds.filter(id => {
      const cached = queryClient.getQueryData(['company-reviews-cached', id]);
      return !cached && !getLocalCache(id);
    });

    if (uncachedIds.length === 0) return;

    // Batch fetch all reviews at once
    const { data: allReviews } = await supabase
      .from('company_reviews')
      .select('*')
      .in('company_id', uncachedIds)
      .order('created_at', { ascending: false });

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
      const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : undefined;
      
      const result: CompanyReviewsData = {
        reviews,
        avgRating,
        reviewCount: reviews.length,
      };

      queryClient.setQueryData(['company-reviews-cached', companyId], result);
      setLocalCache(companyId, result);
    });
  }, [queryClient]);
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
      const cached = queryClient.getQueryData(['company-profile', id]);
      return !cached;
    });

    if (uncachedIds.length === 0) return;

    // Batch fetch all company profiles at once
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, company_name, company_logo_url, company_description, website, industry, employee_count, address')
      .in('user_id', uncachedIds);

    if (!profiles) return;

    // Update query cache for each company
    profiles.forEach(profile => {
      queryClient.setQueryData(['company-profile', profile.user_id], profile);
    });
  }, [queryClient]);
}
