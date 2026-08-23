import { useMemo, useState } from 'react';
import { Sparkles, X, AlertTriangle } from 'lucide-react';
import { useActiveCriteriaEvalRuns, useCancelCriteriaEvalRun } from '@/hooks/useCriteriaEvalRun';
import { cn } from '@/lib/utils';

/**
 * Floating progress pill for server-side AI evaluation runs.
 * Visible on every page so the employer can leave the ad while the
 * queue keeps working on the server.
 */
export function CriteriaEvalProgress() {
  const { data: runs } = useActiveCriteriaEvalRuns();
  const cancelRun = useCancelCriteriaEvalRun();
  const [dismissed, setDismissed] = useState<string[]>([]);

  const visible = useMemo(
    () => (runs ?? []).filter(r => !dismissed.includes(r.id) && r.total_items > 0),
    [runs, dismissed],
  );

  if (visible.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2 sm:bottom-6 sm:right-6">
      {visible.map((run) => {
        const pct = Math.min(100, Math.round((run.done_items / Math.max(1, run.total_items)) * 100));
        const isPaused = run.status === 'paused';

        return (
          <div
            key={run.id}
            className={cn(
              'pointer-events-auto w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-border/60',
              'bg-background/80 p-3 shadow-lg backdrop-blur-xl',
            )}
          >
            <div className="flex items-start gap-2.5">
              <div className={cn(
                'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                isPaused ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary',
              )}>
                {isPaused ? <AlertTriangle className="h-4 w-4" /> : <Sparkles className="h-4 w-4 animate-pulse" />}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug text-foreground">
                  {isPaused ? 'AI-granskningen är pausad' : 'AI granskar kandidater'}
                </p>
                <p className="mt-0.5 break-words text-xs text-muted-foreground">
                  {isPaused
                    ? pauseText(run.pause_reason)
                    : `${run.done_items} av ${run.total_items} klara${run.failed_items > 0 ? ` · ${run.failed_items} misslyckades` : ''}`}
                </p>

                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', isPaused ? 'bg-destructive' : 'bg-primary')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                aria-label="Dölj"
                onClick={() => setDismissed(prev => [...prev, run.id])}
                className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!isPaused && (
              <button
                type="button"
                onClick={() => cancelRun.mutate({ runId: run.id })}
                disabled={cancelRun.isPending}
                className="mt-2 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
              >
                Avbryt granskningen
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function pauseText(reason: string | null): string {
  switch (reason) {
    case 'credits_exhausted':
      return 'AI-krediterna tog slut. Fyll på så återupptas granskningen automatiskt.';
    case 'blocked':
      return 'AI-tjänsten är blockerad för kontot. Kontakta support.';
    case 'rate_limited':
      return 'För många förfrågningar just nu — vi fortsätter automatiskt om en stund.';
    default:
      return 'Granskningen pausades och återupptas automatiskt.';
  }
}
