import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CriteriaEvalRun {
  id: string;
  job_id: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  pause_reason: string | null;
  total_items: number;
  done_items: number;
  failed_items: number;
  updated_at: string;
}

const ACTIVE_STATUSES = ['pending', 'running', 'paused'];

/**
 * Starts a server-side evaluation run for a job. The run lives in the
 * database, so it keeps going after the tab is closed — a cron sweeper
 * picks it back up every minute.
 */
export function useStartCriteriaEvalRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId }: { jobId: string }) => {
      const { data: runId, error } = await (supabase.rpc as any)('start_criteria_eval_run', {
        p_job_id: jobId,
      });
      if (error) throw error;

      // Kick the worker immediately instead of waiting for the next cron tick.
      supabase.functions.invoke('criteria-eval-worker', { body: { hop: 0, source: 'client' } })
        .catch(err => console.warn('criteria-eval-worker kick failed (cron will pick it up):', err));

      return runId as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['criteria-eval-runs'] });
    },
  });
}

export function useCancelCriteriaEvalRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ runId }: { runId: string }) => {
      const { error } = await (supabase.rpc as any)('cancel_criteria_eval_run', { p_run_id: runId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['criteria-eval-runs'] });
    },
  });
}

/**
 * All evaluation runs the signed-in employer is allowed to see that are
 * still in progress. Polls while something is active, idles otherwise.
 */
export function useActiveCriteriaEvalRuns() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['criteria-eval-runs'],
    enabled: !!user,
    refetchInterval: (q) => {
      const rows = (q.state.data as CriteriaEvalRun[] | undefined) ?? [];
      return rows.length > 0 ? 3000 : 20000;
    },
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('criteria_eval_runs')
        .select('id, job_id, status, pause_reason, total_items, done_items, failed_items, updated_at')
        .in('status', ACTIVE_STATUSES)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as CriteriaEvalRun[];
    },
  });

  // Refresh candidate cards only when the server actually completed more work
  const lastDoneRef = useRef(0);
  useEffect(() => {
    const rows = query.data ?? [];
    const done = rows.reduce((sum, r) => sum + (r.done_items ?? 0), 0);
    if (rows.length === 0 || done === lastDoneRef.current) return;
    lastDoneRef.current = done;
    queryClient.invalidateQueries({ queryKey: ['criteria-results'] });
  }, [query.data, queryClient]);


  return query;
}
