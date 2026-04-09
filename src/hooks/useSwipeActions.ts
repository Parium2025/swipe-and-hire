import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type SwipeActionType = 'skipped' | 'liked' | 'applied';

interface SwipeAction {
  job_id: string;
  action: SwipeActionType;
}

export function useSwipeActions() {
  const { user } = useAuth();
  const [actions, setActions] = useState<Map<string, SwipeActionType>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const lastUndoneRef = useRef<{ jobId: string; action: SwipeActionType } | null>(null);

  // Fetch existing swipe actions
  useEffect(() => {
    if (!user?.id) {
      setActions(new Map());
      setIsLoading(false);
      return;
    }

    const fetchActions = async () => {
      try {
        const { data, error } = await supabase
          .from('swipe_actions')
          .select('job_id, action')
          .eq('user_id', user.id);

        if (error) throw error;

        const map = new Map<string, SwipeActionType>();
        data?.forEach((row: any) => map.set(row.job_id, row.action as SwipeActionType));
        setActions(map);
      } catch (err) {
        console.error('Error fetching swipe actions:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActions();
  }, [user?.id]);

  const recordAction = useCallback(async (jobId: string, action: SwipeActionType) => {
    if (!user?.id) return;

    // Optimistic update
    setActions(prev => {
      const next = new Map(prev);
      next.set(jobId, action);
      return next;
    });

    try {
      const { error } = await supabase
        .from('swipe_actions')
        .upsert(
          { user_id: user.id, job_id: jobId, action, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,job_id' }
        );

      if (error) throw error;
    } catch (err) {
      console.error('Error recording swipe action:', err);
      // Revert optimistic update
      setActions(prev => {
        const next = new Map(prev);
        next.delete(jobId);
        return next;
      });
    }
  }, [user?.id]);

  const undoAction = useCallback(async (jobId: string) => {
    if (!user?.id) return;

    const previousAction = actions.get(jobId);

    // Optimistic update
    setActions(prev => {
      const next = new Map(prev);
      next.delete(jobId);
      return next;
    });

    try {
      const { error } = await supabase
        .from('swipe_actions')
        .delete()
        .eq('user_id', user.id)
        .eq('job_id', jobId);

      if (error) throw error;
    } catch (err) {
      console.error('Error undoing swipe action:', err);
      // Revert
      if (previousAction) {
        setActions(prev => {
          const next = new Map(prev);
          next.set(jobId, previousAction);
          return next;
        });
      }
    }
  }, [user?.id, actions]);

  const getAction = useCallback((jobId: string): SwipeActionType | undefined => {
    return actions.get(jobId);
  }, [actions]);

  const skippedJobIds = new Set(
    Array.from(actions.entries())
      .filter(([, action]) => action === 'skipped')
      .map(([jobId]) => jobId)
  );

  return {
    actions,
    skippedJobIds,
    isLoading,
    recordAction,
    undoAction,
    getAction,
  };
}
