import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

export interface ApplicationData {
  id: string;
  job_id: string;
  applicant_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  bio: string | null;
  cv_url: string | null;
  age: number | null;
  employment_status: string | null;
  availability: string | null;
  status: string | null;
  applied_at: string;
  updated_at: string;
  custom_answers: any;
  job_title?: string;
  profile_image_url?: string | null;
}

const PAGE_SIZE = 25;
const SNAPSHOT_KEY_PREFIX = 'applications_snapshot_';
const SNAPSHOT_EXPIRY_MS = 5 * 60 * 1000; // 5 min

interface SnapshotData {
  items: ApplicationData[];
  timestamp: number;
}

// Read snapshot from localStorage
const readSnapshot = (userId: string): ApplicationData[] => {
  try {
    const key = SNAPSHOT_KEY_PREFIX + userId;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    
    const snapshot: SnapshotData = JSON.parse(raw);
    const age = Date.now() - snapshot.timestamp;
    
    if (age > SNAPSHOT_EXPIRY_MS) {
      localStorage.removeItem(key);
      return [];
    }
    
    return snapshot.items;
  } catch {
    return [];
  }
};

// Write snapshot to localStorage
const writeSnapshot = (userId: string, items: ApplicationData[]) => {
  try {
    const key = SNAPSHOT_KEY_PREFIX + userId;
    const snapshot: SnapshotData = {
      items: items.slice(0, 50), // Max 50 items
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(snapshot));
  } catch (e) {
    console.warn('Failed to write snapshot:', e);
  }
};

export const useApplicationsData = (searchQuery: string = '') => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [jobTitles, setJobTitles] = useState<Record<string, string>>({});

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['applications', user?.id, searchQuery],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      if (!user) {
        return { items: [], hasMore: false };
      }
      
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      // Build query with job title and profile image included via joins
      let query = supabase
        .from('job_applications')
        .select(`
          id,
          job_id,
          applicant_id,
          first_name,
          last_name,
          email,
          phone,
          location,
          bio,
          status,
          applied_at,
          updated_at,
          job_postings!inner(title),
          profiles(profile_image_url)
        `);

      // Apply powerful global search across all relevant fields including job title
      if (searchQuery && searchQuery.trim()) {
        const searchTerm = searchQuery.trim();
        // Search across name, email, phone, location, bio, and job title
        query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%,bio.ilike.%${searchTerm}%,job_postings.title.ilike.%${searchTerm}%`);
      }

      const { data: baseData, error: baseError } = await query
        .order('applied_at', { ascending: false })
        .range(from, to);

      if (baseError) {
        console.error('❌ Applications query error:', baseError);
        throw baseError;
      }

      if (!baseData) {
        return { items: [], hasMore: false };
      }

      // Transform data to flatten job_postings and normalize profile images
      const items = baseData.map((item: any) => {
        let profileImageUrl = item.profiles?.profile_image_url;
        
        // Normalisera till publik URL från profile-media bucket
        if (profileImageUrl && typeof profileImageUrl === 'string') {
          if (!profileImageUrl.includes('/storage/v1/object/public/')) {
            const publicUrl = supabase.storage
              .from('profile-media')
              .getPublicUrl(profileImageUrl).data.publicUrl;
            profileImageUrl = publicUrl;
          }
        }
        
        return {
          ...item,
          job_title: item.job_postings?.title || 'Okänt jobb',
          profile_image_url: profileImageUrl,
          job_postings: undefined,
          profiles: undefined
        };
      }) as ApplicationData[];
      
      const hasMore = items.length === PAGE_SIZE;

      // Write snapshot on first page
      if (pageParam === 0 && items.length > 0) {
        writeSnapshot(user.id, items);
      }

      return { items, hasMore };
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.hasMore ? allPages.length : undefined;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    initialData: () => {
      if (!user) return undefined;
      
      const snapshot = readSnapshot(user.id);
      if (snapshot.length === 0) return undefined;
      
      return {
        pages: [{ items: snapshot, hasMore: true }],
        pageParams: [0],
      };
    },
  });

  // Flatten all pages
  const applications = data?.pages.flatMap(page => page.items) || [];

  // Enrich with additional job metadata if needed (kept for backwards compatibility)
  useEffect(() => {
    if (applications.length === 0) return;

    const uniqueJobIds = [...new Set(applications.map(app => app.job_id))];
    const missingIds = uniqueJobIds.filter(id => !jobTitles[id]);
    
    if (missingIds.length === 0) return;

    supabase
      .from('job_postings')
      .select('id, title')
      .in('id', missingIds)
      .then(({ data: jobData }) => {
        if (jobData) {
          const titleMap = Object.fromEntries(
            jobData.map(job => [job.id, job.title])
          );
          setJobTitles(prev => ({ ...prev, ...titleMap }));
        }
      });
  }, [applications, jobTitles]);

  // Applications already have job_title from the join
  const enrichedApplications = applications;

  const stats = {
    total: enrichedApplications.length,
    new: enrichedApplications.filter(app => app.status === 'pending').length,
    reviewing: enrichedApplications.filter(app => app.status === 'reviewing').length,
    accepted: enrichedApplications.filter(app => app.status === 'accepted').length,
    rejected: enrichedApplications.filter(app => app.status === 'rejected').length,
  };

  const invalidateApplications = () => {
    queryClient.invalidateQueries({ queryKey: ['applications'] });
  };

  return {
    applications: enrichedApplications,
    stats,
    isLoading,
    error,
    refetch,
    invalidateApplications,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  };
};
