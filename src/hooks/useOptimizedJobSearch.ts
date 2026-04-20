import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { safeSetItem } from '@/lib/safeStorage';
import { supabase } from '@/integrations/supabase/client';
import { useMemo, useEffect, useCallback, useRef } from 'react';
import { getTimeRemaining } from '@/lib/date';
import { expandSearchTerms, detectSalarySearch, allKnownLocationTerms } from '@/lib/smartSearch';
...
  const employerIds = useMemo(() => {
    return [...new Set(rawJobs.map(job => job.employer_id).filter(Boolean))];
  }, [rawJobs]);

  const jobIds = useMemo(() => {
    return [...new Set(rawJobs.map(job => job.id).filter(Boolean))];
  }, [rawJobs]);

  const { data: liveJobBranding = {} } = useQuery({
    queryKey: ['search-job-live-branding', jobIds],
    queryFn: async () => {
      if (jobIds.length === 0) return {};

      const { data, error } = await supabase
        .from('job_postings')
        .select(`
          id,
          title,
          location,
          workplace_city,
          workplace_county,
          workplace_municipality,
          workplace_address,
          workplace_name,
          workplace_postal_code,
          job_image_url,
          job_image_desktop_url,
          company_logo_url,
          image_focus_position,
          employment_type,
          salary_min,
          salary_max,
          salary_type,
          salary_transparency,
          positions_count,
          occupation,
          work_schedule,
          remote_work_possible,
          work_location_type,
          benefits,
          description,
          pitch,
          requirements,
          contact_email,
          application_instructions,
          updated_at,
          created_at,
          expires_at,
          views_count,
          applications_count,
          is_active,
          employer_id
        `)
        .in('id', jobIds);

      if (error) throw error;

      return (data || []).reduce<Record<string, Partial<SearchJob>>>((acc, job) => {
        acc[job.id] = {
          id: job.id,
          title: job.title,
          location: job.location,
          workplace_city: job.workplace_city,
          workplace_county: job.workplace_county,
          workplace_municipality: job.workplace_municipality,
          workplace_address: job.workplace_address,
          workplace_name: job.workplace_name,
          workplace_postal_code: job.workplace_postal_code,
          job_image_url: job.job_image_url,
          job_image_desktop_url: job.job_image_desktop_url,
          company_logo_url: job.company_logo_url || undefined,
          image_focus_position: job.image_focus_position,
          employment_type: job.employment_type,
          salary_min: job.salary_min,
          salary_max: job.salary_max,
          salary_type: job.salary_type,
          salary_transparency: job.salary_transparency,
          positions_count: job.positions_count,
          occupation: job.occupation,
          work_schedule: job.work_schedule,
          remote_work_possible: job.remote_work_possible,
          work_location_type: job.work_location_type,
          benefits: job.benefits,
          description: job.description,
          pitch: job.pitch,
          requirements: job.requirements,
          contact_email: job.contact_email,
          application_instructions: job.application_instructions,
          updated_at: job.updated_at,
          created_at: job.created_at,
          expires_at: job.expires_at,
          views_count: job.views_count || 0,
          applications_count: job.applications_count || 0,
          is_active: !!job.is_active,
          employer_id: job.employer_id,
        };
        return acc;
      }, {});
    },
    enabled: jobIds.length > 0,
    staleTime: 0,
    gcTime: Infinity,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: reviewsData = {} } = useQuery({
    queryKey: ['company-reviews-batch', employerIds],
    queryFn: async () => {
      if (employerIds.length === 0) return {};

      const { data } = await supabase
        .from('company_reviews')
        .select('company_id, rating')
        .in('company_id', employerIds);

      const ratingsMap: Record<string, { avgRating?: number; reviewCount: number }> = {};
      if (data) {
        const acc: Record<string, { total: number; count: number }> = {};
        data.forEach(r => {
          if (!acc[r.company_id]) acc[r.company_id] = { total: 0, count: 0 };
          acc[r.company_id].total += r.rating;
          acc[r.company_id].count++;
        });
        Object.keys(acc).forEach(id => {
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

  // Enrich jobs with live job_postings data first, then reviews, then filter expired.
  const enrichedJobs = useMemo(() => {
    const jobs = rawJobs
      .map(job => {
        const liveJob = liveJobBranding[job.id] || {};
        const mergedJob = {
          ...job,
          ...liveJob,
        } as SearchJob;

        return {
          ...mergedJob,
          company_name: mergedJob.workplace_name?.trim() || 'Okänt företag',
          company_logo_url: mergedJob.company_logo_url || undefined,
          company_avg_rating: reviewsData[mergedJob.employer_id]?.avgRating,
          company_review_count: reviewsData[mergedJob.employer_id]?.reviewCount || 0,
          views_count: mergedJob.views_count || 0,
          applications_count: mergedJob.applications_count || 0,
        };
      })
      .filter(job => !getTimeRemaining(job.created_at, job.expires_at).isExpired);

    if (selectedLocations.length === 0) {
      return jobs;
    }

    if (selectedLocations.length === 1) {
      return jobs;
    }

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
        return searchableFields.some(
          (field) => field === normalizedSelection || field.includes(normalizedSelection)
        );
      });
    });
  }, [rawJobs, liveJobBranding, reviewsData, selectedLocations]);

  // Real-time subscription for job updates.
  // job_postings is the SINGLE TUNNEL — when company info changes on profiles,
  // the DB trigger sync_company_name_to_jobs updates job_postings, which fires
  // this same channel. No need to subscribe to profiles separately.
  useEffect(() => {
    const channel = supabase
      .channel('optimized-search-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_postings' },
        () => {
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
