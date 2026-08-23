import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { detectSalarySearch, scoreJobMatch } from '@/lib/smartSearch';
import { isEmployerJobActive, isEmployerJobDraft, isEmployerJobExpired } from '@/lib/jobStatus';

// 🔥 SCALE: under denna gräns är klientsök snabbast (0 ms, instant medan man skriver).
// Över den växlar sökningen automatiskt till serversidig RPC (fuzzy + relevans i DB),
// så systemet klarar tusentals annonser utan att ladda ner allt.
export const SERVER_SEARCH_THRESHOLD = 100;
const SERVER_SEARCH_LIMIT = 200;


export interface FilterableJob {
  id: string;
  title: string;
  location: string;
  employment_type?: string;
  description?: string;
  workplace_city?: string;
  workplace_address?: string;
  workplace_name?: string;
  workplace_postal_code?: string;
  work_schedule?: string;
  occupation?: string;
  category?: string;
  requirements?: string;
  pitch?: string;
  work_location_type?: string;
  remote_work_possible?: string;
  salary_type?: string;
  salary_min?: number;
  salary_max?: number;
  positions_count?: number;
  created_at: string;
  expires_at?: string;
  is_active: boolean;
  views_count: number;
  applications_count: number;
  updated_at: string;
  employer_id?: string;
  employer_profile?: {
    first_name?: string;
    last_name?: string;
  };
}

export type SortOption = 'newest' | 'oldest' | 'title-asc' | 'title-desc' | 'active-first' | 'expired-first' | 'draft-first';

const validSortOptions: SortOption[] = ['newest', 'oldest', 'title-asc', 'title-desc', 'active-first', 'expired-first', 'draft-first'];

export interface UseJobFilteringOptions {
  /**
   * 'personal' = bara mina egna annonser (t.ex. /my-jobs).
   * Utan detta kunde serversökningen (som alltid söker i hela organisationen)
   * returnera kollegors annonser i den personliga vyn.
   */
  scope?: 'personal' | 'organization';
  /** Inloggad användares id – används för att låsa serversöket till 'personal'. */
  ownerId?: string | null;
}

export const useJobFiltering = (jobs: FilterableJob[], options: UseJobFilteringOptions = {}) => {
  const { scope = 'organization', ownerId = null } = options;
  const [searchParams] = useSearchParams();
  const sortFromUrl = searchParams.get('sort');
  const initialSort: SortOption = sortFromUrl && validSortOptions.includes(sortFromUrl as SortOption) 
    ? (sortFromUrl as SortOption) 
    : 'newest';
    
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>(initialSort);
  const [selectedRecruiterId, setSelectedRecruiterId] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 🔥 SCALE: serversidig sökning aktiveras automatiskt vid stora annonsvolymer
  const serverMode = jobs.length >= SERVER_SEARCH_THRESHOLD && !!searchTerm.trim();

  // I personlig vy låser vi sökningen till mina egna annonser.
  const effectiveRecruiterId = selectedRecruiterId ?? (scope === 'personal' ? ownerId : null);

  const { data: serverJobs, isFetching: isServerSearching } = useQuery({
    queryKey: ['employer-jobs-search', searchTerm, sortBy, effectiveRecruiterId, scope],
    enabled: serverMode,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<FilterableJob[]> => {
      const { data: hits, error } = await supabase.rpc('search_employer_jobs', {
        p_search: searchTerm,
        p_status: 'all',
        p_recruiter_id: effectiveRecruiterId,
        p_sort: sortBy,
        p_limit: SERVER_SEARCH_LIMIT,
        p_offset: 0,
      });
      if (error) throw error;

      const ids = (hits ?? []).map((h: any) => h.job_id as string);
      if (ids.length === 0) return [];

      const localById = new Map(jobs.map(j => [j.id, j]));
      const missing = ids.filter(id => !localById.has(id));

      if (missing.length > 0) {
        const { data: rows } = await supabase
          .from('job_postings')
          .select('*, employer_profile:profiles!job_postings_employer_id_fkey (first_name, last_name)')
          .in('id', missing);
        for (const row of (rows ?? []) as any[]) localById.set(row.id, row as FilterableJob);
      }

      return ids.map(id => localById.get(id)).filter(Boolean) as FilterableJob[];
    },
  });

  // Filter and sort jobs
  const filteredAndSortedJobs = useMemo(() => {
    // Serverläge: databasen har redan filtrerat, rankat och sorterat
    if (serverMode) return serverJobs ?? [];
    let result = [...jobs];

    const relevanceScores = new Map<string, number>();

    
    // Filter by recruiter if selected
    if (selectedRecruiterId) {
      result = result.filter(job => job.employer_id === selectedRecruiterId);
    }
    
    // Filter based on search term
    if (searchTerm.trim()) {
      // Check if it's a salary search first
      const salarySearch = detectSalarySearch(searchTerm);
      
      if (salarySearch.isSalarySearch) {
        // Filter by salary range
        result = result.filter(job => {
          // Skip jobs without salary info
          if (!job.salary_min && !job.salary_max) return false;
          
          const jobMin = job.salary_min || 0;
          const jobMax = job.salary_max || jobMin;
          const targetSalary = salarySearch.targetSalary!;
          
          if (salarySearch.isMinimumSearch) {
            // "100000+" means job should offer at least this amount
            // Job qualifies if its max salary >= target OR min salary >= target
            return jobMax >= targetSalary || jobMin >= targetSalary;
          } else {
            // Regular salary search: "27500" means find jobs where this salary is within their range
            // The job's salary range should include the target salary
            return targetSalary >= jobMin && targetSalary <= jobMax;
          }
        });
      } else {
        // Smart text search: typo-tolerant, å/ä/ö-normalized, multi-word AND, ranked
        for (const job of result) {
          const score = scoreJobMatch([
            { text: job.title || '', weight: 3 },
            { text: job.occupation || '', weight: 2 },
            { text: job.location || '', weight: 2 },
            { text: job.workplace_city || '', weight: 2 },
            { text: job.workplace_name || '', weight: 2 },
            { text: `${job.employer_profile?.first_name || ''} ${job.employer_profile?.last_name || ''}`.trim(), weight: 2 },
            { text: job.employment_type || '', weight: 1.5 },
            { text: job.work_schedule || '', weight: 1.5 },
            { text: job.category || '', weight: 1 },
            { text: job.workplace_address || '', weight: 1 },
            { text: job.workplace_postal_code || '', weight: 1 },
            { text: job.work_location_type || '', weight: 1 },
            { text: job.remote_work_possible || '', weight: 1 },
            { text: job.salary_type || '', weight: 1 },
            { text: job.description || '', weight: 0.5 },
            { text: job.requirements || '', weight: 0.5 },
            { text: job.pitch || '', weight: 0.5 },
            { text: job.salary_min && job.salary_max ? `${job.salary_min}-${job.salary_max}` : '', weight: 0.5 },
            { text: job.positions_count ? `${job.positions_count} platser` : '', weight: 0.5 },
          ], searchTerm);
          if (score > 0) relevanceScores.set(job.id, score);
        }
        result = result.filter(job => relevanceScores.has(job.id));
      }
    }

    // When searching with default sort: rank by relevance first
    if (relevanceScores.size > 0 && sortBy === 'newest') {
      return result.sort((a, b) => {
        const diff = (relevanceScores.get(b.id) || 0) - (relevanceScores.get(a.id) || 0);
        if (diff !== 0) return diff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    
    // Sort
    switch (sortBy) {
      case 'oldest':
        return result.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      case 'title-asc':
        return result.sort((a, b) => 
          a.title.localeCompare(b.title, 'sv')
        );
      case 'title-desc':
        return result.sort((a, b) => 
          b.title.localeCompare(a.title, 'sv')
        );
      case 'active-first':
        return result.sort((a, b) => {
          const aIsActive = isEmployerJobActive(a);
          const bIsActive = isEmployerJobActive(b);
          if (aIsActive && !bIsActive) return -1;
          if (!aIsActive && bIsActive) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      case 'expired-first':
        return result.sort((a, b) => {
          const aIsExpired = isEmployerJobExpired(a);
          const bIsExpired = isEmployerJobExpired(b);
          if (aIsExpired && !bIsExpired) return -1;
          if (!aIsExpired && bIsExpired) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      case 'draft-first':
        return result.sort((a, b) => {
          const aIsDraft = isEmployerJobDraft(a);
          const bIsDraft = isEmployerJobDraft(b);
          if (aIsDraft && !bIsDraft) return -1;
          if (!aIsDraft && bIsDraft) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      case 'newest':
      default:
        return result.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
  }, [jobs, searchTerm, sortBy, selectedRecruiterId, serverMode, serverJobs]);

  return {
    searchInput,
    setSearchInput,
    searchTerm,
    sortBy,
    setSortBy,
    selectedRecruiterId,
    setSelectedRecruiterId,
    filteredAndSortedJobs,
    isServerSearch: serverMode,
    isServerSearching: serverMode && isServerSearching,
  };
};

