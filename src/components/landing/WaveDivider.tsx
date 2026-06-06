import { memo } from 'react';

type WaveDividerProps = {
  className?: string;
};

/**
 * Wave-divider mellan hero och nästa sektion.
 *
 * Inkluderar subtila "glasyr-droppar" — asymmetriska, navy-färgade droppar som
 * hänger ner från vågens underkant in i den off-vita ytan, som glasyr som
 * dryper ner på en kaka. Statiska, ingen animation. Varierande storlek och
 * djup för en handgjord, premium-känsla (Stripe/Linear-nivå).
 */
const WaveDivider = memo(({ className = '' }: WaveDividerProps) => {
  return (
    <div
      className={`pointer-events-none relative z-10 -mb-px h-28 w-full overflow-hidden sm:h-36 md:h-44 ${className}`}
      aria-hidden
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 180"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          {/* Subtil vertikal glans på droppen för volym */}
          <linearGradient id="drip-volume" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(215 100% 18%)" />
            <stop offset="100%" stopColor="hsl(215 100% 10%)" />
          </linearGradient>
        </defs>

        {/* Huvudvågen — fylld off-white */}
        <path
          d="M0,78 C180,126 365,118 540,82 C748,38 912,36 1094,76 C1242,108 1338,112 1440,84 L1440,180 L0,180 Z"
          fill="hsl(var(--landing-light))"
        />

        {/* Glasyr-droppar — navy, hänger ner från vågens underkant.
            Varje drop är en organisk kapsel: smal hals upptill, rundad nedtill.
            Y-koordinaterna börjar VID vågens kurva på respektive x. */}

        {/* Drop 1 — liten, vänster (x≈200, vågkurva y≈120) */}
        <path
          d="M195,118 C195,118 193,138 200,138 C207,138 205,118 205,118 Z"
          fill="url(#drip-volume)"
        />

        {/* Drop 2 — medel, vänster-mitt (x≈540, vågkurva y≈82) */}
        <path
          d="M530,80 C530,80 526,128 540,128 C554,128 550,80 550,80 Z"
          fill="url(#drip-volume)"
        />

        {/* Drop 3 — stor, mitten (x≈760, kurva y≈42, djupast) */}
        <path
          d="M745,46 C745,46 738,156 760,156 C782,156 775,46 775,46 Z"
          fill="url(#drip-volume)"
        />

        {/* Drop 4 — liten-medel, höger-mitt (x≈1094, kurva y≈76) */}
        <path
          d="M1086,74 C1086,74 1083,108 1094,108 C1105,108 1102,74 1102,74 Z"
          fill="url(#drip-volume)"
        />

        {/* Drop 5 — liten, höger (x≈1320, kurva y≈112) */}
        <path
          d="M1314,110 C1314,110 1312,128 1320,128 C1328,128 1326,110 1326,110 Z"
          fill="url(#drip-volume)"
        />
      </svg>
    </div>
  );
});

WaveDivider.displayName = 'WaveDivider';

export default WaveDivider;
