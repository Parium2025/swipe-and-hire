import { cn } from '@/lib/utils';

interface UploadInlineProgressProps {
  /** Etikett ovanför linjen. Alltid kritvit. */
  label?: string;
  /** 0–100 för bestämd progress. Utelämna för obestämd (svepande) linje. */
  percent?: number | null;
  /** Extra hjälptext under linjen. */
  hint?: string;
  className?: string;
}

/**
 * Kritvit uppladdningsindikator med samma svepande linje som sidladdaren.
 * Används överallt där en fil laddas upp så att känslan blir identisk.
 */
export function UploadInlineProgress({
  label = 'Laddar upp…',
  percent,
  hint,
  className,
}: UploadInlineProgressProps) {
  const isDeterminate = typeof percent === 'number' && Number.isFinite(percent);

  return (
    <div className={cn('w-full max-w-[240px] mx-auto space-y-2', className)}>
      <div className="flex items-baseline justify-center gap-2">
        <span className="text-sm font-medium text-white">{label}</span>
        {isDeterminate && (
          <span className="text-sm font-medium text-white tabular-nums">
            {Math.round(percent as number)}%
          </span>
        )}
      </div>

      <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/15">
        {isDeterminate ? (
          <div
            className="h-full rounded-full bg-white transition-[width] duration-200 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, percent as number))}%` }}
          />
        ) : (
          <div
            className="h-full w-full rounded-full bg-white"
            style={{ animation: 'parium-indeterminate 1.15s ease-in-out infinite' }}
          />
        )}
      </div>

      {hint && <p className="text-xs text-white text-center">{hint}</p>}
    </div>
  );
}

export default UploadInlineProgress;
