import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface OrganizationQuestion {
  question_text: string;
  question_type: string;
  options: string[] | null;
  job_count: number; // How many jobs have this question
}

// 🔥 localStorage cache for instant-load
const ORG_QUESTIONS_CACHE_KEY = 'parium_org_questions_';

interface CachedOrgQuestions {
  questions: OrganizationQuestion[];
  timestamp: number;
}

function readOrgQuestionsCache(userId: string): OrganizationQuestion[] | null {
  try {
    const key = ORG_QUESTIONS_CACHE_KEY + userId;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const cached: CachedOrgQuestions = JSON.parse(raw);
    return cached.questions;
  } catch {
    return null;
  }
}

function writeOrgQuestionsCache(userId: string, questions: OrganizationQuestion[]): void {
  try {
    const key = ORG_QUESTIONS_CACHE_KEY + userId;
    const cached: CachedOrgQuestions = {
      questions,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(cached));
  } catch {
    // Storage full
  }
}

/**
 * Fetches all unique questions from job_questions for the current employer's organization.
 * This allows filtering candidates by their answers to any question across all jobs.
 */
export const useOrganizationQuestions = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check for cached data BEFORE query runs
  const hasCachedData = user ? readOrgQuestionsCache(user.id) !== null : false;

  const query = useQuery({
    queryKey: ['organization-questions', user?.id],
    queryFn: async (): Promise<OrganizationQuestion[]> => {
      if (!user) return [];

      // Get all job_questions from jobs owned by this employer (or org)
      const { data, error } = await supabase
        .from('job_questions')
        .select(`
          question_text,
          question_type,
          options,
          job_id,
          job_postings!inner(employer_id)
        `)
        .order('question_text');

      if (error) {
        console.error('Failed to fetch organization questions:', error);
        return [];
      }

      if (!data) return [];

      // Aggregate by question_text to get unique questions with counts
      const questionMap = new Map<string, OrganizationQuestion>();

      data.forEach((q: any) => {
        const key = q.question_text;
        const existing = questionMap.get(key);

        if (existing) {
          existing.job_count += 1;
          // Merge options if different jobs have different options for same question
          if (q.options && q.options.length > 0) {
            const mergedOptions = new Set([...(existing.options || []), ...q.options]);
            existing.options = Array.from(mergedOptions);
          }
        } else {
          questionMap.set(key, {
            question_text: q.question_text,
            question_type: q.question_type,
            options: q.options || null,
            job_count: 1,
          });
        }
      });

      // Sort by job_count (most used first), then alphabetically
      const result = Array.from(questionMap.values()).sort((a, b) => {
        if (b.job_count !== a.job_count) return b.job_count - a.job_count;
        return a.question_text.localeCompare(b.question_text, 'sv');
      });

      // 🔥 Cache for instant-load on next visit
      writeOrgQuestionsCache(user.id, result);

      return result;
    },
    enabled: !!user,
    staleTime: Infinity,
    // 🔥 Instant-load from localStorage cache
    initialData: () => {
      if (!user) return undefined;
      const cached = readOrgQuestionsCache(user.id);
      return cached ?? undefined;
    },
    initialDataUpdatedAt: () => {
      if (!user) return undefined;
      const cached = readOrgQuestionsCache(user.id);
      return cached ? Date.now() - 60000 : undefined; // Trigger background refetch
    },
  });

  // 📡 REALTIME: Prenumerera på jobbfrågaändringar
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`org-questions-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_questions',
        },
        () => {
          // Invalidera cache vid ändringar
          queryClient.invalidateQueries({ queryKey: ['organization-questions', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return {
    ...query,
    // Only show loading if we don't have cached data
    isLoading: query.isLoading && !hasCachedData,
  };
};
