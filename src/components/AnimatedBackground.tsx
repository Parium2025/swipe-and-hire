import { memo } from 'react';

/**
 * Animated background with bubbles and glow effects.
 * 
 * PERFORMANCE: On touch devices animations are disabled to free GPU/CPU for
 * instant button responsiveness. Only the static glow is rendered.
 */
interface AnimatedBackgroundProps {
  showBubbles?: boolean;
  showGlow?: boolean;
  variant?: 'viewport' | 'card';
  /**
   * Render the off-white wave map at the bottom. Only used on the audience
   * landing page so that wave-aware text can clip against it. Off by default
   * so it does NOT leak into /auth or in-app shells.
   */
  showWave?: boolean;
  waveHeightClassName?: string;
}

export const AnimatedBackground = memo(({ showBubbles = true, showGlow = true, variant = 'viewport', showWave = false, waveHeightClassName = 'h-[50%]' }: AnimatedBackgroundProps) => {
  const positionClass = variant === 'card' ? 'absolute' : 'fixed';

  return (
    <div className={`${positionClass} inset-0 pointer-events-none z-0 overflow-hidden`}>
      {variant === 'viewport' && showWave && (
        <svg
          data-landing-wave-map
          className={`absolute inset-x-0 bottom-0 ${waveHeightClassName} w-full`}
          viewBox="0 0 1440 600"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id="landing-drip-volume" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(215 100% 13%)" />
              <stop offset="100%" stopColor="hsl(215 100% 9%)" />
            </linearGradient>
          </defs>

          {/* Off-white botten-fyllning (under vågen) */}
          <path
            d="M0,80 C200,120 380,110 560,80 C760,46 940,44 1120,72 C1270,96 1360,100 1440,82 L1440,600 L0,600 Z"
            fill="hsl(var(--landing-light))"
          />

          {/* Navy paint-drip: blå området "rinner" ner i off-white.
              En sammanhängande path som följer vågens underkant och
              släpper droppar nedåt med varierande längd + bulbiga ändar.
              Slutar uppåt utanför viewBox så det smälter ihop med blå sektion ovan. */}
          <path
            fill="url(#landing-drip-volume)"
            d="
              M0,-20
              L1440,-20
              L1440,82
              C1360,100 1270,96 1120,72
              C940,44 760,46 560,80
              C380,110 200,120 0,80
              Z
              M58,108
              c-6,0 -10,8 -10,18
              c0,12 4,20 12,20
              c8,0 12,-8 12,-20
              c0,-10 -4,-18 -10,-18
              Z
              M132,128
              c-7,0 -12,10 -12,24
              c0,16 5,28 14,28
              c10,0 14,-12 14,-28
              c0,-14 -5,-24 -12,-24
              Z
              M214,116
              c-5,0 -9,6 -9,14
              c0,9 4,15 10,15
              c6,0 9,-6 9,-15
              c0,-8 -4,-14 -9,-14
              Z
              M286,140
              c-8,0 -13,12 -13,30
              c0,22 5,38 16,38
              c11,0 15,-16 15,-38
              c0,-18 -5,-30 -13,-30
              Z
              M372,120
              c-6,0 -10,8 -10,18
              c0,12 4,20 11,20
              c7,0 10,-8 10,-20
              c0,-10 -4,-18 -9,-18
              Z
              M448,118
              c-9,0 -15,14 -15,34
              c0,26 6,46 18,46
              c12,0 17,-20 17,-46
              c0,-20 -6,-34 -15,-34
              Z
              M538,96
              c-6,0 -10,8 -10,18
              c0,12 4,20 11,20
              c7,0 10,-8 10,-20
              c0,-10 -4,-18 -9,-18
              Z
              M620,90
              c-9,0 -16,18 -16,42
              c0,30 7,52 19,52
              c12,0 18,-22 18,-52
              c0,-24 -7,-42 -16,-42
              Z
              M708,72
              c-5,0 -9,6 -9,14
              c0,10 4,16 10,16
              c6,0 9,-6 9,-16
              c0,-8 -4,-14 -9,-14
              Z
              M780,62
              c-8,0 -14,14 -14,32
              c0,22 6,38 16,38
              c10,0 15,-16 15,-38
              c0,-18 -6,-32 -14,-32
              Z
              M862,62
              c-6,0 -10,8 -10,18
              c0,12 4,20 11,20
              c7,0 10,-8 10,-20
              c0,-10 -4,-18 -9,-18
              Z
              M940,66
              c-9,0 -16,16 -16,38
              c0,28 7,48 18,48
              c11,0 17,-20 17,-48
              c0,-22 -7,-38 -16,-38
              Z
              M1022,76
              c-5,0 -9,6 -9,14
              c0,9 4,15 10,15
              c6,0 9,-6 9,-15
              c0,-8 -4,-14 -9,-14
              Z
              M1100,88
              c-9,0 -15,14 -15,34
              c0,26 6,46 18,46
              c12,0 17,-20 17,-46
              c0,-20 -6,-34 -15,-34
              Z
              M1184,104
              c-6,0 -10,8 -10,18
              c0,12 4,20 11,20
              c7,0 10,-8 10,-20
              c0,-10 -4,-18 -9,-18
              Z
              M1262,114
              c-9,0 -16,16 -16,38
              c0,28 7,48 18,48
              c12,0 18,-20 18,-48
              c0,-22 -7,-38 -16,-38
              Z
              M1344,108
              c-6,0 -10,8 -10,18
              c0,12 4,20 11,20
              c7,0 10,-8 10,-20
              c0,-10 -4,-18 -9,-18
              Z
              M1408,116
              c-7,0 -12,10 -12,24
              c0,16 5,28 14,28
              c10,0 14,-12 14,-28
              c0,-14 -5,-24 -12,-24
              Z
            "
          />

          {/* Lösa droppar (helt frikopplade pärlor lägre ner) */}
          {[
              { cx: 96, cy: 180, r: 5 },
              { cx: 350, cy: 220, r: 6 },
              { cx: 656, cy: 200, r: 5 },
              { cx: 988, cy: 178, r: 5 },
              { cx: 1316, cy: 218, r: 6 },
          ].map((d, i) => (
            <circle
              key={`drop-${i}`}
              cx={d.cx}
              cy={d.cy}
              r={d.r}
              fill="url(#landing-drip-volume)"
            />
          ))}
        </svg>
      )}


      {showBubbles && (
        <>
          {/* Left-side bubbles (top corner) */}
          <div className="absolute top-20 left-10 w-4 h-4 bg-secondary/30 rounded-full"></div>
          <div className="absolute top-32 left-16 w-2 h-2 bg-accent/40 rounded-full animate-soft-bounce" style={{ animationDuration: '2.5s', animationDelay: '-1.2s', animationFillMode: 'backwards' }}></div>
          <div className="absolute top-24 left-20 w-3 h-3 bg-secondary/20 rounded-full animate-soft-bounce" style={{ animationDuration: '3s', animationDelay: '-0.7s', animationFillMode: 'backwards' }}></div>
          
          {/* Right-side bubbles */}
          <div className="absolute bottom-40 right-20 w-5 h-5 bg-accent/30 rounded-full animate-soft-bounce" style={{ animationDuration: '2.2s', animationDelay: '-0.8s', animationFillMode: 'backwards' }}></div>
          <div className="absolute bottom-32 right-16 w-3 h-3 bg-secondary/25 rounded-full animate-soft-bounce" style={{ animationDuration: '2.8s', animationDelay: '-1.5s', animationFillMode: 'backwards' }}></div>
          <div className="absolute bottom-36 right-24 w-2 h-2 bg-accent/35 rounded-full animate-soft-bounce" style={{ animationDuration: '2.3s', animationDelay: '-0.5s', animationFillMode: 'backwards' }}></div>

          {/* Pulsing lights (right) */}
          <div className="absolute top-10 right-10 w-3 h-3 bg-secondary/40 rounded-full animate-pulse" style={{ animationDuration: '1.5s', animationDelay: '-0.4s', animationFillMode: 'backwards' }}></div>
          <div className="absolute top-16 right-20 w-2 h-2 bg-accent/30 rounded-full animate-pulse" style={{ animationDuration: '2s', animationDelay: '-1.0s', animationFillMode: 'backwards' }}></div>
          
          {/* Pulsing lights (left) */}
          <div className="absolute top-12 left-8 w-3 h-3 bg-accent/40 rounded-full animate-pulse" style={{ animationDuration: '1.8s', animationDelay: '-0.6s', animationFillMode: 'backwards' }}></div>

          {/* Small star (right) */}
          <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-secondary/60 rounded-full animate-pulse" style={{ animationDuration: '2.5s', animationDelay: '-1.3s', animationFillMode: 'backwards', willChange: 'opacity' }}></div>
          
          {/* Small star (left) */}
          <div className="absolute top-1/4 left-1/3 w-1 h-1 bg-accent/60 rounded-full animate-pulse" style={{ animationDuration: '3s', animationDelay: '-0.9s', animationFillMode: 'backwards', willChange: 'opacity' }}></div>
        </>
      )}
      
      {showGlow && (
        <div className="absolute -right-32 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 opacity-10 sm:opacity-15 md:opacity-40 lg:opacity-60 pointer-events-none pwa-bottom-glow">
          <div className="absolute inset-0 bg-primary-glow/40 rounded-full hidden md:block blur-[120px]"></div>
          <div className="absolute inset-4 bg-primary-glow/30 rounded-full hidden md:block blur-[100px]"></div>
          <div className="absolute inset-8 bg-primary-glow/25 rounded-full blur-[40px] md:blur-[80px]"></div>
        </div>
      )}
    </div>
  );
});

AnimatedBackground.displayName = 'AnimatedBackground';
