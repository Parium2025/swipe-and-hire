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
            {/* Subtil vertikal djupgradient för glasyr-droppar (navy) */}
            <linearGradient id="landing-drip-volume" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(215 100% 14%)" />
              <stop offset="100%" stopColor="hsl(215 100% 9%)" />
            </linearGradient>
          </defs>

          {/* Off-white våg-fyllning */}
          <path
            d="M0,80 C200,120 380,110 560,80 C760,46 940,44 1120,72 C1270,96 1360,100 1440,82 L1440,600 L0,600 Z"
            fill="hsl(var(--landing-light))"
          />

          {/* Glasyr-droppar — navy, hänger ner från vågens underkant.
              Asymmetriska, varierande längd/bredd. ViewBox är 1440×600, så
              droppar behöver vara breda nog att synas efter skalning till skärm. */}

          {/* Drop 1 — medel, vänster (x≈230) */}
          <path
            d="M200,112 C200,112 192,196 232,196 C272,196 264,112 264,112 Z"
            fill="url(#landing-drip-volume)"
          />

          {/* Drop 2 — stor, mitten (djupast, x≈740) */}
          <path
            d="M700,50 C700,50 686,272 742,272 C798,272 784,50 784,50 Z"
            fill="url(#landing-drip-volume)"
          />

          {/* Drop 3 — medel, höger-mitt (x≈1050) */}
          <path
            d="M1018,68 C1018,68 1008,168 1052,168 C1096,168 1086,68 1086,68 Z"
            fill="url(#landing-drip-volume)"
          />

          {/* Drop 4 — liten, höger (x≈1310) */}
          <path
            d="M1286,98 C1286,98 1280,162 1314,162 C1348,162 1342,98 1342,98 Z"
            fill="url(#landing-drip-volume)"
          />
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
