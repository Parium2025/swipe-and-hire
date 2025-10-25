import { useState, useEffect, useMemo } from 'react';
import { expandSearchTerms } from '@/lib/smartSearch';

export interface FilterableJob {
  id: string;
  title: string;
  location: string;
  employment_type?: string;
  description?: string;
  workplace_city?: string;
  created_at: string;
  is_active: boolean;
  views_count: number;
  applications_count: number;
  updated_at: string;
  employer_profile?: {
    first_name?: string;
    last_name?: string;
  };
}

type SortOption = 'newest' | 'oldest' | 'title-asc' | 'title-desc';

export const useJobFiltering = (jobs: FilterableJob[]) => {
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

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
    
    // Filter based on search term
    if (searchTerm.trim()) {
      const expandedTerms = expandSearchTerms(searchTerm);
      result = result.filter(job => {
        const searchableText = [
          job.title,
          job.location,
          job.employment_type,
          job.description,
          job.workplace_city,
          job.employer_profile?.first_name,
          job.employer_profile?.last_name
        ].filter(Boolean).join(' ').toLowerCase();
        
        return expandedTerms.some(term => 
          searchableText.includes(term.toLowerCase())
        );
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
      case 'newest':
      default:
        return result.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
  }, [jobs, searchTerm, sortBy]);

  return {
    searchInput,
    setSearchInput,
    searchTerm,
    sortBy,
    setSortBy,
    filteredAndSortedJobs,
  };
};
