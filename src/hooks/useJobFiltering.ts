import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { expandSearchTerms, detectSalarySearch } from '@/lib/smartSearch';
import { isJobExpiredCheck } from '@/lib/date';

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

type SortOption = 'newest' | 'oldest' | 'title-asc' | 'title-desc' | 'active-first' | 'expired-first' | 'draft-first';

const validSortOptions: SortOption[] = ['newest', 'oldest', 'title-asc', 'title-desc', 'active-first', 'expired-first', 'draft-first'];

export const useJobFiltering = (jobs: FilterableJob[]) => {
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

  // Filter and sort jobs
  const filteredAndSortedJobs = useMemo(() => {
    let result = [...jobs];
    
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
        // Regular text search with synonyms
        const expandedTerms = expandSearchTerms(searchTerm);
        result = result.filter(job => {
          // Comprehensive searchable text including ALL relevant fields
          const searchableText = [
            job.title,
            job.location,
            job.workplace_city,
            job.workplace_address,
            job.workplace_name,
            job.workplace_postal_code,
            job.employment_type,
            job.work_schedule,
            job.occupation,
            job.category,
            job.description,
            job.requirements,
            job.pitch,
            job.work_location_type,
            job.remote_work_possible,
            job.salary_type,
            job.employer_profile?.first_name,
            job.employer_profile?.last_name,
            // Add formatted salary for search
            job.salary_min && job.salary_max ? `${job.salary_min}-${job.salary_max}` : '',
            job.positions_count ? `${job.positions_count} platser` : '',
          ].filter(Boolean).join(' ').toLowerCase();
          
          return expandedTerms.some(term => 
            searchableText.includes(term.toLowerCase())
          );
        });
      }
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
        // Active jobs first (is_active = true AND not expired), then expired, then drafts
        return result.sort((a, b) => {
          const aIsActive = a.is_active && !isJobExpiredCheck(a.created_at, a.expires_at);
          const bIsActive = b.is_active && !isJobExpiredCheck(b.created_at, b.expires_at);
          if (aIsActive && !bIsActive) return -1;
          if (!aIsActive && bIsActive) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      case 'expired-first':
        // Expired jobs first (is_active = true AND expired)
        return result.sort((a, b) => {
          const aIsExpired = a.is_active && isJobExpiredCheck(a.created_at, a.expires_at);
          const bIsExpired = b.is_active && isJobExpiredCheck(b.created_at, b.expires_at);
          if (aIsExpired && !bIsExpired) return -1;
          if (!aIsExpired && bIsExpired) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      case 'draft-first':
        // Draft jobs first (is_active = false)
        return result.sort((a, b) => {
          const aIsDraft = !a.is_active;
          const bIsDraft = !b.is_active;
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
  }, [jobs, searchTerm, sortBy, selectedRecruiterId]);

  return {
    searchInput,
    setSearchInput,
    searchTerm,
    sortBy,
    setSortBy,
    selectedRecruiterId,
    setSelectedRecruiterId,
    filteredAndSortedJobs,
  };
};
