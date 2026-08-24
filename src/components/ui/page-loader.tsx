import { useEffect, useState } from 'react';

/**
 * Global laddningsindikator för route-/lazy-laddning.
 *
 * Premium-känsla:
 *  - Visas först efter en kort fördröjning (default 180 ms) så snabba laddningar
 *    aldrig blinkar till med en spinner.
 *  - Mjuk fade-in, roterande ring + pulserande vågstaplar i varumärkets färger.
 *  - Respekterar prefers-reduced-motion via Tailwind (motion-reduce).
 */
export const PageLoader = ({
  delayMs = 180,
  label = 'Laddar…',
  fullscreen = true,
}: {
  delayMs?: number;
  label?: string;
  fullscreen?: boolean;
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
        className={`flex flex-col items-center gap-5 transition-opacity duration-500 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Roterande ring med glow */}
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-full border-2 border-primary-foreground/15" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary-foreground/90 border-r-primary-foreground/50 animate-spin motion-reduce:animate-none" />
          <div className="absolute inset-[6px] rounded-full bg-primary-foreground/5 blur-[6px]" />
        </div>

        {/* Mjuk våg av plattor */}
        <div className="flex items-end gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="block w-1.5 rounded-full bg-primary-foreground/70 motion-reduce:animate-none"
              style={{
                height: '10px',
                animation: 'parium-wave 1.1s ease-in-out infinite',
                animationDelay: `${i * 0.09}s`,
              }}
            />
          ))}
        </div>

        <p className="text-sm font-medium text-primary-foreground/90">{label}</p>
      </div>
    </div>
  );
};

export default PageLoader;
