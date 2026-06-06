import { memo } from 'react';

type WaveDividerProps = {
  className?: string;
};

/**
 * Wave-divider mellan hero och nästa sektion.
 * Inkluderar subtila "frosting drips" — asymmetriska bumps i samma off-white-färg
 * som vågen, som protruderar uppåt in i den mörkblå hero-ytan, likt glasyr som
 * fångats mitt i ett drypp. Statiska, ingen animation.
 */
const WaveDivider = memo(({ className = '' }: WaveDividerProps) => {
  return (
    <div
      className={`pointer-events-none relative z-10 -mb-px h-28 w-full overflow-visible sm:h-36 md:h-44 ${className}`}
      aria-hidden
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 180"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
      >
        <defs>
          {/* Subtil vertikal skugga inuti varje drip för volym */}
          <linearGradient id="drip-shade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--landing-light-foreground))" stopOpacity="0.08" />
            <stop offset="60%" stopColor="hsl(var(--landing-light-foreground))" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Drips bakom vågen — protruderar upp i navy hero */}
        {/* Drip 1 — liten, vänster */}
        <path
          d="M188,120 C188,90 220,90 220,120 Z"
          fill="hsl(var(--landing-light))"
        />
        <path d="M188,120 C188,98 220,98 220,120 Z" fill="url(#drip-shade)" />

        {/* Drip 2 — medel, vänster-mitt */}
        <path
          d="M510,82 C510,42 552,42 552,82 Z"
          fill="hsl(var(--landing-light))"
        />
        <path d="M510,82 C510,52 552,52 552,82 Z" fill="url(#drip-shade)" />

        {/* Drip 3 — stor, mitt-höger (djupast) */}
        <path
          d="M870,48 C870,2 922,2 922,48 Z"
          fill="hsl(var(--landing-light))"
        />
        <path d="M870,48 C870,14 922,14 922,48 Z" fill="url(#drip-shade)" />

        {/* Drip 4 — liten, höger */}
        <path
          d="M1250,112 C1250,88 1280,88 1280,112 Z"
          fill="hsl(var(--landing-light))"
        />
        <path d="M1250,112 C1250,94 1280,94 1280,112 Z" fill="url(#drip-shade)" />

        {/* Huvudvågen — ovanpå drips så övergången blir sömlös */}
        <path
          d="M0,78 C180,126 365,118 540,82 C748,38 912,36 1094,76 C1242,108 1338,112 1440,84 L1440,180 L0,180 Z"
          fill="hsl(var(--landing-light))"
        />
      </svg>
    </div>
  );
});

WaveDivider.displayName = 'WaveDivider';

export default WaveDivider;
