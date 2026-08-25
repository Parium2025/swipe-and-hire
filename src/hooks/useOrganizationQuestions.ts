import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { createRealtimeChannel } from '@/lib/realtimeChannel';

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
    if (!cached || !Array.isArray(cached.questions)) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      return null;
    }
    return cached.questions;
  } catch {
    try { localStorage.removeItem(ORG_QUESTIONS_CACHE_KEY + userId); } catch { /* ignore */ }
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

      // Aggregate on the server. A direct table read is capped at 1,000 rows,
      // which silently hid older questions for large organizations.
      const { data, error } = await supabase.rpc('get_employer_filter_questions');

      if (error) {
        console.error('Failed to fetch organization questions:', error);
        return [];
      }

      if (!data) return [];

      const result = (data || []).map((question: any) => ({
        question_text: question.question_text,
        question_type: question.question_type,
        options: Array.isArray(question.options) ? question.options : null,
        job_count: Number(question.job_count) || 0,
      }));

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

    const channel = createRealtimeChannel(`org-questions-${user.id}`)
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
