import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createRealtimeChannel } from '@/lib/realtimeChannel';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useEffect } from 'react';

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
  const queryClient = useQueryClient();
  
  // Get unique job_id + applicant_id pairs
  const pairs = candidates
    .filter(c => c.job_id)
    .map(c => ({ job_id: c.job_id!, applicant_id: c.applicant_id }));
  
  const jobIds = [...new Set(pairs.map(p => p.job_id))];

  const query = useQuery({
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
    staleTime: 30 * 1000,
  });

  // Realtime: auto-refresh when evaluations complete or results change
  useEffect(() => {
    if (!user || pairs.length === 0 || jobIds.length === 0) return;

    const channel = createRealtimeChannel(`criteria-rt-${jobIds.sort().join('-').slice(0, 50)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'candidate_evaluations' },
        (payload: any) => {
          // Only invalidate if it's for one of our jobs
          if (payload.new?.job_id && jobIds.includes(payload.new.job_id)) {
            queryClient.invalidateQueries({ queryKey: ['criteria-results'] });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'criterion_results' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['criteria-results'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, jobIds.join(','), queryClient]);

  return query;
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
      // Filter out empty/incomplete criteria (must have title and prompt)
      return (data || []).filter(c => c.title?.trim() && c.prompt?.trim());
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
      // Check if online before triggering evaluation
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

// Hook to trigger evaluation for all candidates with a specific job.
// Built for full ads (500–1000+ ansökningar): adaptive worker pool,
// automatic backoff on 429/5xx and progressive UI refresh.
export function useEvaluateAllCandidates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      jobId,
      candidates,
      onProgress,
    }: {
      jobId: string;
      applicantId?: string;
      candidates: { applicant_id: string; application_id?: string }[];
      onProgress?: (done: number, total: number) => void;
    }) => {
      const total = candidates.length;
      const results: PromiseSettledResult<unknown>[] = [];
      if (total === 0) return results;

      // Adaptive concurrency: starts at 6 parallel calls, halves on
      // rate-limit/server errors and recovers slowly on success.
      let concurrency = 6;
      const MIN_CONCURRENCY = 2;
      const MAX_CONCURRENCY = 8;
      let cooldownUntil = 0;
      let done = 0;
      let cursor = 0;

      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

      const isThrottled = (err: unknown) => {
        const status = (err as { status?: number; context?: { status?: number } })?.status
          ?? (err as { context?: { status?: number } })?.context?.status;
        const msg = String((err as { message?: string })?.message ?? '');
        return status === 429 || (status !== undefined && status >= 500) || /429|rate|timeout|fetch/i.test(msg);
      };

      const evaluateOne = async (c: { applicant_id: string; application_id?: string }) => {
        // Up to 3 attempts with exponential backoff for transient failures.
        let lastError: unknown = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          const wait = cooldownUntil - Date.now();
          if (wait > 0) await sleep(wait);

          const { data, error } = await supabase.functions.invoke('evaluate-candidate', {
            body: {
              job_id: jobId,
              applicant_id: c.applicant_id,
              application_id: c.application_id,
            },
          });

          if (!error) {
            // Slowly recover concurrency after a healthy call
            if (concurrency < MAX_CONCURRENCY && Math.random() < 0.15) concurrency += 1;
            return data;
          }

          lastError = error;
          if (!isThrottled(error)) break;

          // Back off globally so all workers slow down together
          concurrency = Math.max(MIN_CONCURRENCY, Math.floor(concurrency / 2));
          const backoff = 1000 * Math.pow(2, attempt) + Math.random() * 400;
          cooldownUntil = Math.max(cooldownUntil, Date.now() + backoff);
        }
        throw lastError;
      };

      const worker = async () => {
        while (cursor < total) {
          const index = cursor++;
          try {
            const value = await evaluateOne(candidates[index]);
            results[index] = { status: 'fulfilled', value };
          } catch (reason) {
            results[index] = { status: 'rejected', reason } as PromiseRejectedResult;
          }
          done += 1;
          onProgress?.(done, total);

          // Progressive refresh so cards fill in while the run continues
          if (done % 25 === 0) {
            queryClient.invalidateQueries({ queryKey: ['criteria-results'] });
          }

          // Respect the current adaptive concurrency ceiling
          while (cursor - done > concurrency) await sleep(50);
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(MAX_CONCURRENCY, total) }, () => worker())
      );

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['criteria-results'] });
      queryClient.invalidateQueries({ queryKey: ['candidate-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['job-applications'] });
    },
    onError: (error) => {
      console.error('Batch evaluation error:', error);
      toast.error('Fel vid utvärdering av kandidater');
    },
  });
}

