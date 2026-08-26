import { useEffect, useState } from 'react';
import logoRings from '@/assets/parium-logo-rings.png?inline';

/**
 * Global laddningsindikator för route-/lazy-laddning.
 *
 * Premium-känsla:
 *  - Visas först efter en kort fördröjning (default 180 ms) så snabba laddningar
 *    aldrig blinkar till med en spinner.
 *  - Pulserande Parium-logomark, lugn vågrörelse och en obestämd laddningslinje
 *    (ingen fejkad procent som hoppar till klart).
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

        {showProgress && (
          <div className="h-[3px] w-40 overflow-hidden rounded-full bg-primary-foreground/15" aria-hidden="true">
            <div
              className="h-full w-full origin-left rounded-full bg-primary-foreground/80 motion-reduce:animate-none"
              style={{ animation: 'parium-indeterminate 1.9s cubic-bezier(0.45, 0, 0.55, 1) infinite' }}
            />
          </div>
        )}

        <p className="text-sm font-medium text-primary-foreground">{label}</p>
      </div>
    </div>
  );
};

export default PageLoader;
