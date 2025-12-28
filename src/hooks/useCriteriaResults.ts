import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface CriterionResult {
  id: string;
  criterion_id: string;
  evaluation_id: string;
  result: 'match' | 'no_match' | 'no_data';
  confidence: number | null;
  reasoning: string | null;
  source: string | null;
  created_at: string;
  // Joined from job_criteria
  criterion_title?: string;
}

export interface CandidateCriteriaResults {
  applicant_id: string;
  job_id: string;
  evaluation_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results: CriterionResult[];
}

// Hook to fetch criteria results for multiple candidates (for Kanban cards)
export function useCriteriaResultsForCandidates(candidates: { applicant_id: string; job_id: string | null }[]) {
  const { user } = useAuth();
  
  // Get unique job_id + applicant_id pairs
  const pairs = candidates
    .filter(c => c.job_id)
    .map(c => ({ job_id: c.job_id!, applicant_id: c.applicant_id }));
  
  const jobIds = [...new Set(pairs.map(p => p.job_id))];

  return useQuery({
    queryKey: ['criteria-results', pairs.map(p => `${p.job_id}-${p.applicant_id}`).join(',')],
    queryFn: async () => {
      if (pairs.length === 0) return {};

      // Fetch all evaluations for these candidates/jobs
      const { data: evaluations, error: evalError } = await supabase
        .from('candidate_evaluations')
        .select(`
          id,
          job_id,
          applicant_id,
          status
        `)
        .in('job_id', jobIds);

      if (evalError) throw evalError;
      if (!evaluations || evaluations.length === 0) return {};

      // Filter to only the pairs we care about
      const relevantEvals = evaluations.filter(e => 
        pairs.some(p => p.job_id === e.job_id && p.applicant_id === e.applicant_id)
      );

      if (relevantEvals.length === 0) return {};

      // Fetch all criterion results for these evaluations
      const evalIds = relevantEvals.map(e => e.id);
      const { data: results, error: resultsError } = await supabase
        .from('criterion_results')
        .select(`
          id,
          criterion_id,
          evaluation_id,
          result,
          confidence,
          reasoning,
          source,
          created_at,
          job_criteria!inner(title)
        `)
        .in('evaluation_id', evalIds);

      if (resultsError) throw resultsError;

      // Group results by applicant_id
      const resultMap: Record<string, CandidateCriteriaResults> = {};

      for (const eval_ of relevantEvals) {
        const key = `${eval_.job_id}-${eval_.applicant_id}`;
        const evalResults = (results || [])
          .filter(r => r.evaluation_id === eval_.id)
          .map(r => ({
            id: r.id,
            criterion_id: r.criterion_id,
            evaluation_id: r.evaluation_id,
            result: r.result as 'match' | 'no_match' | 'no_data',
            confidence: r.confidence,
            reasoning: r.reasoning,
            source: r.source,
            created_at: r.created_at,
            criterion_title: (r.job_criteria as any)?.title,
          }));

        resultMap[key] = {
          applicant_id: eval_.applicant_id,
          job_id: eval_.job_id,
          evaluation_id: eval_.id,
          status: eval_.status as 'pending' | 'processing' | 'completed' | 'failed',
          results: evalResults,
        };
      }

      return resultMap;
    },
    enabled: !!user && pairs.length > 0,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Hook to fetch criteria for a specific job
export function useJobCriteria(jobId: string | null) {
  return useQuery({
    queryKey: ['job-criteria', jobId],
    queryFn: async () => {
      if (!jobId) return [];

      const { data, error } = await supabase
        .from('job_criteria')
        .select('*')
        .eq('job_id', jobId)
        .eq('is_active', true)
        .order('order_index');

      if (error) throw error;
      return data || [];
    },
    enabled: !!jobId,
  });
}

// Hook to trigger evaluation for a candidate
export function useEvaluateCandidate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      jobId, 
      applicantId, 
      applicationId 
    }: { 
      jobId: string; 
      applicantId: string; 
      applicationId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('evaluate-candidate', {
        body: { 
          job_id: jobId, 
          applicant_id: applicantId,
          application_id: applicationId,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate criteria results to refetch
      queryClient.invalidateQueries({ queryKey: ['criteria-results'] });
      queryClient.invalidateQueries({ queryKey: ['candidate-summaries'] });
    },
    onError: (error) => {
      console.error('Evaluation error:', error);
      toast.error('Kunde inte utvärdera kandidaten');
    },
  });
}

// Hook to trigger evaluation for all candidates with a specific job
export function useEvaluateAllCandidates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      jobId, 
      candidates 
    }: { 
      jobId: string; 
      candidates: { applicant_id: string; application_id?: string }[];
    }) => {
      // Process in batches to avoid overwhelming the API
      const batchSize = 3;
      const results = [];

      for (let i = 0; i < candidates.length; i += batchSize) {
        const batch = candidates.slice(i, i + batchSize);
        
        const batchResults = await Promise.allSettled(
          batch.map(c => 
            supabase.functions.invoke('evaluate-candidate', {
              body: { 
                job_id: jobId, 
                applicant_id: c.applicant_id,
                application_id: c.application_id,
              },
            })
          )
        );

        results.push(...batchResults);

        // Small delay between batches
        if (i + batchSize < candidates.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['criteria-results'] });
      queryClient.invalidateQueries({ queryKey: ['candidate-summaries'] });
      toast.success('Utvärdering klar för alla kandidater');
    },
    onError: (error) => {
      console.error('Batch evaluation error:', error);
      toast.error('Fel vid utvärdering av kandidater');
    },
  });
}
