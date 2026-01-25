import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo, useEffect, useCallback, useRef } from 'react';
import { getTimeRemaining } from '@/lib/date';
import { expandSearchTerms } from '@/lib/smartSearch';

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
  // Added after enrichment
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

/**
 * High-performance job search hook using PostgreSQL full-text search.
 * Designed to handle 100,000+ jobs with sub-100ms query times.
 */
export function useOptimizedJobSearch(options: UseOptimizedJobSearchOptions) {
  const { searchQuery, city, employmentTypes, category, subcategories, enabled = true } = options;
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Determine if city is a county (län) for optimized query
  const isCounty = city.endsWith(' län');
  const countyFilter = isCounty ? city : '';
  const cityFilter = isCounty ? '' : city;

  // Expand search terms with synonyms for better matching
  const expandedSearchQuery = useMemo(() => {
    if (!searchQuery.trim()) return '';
    const expanded = expandSearchTerms(searchQuery);
    // Join with spaces for the database function to parse
    return expanded.join(' ');
  }, [searchQuery]);

  // Map employment type values to database codes
  const employmentCodes = useMemo(() => {
    return employmentTypes.map(type => {
      // Map common values to their database codes
      const typeMap: Record<string, string> = {
        'heltid': 'heltid',
        'deltid': 'deltid',
        'vikariat': 'vikariat',
        'provanstallning': 'provanstallning',
        'praktik': 'praktik',
        'sommarjobb': 'sommarjobb',
        'timanstallning': 'timanstallning',
      };
      return typeMap[type] || type;
    });
  }, [employmentTypes]);

  // Build category search terms
  const categorySearchTerms = useMemo(() => {
    if (subcategories.length > 0) {
      return subcategories.join(' ');
    }
    // Don't add category keywords to full-text search - use ILIKE for categories
    return '';
  }, [subcategories]);

  // Combine all search terms
  const fullSearchQuery = useMemo(() => {
    const terms = [expandedSearchQuery, categorySearchTerms].filter(Boolean);
    return terms.join(' ');
  }, [expandedSearchQuery, categorySearchTerms]);

  // Main search query using the optimized database function
  const { data: rawJobs = [], isLoading, error, refetch } = useQuery({
    queryKey: ['optimized-job-search', fullSearchQuery, cityFilter, countyFilter, employmentCodes],
    queryFn: async () => {
      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Use the optimized RPC function
      const { data, error } = await supabase.rpc('search_jobs', {
        p_search_query: fullSearchQuery || null,
        p_city: cityFilter || null,
        p_county: countyFilter || null,
        p_employment_types: employmentCodes.length > 0 ? employmentCodes : null,
        p_limit: 100,
        p_offset: 0,
      });

      if (error) {
        console.error('Search jobs error:', error);
        throw error;
      }

      return (data || []) as SearchJob[];
    },
    enabled,
    staleTime: 30000, // 30 seconds - searches are frequently updated
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
  });

  // Fetch company data for enrichment (parallel query)
  const employerIds = useMemo(() => {
    return [...new Set(rawJobs.map(job => job.employer_id).filter(Boolean))];
  }, [rawJobs]);

  const { data: companyData = {} } = useQuery({
    queryKey: ['company-data-batch', employerIds],
    queryFn: async () => {
      if (employerIds.length === 0) return {};

      // Fetch profiles and reviews in parallel
      const [profilesRes, reviewsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, company_name, company_logo_url')
          .in('user_id', employerIds),
        supabase
          .from('company_reviews')
          .select('company_id, rating')
          .in('company_id', employerIds)
      ]);

      // Calculate average ratings per company
      const ratingsMap: Record<string, { total: number; count: number }> = {};
      if (reviewsRes.data) {
        reviewsRes.data.forEach(review => {
          if (!ratingsMap[review.company_id]) {
            ratingsMap[review.company_id] = { total: 0, count: 0 };
          }
          ratingsMap[review.company_id].total += review.rating;
          ratingsMap[review.company_id].count++;
        });
      }

      const result: Record<string, { name: string; logo?: string; avgRating?: number; reviewCount: number }> = {};
      if (profilesRes.data) {
        profilesRes.data.forEach(p => {
          if (p.company_name) {
            const ratingData = ratingsMap[p.user_id];
            result[p.user_id] = {
              name: p.company_name,
              logo: p.company_logo_url || undefined,
              avgRating: ratingData ? ratingData.total / ratingData.count : undefined,
              reviewCount: ratingData?.count || 0
            };
          }
        });
      }

      return result;
    },
    enabled: employerIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Enrich jobs with company data and filter expired
  const enrichedJobs = useMemo(() => {
    return rawJobs
      .map(job => ({
        ...job,
        company_name: companyData[job.employer_id]?.name || 'Okänt företag',
        company_logo_url: companyData[job.employer_id]?.logo,
        company_avg_rating: companyData[job.employer_id]?.avgRating,
        company_review_count: companyData[job.employer_id]?.reviewCount || 0,
        views_count: job.views_count || 0,
        applications_count: job.applications_count || 0,
      }))
      .filter(job => !getTimeRemaining(job.created_at, job.expires_at).isExpired);
  }, [rawJobs, companyData]);

  // Real-time subscription for job updates
  useEffect(() => {
    const channel = supabase
      .channel('optimized-search-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_postings' },
        () => {
          // Invalidate search results when jobs change
          queryClient.invalidateQueries({ queryKey: ['optimized-job-search'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
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

/**
 * Hook to get total job count for a search (for pagination info)
 */
export function useJobSearchCount(options: Omit<UseOptimizedJobSearchOptions, 'enabled'>) {
  const { searchQuery, city, employmentTypes } = options;
  
  const isCounty = city.endsWith(' län');
  const countyFilter = isCounty ? city : '';
  const cityFilter = isCounty ? '' : city;

  const expandedSearchQuery = useMemo(() => {
    if (!searchQuery.trim()) return '';
    const expanded = expandSearchTerms(searchQuery);
    return expanded.join(' ');
  }, [searchQuery]);

  const employmentCodes = useMemo(() => {
    return employmentTypes.map(type => {
      const typeMap: Record<string, string> = {
        'heltid': 'heltid',
        'deltid': 'deltid',
        'vikariat': 'vikariat',
        'provanstallning': 'provanstallning',
        'praktik': 'praktik',
        'sommarjobb': 'sommarjobb',
        'timanstallning': 'timanstallning',
      };
      return typeMap[type] || type;
    });
  }, [employmentTypes]);

  const { data: count = 0 } = useQuery({
    queryKey: ['job-search-count', expandedSearchQuery, cityFilter, countyFilter, employmentCodes],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('count_search_jobs', {
        p_search_query: expandedSearchQuery || null,
        p_city: cityFilter || null,
        p_county: countyFilter || null,
        p_employment_types: employmentCodes.length > 0 ? employmentCodes : null,
      });

      if (error) {
        console.error('Count search jobs error:', error);
        return 0;
      }

      return data || 0;
    },
    staleTime: 60000, // 1 minute
    gcTime: 5 * 60 * 1000,
  });

  return count;
}
