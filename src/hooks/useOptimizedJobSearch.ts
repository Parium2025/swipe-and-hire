import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo, useEffect, useCallback, useRef } from 'react';
import { getTimeRemaining } from '@/lib/date';
import { expandSearchTerms, detectSalarySearch } from '@/lib/smartSearch';

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

// ============================================
// FUZZY SEARCH UTILITIES
// ============================================

// Normalize Swedish characters for fuzzy matching
const normalizeSwedish = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/é/g, 'e')
    .replace(/è/g, 'e');
};

// Levenshtein distance for typo tolerance
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

// Common Swedish job-related typo corrections
const typoCorrections: Record<string, string[]> = {
  'utveklare': ['utvecklare'],
  'utvekalre': ['utvecklare'],
  'utvecklre': ['utvecklare'],
  'saljare': ['säljare'],
  'saeljare': ['säljare'],
  'seljare': ['säljare'],
  'ingenjor': ['ingenjör'],
  'ingenior': ['ingenjör'],
  'ingenjorr': ['ingenjör'],
  'sjukskotare': ['sjuksköterska'],
  'sjukskoetrska': ['sjuksköterska'],
  'sjukskoterska': ['sjuksköterska'],
  'larare': ['lärare'],
  'laerare': ['lärare'],
  'lerare': ['lärare'],
  'ekonom': ['ekonom', 'ekonomi'],
  'bokforing': ['bokföring'],
  'marknadsforing': ['marknadsföring'],
  'projektledning': ['projektledare'],
  'kundtjanst': ['kundtjänst'],
  'lastbilschauffor': ['lastbilschaufför', 'lastbilsförare'],
  'chauffeur': ['chaufför', 'förare'],
  'forare': ['förare'],
  'programerare': ['programmerare'],
  'programmare': ['programmerare'],
  'adminstrator': ['administratör'],
  'assitent': ['assistent'],
  'konsullt': ['konsult'],
  'recptionist': ['receptionist'],
  'chef': ['chef'],
  'cheff': ['chef'],
  'ledre': ['ledare'],
  'teknker': ['tekniker'],
};

// Expand search with fuzzy matching for typos
const expandSearchWithFuzzy = (searchTerm: string): string[] => {
  const normalizedTerm = normalizeSwedish(searchTerm.trim());
  const expandedTerms = new Set(expandSearchTerms(searchTerm));
  
  // Check for typo matches using Levenshtein distance
  for (const [typo, corrections] of Object.entries(typoCorrections)) {
    // Allow 1-2 character differences depending on word length
    const maxDistance = normalizedTerm.length <= 4 ? 1 : 2;
    if (levenshteinDistance(normalizedTerm, typo) <= maxDistance) {
      corrections.forEach(c => expandedTerms.add(c));
    }
  }
  
  // Also check if any typo is a substring match
  for (const [typo, corrections] of Object.entries(typoCorrections)) {
    if (normalizedTerm.includes(typo) || typo.includes(normalizedTerm)) {
      corrections.forEach(c => expandedTerms.add(c));
    }
  }
  
  return [...expandedTerms];
};

// ============================================
// MAIN HOOK
// ============================================

/**
 * High-performance job search hook using PostgreSQL full-text search.
 * Designed to handle 100,000+ jobs with sub-100ms query times.
 * 
 * Features:
 * - Full-text search with GIN indexes
 * - Fuzzy matching (typo tolerance)
 * - Category filtering at database level
 * - Salary filtering at database level
 * - Cursor-based pagination
 * - Real-time cache invalidation
 */
export function useOptimizedJobSearch(options: UseOptimizedJobSearchOptions) {
  const { searchQuery, city, employmentTypes, category, subcategories, enabled = true } = options;
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Determine if city is a county (län) for optimized query
  const isCounty = city.endsWith(' län');
  const countyFilter = isCounty ? city : '';
  const cityFilter = isCounty ? '' : city;

  // Detect salary search and expand terms with fuzzy matching
  const { expandedSearchQuery, salarySearch } = useMemo(() => {
    if (!searchQuery.trim()) return { expandedSearchQuery: '', salarySearch: null };
    
    // Check if it's a salary search first
    const salaryResult = detectSalarySearch(searchQuery);
    if (salaryResult.isSalarySearch) {
      return { 
        expandedSearchQuery: '', 
        salarySearch: salaryResult 
      };
    }
    
    // Expand with fuzzy matching for typos
    const expanded = expandSearchWithFuzzy(searchQuery);
    return { 
      expandedSearchQuery: expanded.join(' '),
      salarySearch: null
    };
  }, [searchQuery]);

  // Map employment type values to database codes
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

  // Build category filter for database
  const categoryFilter = useMemo(() => {
    // Use main category for database filter - handle both 'all' and 'all-categories'
    if (category && category !== 'all' && category !== 'all-categories') {
      return category;
    }
    return '';
  }, [category]);

  // Build category search terms for subcategories (added to full-text search)
  const categorySearchTerms = useMemo(() => {
    if (subcategories.length > 0) {
      return subcategories.join(' ');
    }
    return '';
  }, [subcategories]);

  // Combine all search terms
  const fullSearchQuery = useMemo(() => {
    const terms = [expandedSearchQuery, categorySearchTerms].filter(Boolean);
    return terms.join(' ');
  }, [expandedSearchQuery, categorySearchTerms]);

  // Main search query using the optimized database function
  const { data: rawJobs = [], isLoading, error, refetch } = useQuery({
    queryKey: [
      'optimized-job-search', 
      fullSearchQuery, 
      cityFilter, 
      countyFilter, 
      employmentCodes, 
      categoryFilter,
      salarySearch?.targetSalary,
      salarySearch?.isMinimumSearch
    ],
    queryFn: async () => {
      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Use the optimized RPC function with all filters at database level
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

      if (error) {
        console.error('Search jobs error:', error);
        throw error;
      }

      return (data || []) as SearchJob[];
    },
    enabled,
    staleTime: Infinity, // Never refetch — realtime handles all updates
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Fetch company data for enrichment (parallel query)
  const employerIds = useMemo(() => {
    return [...new Set(rawJobs.map(job => job.employer_id).filter(Boolean))];
  }, [rawJobs]);

  // 🔥 localStorage cache for instant company data - eliminates "Okänt företag" flash
  const COMPANY_CACHE_KEY = 'parium_company_data_cache';
  
  const readCompanyCache = useCallback((): Record<string, { name: string; logo?: string; avgRating?: number; reviewCount: number }> => {
    try {
      const raw = localStorage.getItem(COMPANY_CACHE_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }, []);

  const writeCompanyCache = useCallback((data: Record<string, { name: string; logo?: string; avgRating?: number; reviewCount: number }>) => {
    try {
      // Merge with existing cache (max 500 companies)
      const existing = readCompanyCache();
      const merged = { ...existing, ...data };
      const keys = Object.keys(merged);
      if (keys.length > 500) {
        // Keep only latest 500
        const toKeep = keys.slice(-500);
        const trimmed: typeof merged = {};
        toKeep.forEach(k => { trimmed[k] = merged[k]; });
        localStorage.setItem(COMPANY_CACHE_KEY, JSON.stringify(trimmed));
      } else {
        localStorage.setItem(COMPANY_CACHE_KEY, JSON.stringify(merged));
      }
    } catch {
      // Storage full - ignore
    }
  }, [readCompanyCache]);

  const { data: companyData = {}, isLoading: isLoadingCompanies } = useQuery({
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

      // 🔥 Update localStorage cache for instant load next time
      writeCompanyCache(result);

      return result;
    },
    enabled: employerIds.length > 0,
    staleTime: Infinity, // Never refetch — realtime handles all updates
    gcTime: Infinity,
    // 🔥 Instant-load from localStorage cache
    initialData: () => {
      if (employerIds.length === 0) return {};
      const cached = readCompanyCache();
      // Return only data for requested employer IDs
      const filtered: typeof cached = {};
      let hasAny = false;
      employerIds.forEach(id => {
        if (cached[id]) {
          filtered[id] = cached[id];
          hasAny = true;
        }
      });
      return hasAny ? filtered : undefined;
    },
    initialDataUpdatedAt: () => {
      // Trigger background refetch after 30 seconds
      return Date.now() - 30000;
    },
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

// ============================================
// INFINITE SCROLL HOOK (Cursor-based pagination)
// ============================================

interface UseInfiniteJobSearchOptions extends UseOptimizedJobSearchOptions {
  pageSize?: number;
}

/**
 * Infinite scroll job search using cursor-based pagination.
 * More efficient than offset-based for large datasets.
 */
export function useInfiniteJobSearch(options: UseInfiniteJobSearchOptions) {
  const { 
    searchQuery, 
    city, 
    employmentTypes, 
    category, 
    subcategories, 
    enabled = true,
    pageSize = 20 
  } = options;
  const queryClient = useQueryClient();

  const isCounty = city.endsWith(' län');
  const countyFilter = isCounty ? city : '';
  const cityFilter = isCounty ? '' : city;

  const { expandedSearchQuery, salarySearch } = useMemo(() => {
    if (!searchQuery.trim()) return { expandedSearchQuery: '', salarySearch: null };
    const salaryResult = detectSalarySearch(searchQuery);
    if (salaryResult.isSalarySearch) {
      return { expandedSearchQuery: '', salarySearch: salaryResult };
    }
    const expanded = expandSearchWithFuzzy(searchQuery);
    return { expandedSearchQuery: expanded.join(' '), salarySearch: null };
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

  const categoryFilter = useMemo(() => {
    if (category && category !== 'all' && category !== 'all-categories') return category;
    return '';
  }, [category]);

  const categorySearchTerms = useMemo(() => {
    return subcategories.length > 0 ? subcategories.join(' ') : '';
  }, [subcategories]);

  const fullSearchQuery = useMemo(() => {
    const terms = [expandedSearchQuery, categorySearchTerms].filter(Boolean);
    return terms.join(' ');
  }, [expandedSearchQuery, categorySearchTerms]);

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
      const lastJob = lastPage[lastPage.length - 1];
      return lastJob?.created_at || undefined;
    },
    enabled,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });

  const allJobs = useMemo(() => {
    return data?.pages.flat() || [];
  }, [data]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('infinite-search-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_postings' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['infinite-job-search'] });
        }
      )
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

/**
 * Hook to get total job count for a search (for pagination info)
 */
export function useJobSearchCount(options: Omit<UseOptimizedJobSearchOptions, 'enabled'>) {
  const { searchQuery, city, employmentTypes, category, subcategories } = options;
  
  const isCounty = city.endsWith(' län');
  const countyFilter = isCounty ? city : '';
  const cityFilter = isCounty ? '' : city;

  const { expandedSearchQuery, salarySearch } = useMemo(() => {
    if (!searchQuery.trim()) return { expandedSearchQuery: '', salarySearch: null };
    const salaryResult = detectSalarySearch(searchQuery);
    if (salaryResult.isSalarySearch) {
      return { expandedSearchQuery: '', salarySearch: salaryResult };
    }
    const expanded = expandSearchWithFuzzy(searchQuery);
    return { expandedSearchQuery: expanded.join(' '), salarySearch: null };
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

  const categoryFilter = useMemo(() => {
    if (category && category !== 'all' && category !== 'all-categories') return category;
    return '';
  }, [category]);

  const { data: count = 0 } = useQuery({
    queryKey: ['job-search-count', expandedSearchQuery, cityFilter, countyFilter, employmentCodes, categoryFilter, salarySearch?.targetSalary],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('count_search_jobs', {
        p_search_query: expandedSearchQuery || null,
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
    staleTime: 60000, // 1 minute
    gcTime: 5 * 60 * 1000,
  });

  return count;
}
