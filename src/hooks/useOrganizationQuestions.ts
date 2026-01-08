import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface OrganizationQuestion {
  question_text: string;
  question_type: string;
  options: string[] | null;
  job_count: number; // How many jobs have this question
}

/**
 * Fetches all unique questions from job_questions for the current employer's organization.
 * This allows filtering candidates by their answers to any question across all jobs.
 */
export const useOrganizationQuestions = () => {
  const { user } = useAuth();

  return useQuery({
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
      return Array.from(questionMap.values()).sort((a, b) => {
        if (b.job_count !== a.job_count) return b.job_count - a.job_count;
        return a.question_text.localeCompare(b.question_text, 'sv');
      });
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};
