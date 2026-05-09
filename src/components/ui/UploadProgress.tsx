/**
 * 🎨 UploadProgress — Premium UI-komponent för uppladdningsprogress.
 *
 * Designprinciper:
 *   - Spotify Premium-stil: glassmorphism, vit text på mörk bakgrund
 *   - INGA ikoner — bara text och progress bar (matchar Parium-stilen)
 *   - Tydlig info: procent, MB, hastighet, tid kvar
 *   - Retry-status visas explicit ("Försöker igen…")
 *   - Avbryt-knapp alltid synlig under aktiv upload
 *
 * Två varianter:
 *   - <UploadProgress /> — Inline (för dialoger/formulär)
 *   - <UploadProgressOverlay /> — Modal overlay (för helskärm-flöden)
 */

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { formatBytes, formatTimeRemaining } from '@/lib/uploadWithProgress';
import type { UploadState } from '@/hooks/useResilientUpload';

interface UploadProgressProps {
  state: UploadState;
  onAbort?: () => void;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  /** Visa labelraden ovanför progress bar (default true) */
  showLabel?: boolean;
}

export function UploadProgress({
  state,
  onAbort,
  onRetry,
  onDismiss,
  className,
  showLabel = true,
}: UploadProgressProps) {
  // Inget att visa när idle
  if (state.status === 'idle') return null;

  const { status, progress, attempt, error } = state;

  const statusLabel = (() => {
    switch (status) {
      case 'preparing': return 'Förbereder…';
      case 'uploading': return progress ? `${progress.percent}%` : 'Laddar upp…';
      case 'retrying': return `Försöker igen (försök ${attempt})…`;
      case 'success': return 'Klar';
      case 'error': return 'Misslyckades';
      case 'aborted': return 'Avbruten';
      default: return '';
    }
  })();

  const subLabel = (() => {
    if (status === 'uploading' && progress) {
      const sizeText = `${formatBytes(progress.loaded)} av ${formatBytes(progress.total)}`;
      const timeText = formatTimeRemaining(progress.secondsRemaining);
      return timeText ? `${sizeText} · ${timeText}` : sizeText;
    }
    if (status === 'retrying') {
      return 'Återansluter automatiskt…';
    }
    if (status === 'error' && error) {
      return error;
    }
    return null;
  })();

  const percentValue =
    status === 'success' ? 100 :
    status === 'preparing' ? 0 :
    progress?.percent ?? 0;

  const isActive = status === 'preparing' || status === 'uploading' || status === 'retrying';

  return (
    <div className={cn(
      'rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-4 space-y-3',
      'transition-all duration-200',
      className,
    )}>
      {showLabel && (
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className={cn(
              'text-sm font-medium tabular-nums',
              status === 'error' ? 'text-destructive-foreground' : 'text-white',
            )}>
              {statusLabel}
            </div>
            {subLabel && (
              <div className="text-xs text-white/60 mt-0.5 truncate">
                {subLabel}
              </div>
            )}
          </div>

          {isActive && onAbort && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onAbort}
              className="h-8 px-3 text-xs text-white/70 hover:text-white hover:bg-white/10 shrink-0"
            >
              Avbryt
            </Button>
          )}

          {status === 'error' && onRetry && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="h-8 px-3 text-xs text-white hover:bg-white/10 shrink-0"
            >
              Försök igen
            </Button>
          )}

          {(status === 'success' || status === 'aborted' || status === 'error') && onDismiss && !onRetry && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-8 px-3 text-xs text-white/70 hover:text-white hover:bg-white/10 shrink-0"
            >
              Stäng
            </Button>
          )}
        </div>
      )}

      <Progress
        value={percentValue}
        className={cn(
          'h-1.5 bg-white/10',
          status === 'error' && '[&>div]:bg-destructive',
          status === 'success' && '[&>div]:bg-emerald-500',
        )}
      />
    </div>
  );
}

/**
 * Helskärm-overlay för flöden där upload är hela fokus
 * (t.ex. profilvideo-inspelning, stora job-image-uploads).
 */
export function UploadProgressOverlay({
  state,
  onAbort,
  onRetry,
  onDismiss,
  title,
}: UploadProgressProps & { title?: string }) {
  if (state.status === 'idle') return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm space-y-4">
        {title && (
          <h3 className="text-base font-semibold text-white text-center">
            {title}
          </h3>
        )}
        <UploadProgress
          state={state}
          onAbort={onAbort}
          onRetry={onRetry}
          onDismiss={onDismiss}
        />
      </div>
    </div>
  );
}
