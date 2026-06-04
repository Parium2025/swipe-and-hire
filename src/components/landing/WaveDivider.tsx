import { memo } from 'react';

/**
 * WaveBackdrop
 * Dekorativ SVG-våg som lever som ett fast bakgrundslager (likt
 * AnimatedBackground/bubblorna). Sitter `fixed` i viewporten bakom
 * allt innehåll — syns hela tiden, blockerar inget, panar inte med scroll.
 *
 * Två mjuka vågor i secondary/accent med mycket låg opacity för premium
 * djup utan att konkurrera med text eller bubblor.
 */
export const WaveBackdrop = memo(() => {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      {/* Övre mjuk våg — ca 38% från toppen */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        className="absolute left-0 right-0 top-[34%] h-[28vh] w-full opacity-[0.08] sm:opacity-[0.1]"
      >
        <path
          d="M0,160 C240,240 480,80 720,140 C960,200 1200,260 1440,140 L1440,320 L0,320 Z"
          fill="hsl(var(--secondary))"
        />
      </svg>

      {/* Nedre långsammare våg — ca 68% från toppen, motsatt rytm */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        className="absolute left-0 right-0 top-[62%] h-[34vh] w-full opacity-[0.06] sm:opacity-[0.08]"
      >
        <path
          d="M0,200 C300,120 540,260 820,180 C1080,108 1280,180 1440,220 L1440,320 L0,320 Z"
          fill="hsl(var(--primary-glow, var(--secondary)))"
        />
      </svg>
    </div>
  );
});

WaveBackdrop.displayName = 'WaveBackdrop';

export default WaveBackdrop;
