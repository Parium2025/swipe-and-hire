import { useEffect, useRef, useState } from 'react';
import logoRings from '@/assets/parium-logo-rings.png?inline';

/**
 * Global laddningsindikator för route-/lazy-laddning.
 *
 * Premium-känsla:
 *  - Visas först efter en kort fördröjning (default 180 ms) så snabba laddningar
 *    aldrig blinkar till med en spinner.
 *  - Pulserande Parium-logomark, lugn vågrörelse och en mjuk procentindikator.
 *  - Respekterar prefers-reduced-motion via Tailwind (motion-reduce).
 */
export const PageLoader = ({
  delayMs = 180,
  label = 'Laddar…',
  fullscreen = true,
  showProgress = true,
}: {
  delayMs?: number;
  label?: string;
  fullscreen?: boolean;
  showProgress?: boolean;
}) => {
  const [visible, setVisible] = useState(delayMs === 0);

  useEffect(() => {
    if (delayMs === 0) return;
    const t = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs]);


  return (
    <div
      className={`${fullscreen ? 'min-h-screen' : 'h-full w-full'} bg-parium-gradient flex items-center justify-center`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className={`flex flex-col items-center gap-5 transition-opacity duration-700 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Pulserande Parium-logomark med mjuk glow */}
        <div className="relative h-16 w-16" aria-hidden="true">
          <div
            className="absolute inset-0 rounded-full bg-primary-foreground/10 blur-[14px] animate-[parium-breathe_3.2s_ease-in-out_infinite] motion-reduce:animate-none"
          />
          <div
            className="absolute inset-0 bg-contain bg-center bg-no-repeat animate-[parium-logo-pulse_3.2s_ease-in-out_infinite] motion-reduce:animate-none"
            style={{ backgroundImage: `url(${logoRings})` }}
          />
        </div>

        {/* Lugn, pulserande våg med mjuk glow */}
        <div className="relative flex items-end gap-2" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="relative flex h-3 w-1.5 items-end justify-center">
              <span
                className="absolute h-2 w-1.5 origin-bottom rounded-full bg-primary-foreground/30 blur-[3px] motion-reduce:animate-none"
                style={{
                  animation: 'parium-wave 3.2s cubic-bezier(0.45, 0, 0.55, 1) infinite',
                  animationDelay: `${i * 0.18}s`,
                }}
              />
              <span
                className="block h-2 w-1.5 origin-bottom rounded-full bg-primary-foreground/70 motion-reduce:animate-none"
                style={{
                  animation: 'parium-wave 3.2s cubic-bezier(0.45, 0, 0.55, 1) infinite',
                  animationDelay: `${i * 0.18}s`,
                }}
              />
            </span>
          ))}
        </div>

        {showProgress && (
          <div className="flex w-40 flex-col items-center gap-2">
            <div className="h-[3px] w-full overflow-hidden rounded-full bg-primary-foreground/15">
              <div
                className="h-full rounded-full bg-primary-foreground/80 transition-[width] duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-medium tabular-nums text-primary-foreground/70">
              {Math.round(progress)} %
            </span>
          </div>
        )}

        <p className="text-sm font-medium text-primary-foreground/90">{label}</p>
      </div>
    </div>
  );
};

export default PageLoader;
