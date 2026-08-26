import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// Hård övre gräns vid hydrering — vi behöver bara de senaste swiparna för att
// filtrera bort redan-sedda jobb. Stoppar att en superanvändare med 50 000
// historiska swipes drar hem allt vid app-start.
const MAX_HYDRATED_ACTIONS = 5000;

export type SwipeActionType = 'skipped' | 'liked' | 'applied';

interface SwipeAction {
  job_id: string;
  action: SwipeActionType;
}

export function useSwipeActions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [actions, setActions] = useState<Map<string, SwipeActionType>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  // Synkron spegling av `actions` — setState-uppdateraren körs asynkront,
  // så vi kan inte läsa förra värdet inuti den. Ref:en ger oss alltid det
  // färska värdet direkt i event-handlern.
  const actionsRef = useRef<Map<string, SwipeActionType>>(new Map());
  
  

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
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(MAX_HYDRATED_ACTIONS);

        if (error) throw error;

        const map = new Map<string, SwipeActionType>();
        data?.forEach((row: any) => map.set(row.job_id, row.action as SwipeActionType));
        actionsRef.current = map;
        setActions(map);
      } catch (err) {
        console.error('Error fetching swipe actions:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActions();
  }, [user?.id]);

  // 🔔 Lyssna på broadcast från restoreSkippedJob (Skippade jobb-sidan) så
  // att Swipe Mode omedelbart plockar tillbaka jobbet i kön utan reload.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: Event) => {
      const jobId = (e as CustomEvent<{ jobId: string }>).detail?.jobId;
      if (!jobId) return;
      setActions(prev => {
        if (!prev.has(jobId)) return prev;
        const next = new Map(prev);
        next.delete(jobId);
        actionsRef.current = next;
        return next;
      });
    };
    window.addEventListener('parium:swipe-action-removed', handler);
    return () => window.removeEventListener('parium:swipe-action-removed', handler);
  }, []);

  const recordAction = useCallback(async (jobId: string, action: SwipeActionType) => {
    if (!user?.id) return;

    // Spara föregående värde så att en misslyckad skrivning återställer exakt
    // det som gällde innan (tidigare raderades posten helt = fel state).
    const previousAction = actionsRef.current.get(jobId);

    // Optimistic update
    setActions(prev => {
      const next = new Map(prev);
      next.set(jobId, action);
      actionsRef.current = next;
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

      // 🔁 Invalidera Skippade/Sparade-listorna så de reflekterar den nya
      // swipen omedelbart när användaren öppnar den fliken (annars visas
      // gammal placeholderData från localStorage och saknar det jobbet).
      if (action === 'skipped') {
        queryClient.invalidateQueries({ queryKey: ['skipped-jobs', user.id] });
        // 🔗 DB-triggern enforce_saved_skipped_exclusivity tar bort ev. sparning
        // för samma jobb. Spegla det direkt i alla öppna vyer (Sparade-sidan,
        // hjärt-ikoner i sök/swipe) så inget "moment 22" uppstår där jobbet
        // ser sparat ut men inte längre finns i saved_jobs.
        queryClient.invalidateQueries({ queryKey: ['saved-jobs', user.id] });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('parium:job-unsaved', { detail: { jobId } }),
          );
        }
      }
    } catch (err) {
      console.error('Error recording swipe action:', err);
      // Revert till föregående state (inte blank)
      setActions(prev => {
        const next = new Map(prev);
        if (previousAction) next.set(jobId, previousAction);
        else next.delete(jobId);
        actionsRef.current = next;
        return next;
      });
    }
  }, [user?.id, queryClient]);


  const undoAction = useCallback(async (jobId: string) => {
    if (!user?.id) return;

    // Snapshot previous action från ref:en — setState-uppdateraren körs inte
    // synkront, så att läsa värdet där gav alltid undefined och DB-raderingen
    // hoppades över (jobbet dök upp som skippat igen efter reload).
    const previousAction = actionsRef.current.get(jobId);
    if (!previousAction) return; // inget att ångra

    setActions(prev => {
      const next = new Map(prev);
      next.delete(jobId);
      actionsRef.current = next;
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
      // Rollback
      setActions(prev => {
        const next = new Map(prev);
        next.set(jobId, previousAction);
        actionsRef.current = next;
        return next;
      });
    }
  }, [user?.id]);

  const getAction = useCallback((jobId: string): SwipeActionType | undefined => {
    return actions.get(jobId);
  }, [actions]);

  // Memoiserad — undviker att en ny Set skapas vid varje render i parent.
  const skippedJobIds = useMemo(
    () => new Set(
      Array.from(actions.entries())
        .filter(([, action]) => action === 'skipped')
        .map(([jobId]) => jobId),
    ),
    [actions],
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
