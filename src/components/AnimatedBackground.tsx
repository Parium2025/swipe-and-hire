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
          <g fill="hsl(var(--landing-light))">
            {/* Bas-vågen (samma kurva som wave-text klipper mot — får inte ändras) */}
            <path d="M0,80 C200,120 380,110 560,80 C760,46 940,44 1120,72 C1270,96 1360,100 1440,82 L1440,600 L0,600 Z" />

            {/* Organiska glasyr-droppar som rinner upp ur vågen in i hero-blått.
                Varje droppe är en rundad rektangel som ankras lite under wave-Y
                så den smälter ihop med basformen utan glapp. */}
            {[
              { x: 70, y: 96, w: 24, h: 64 },
              { x: 158, y: 108, w: 18, h: 46 },
              { x: 232, y: 116, w: 26, h: 88 },
              { x: 318, y: 115, w: 16, h: 38 },
              { x: 402, y: 104, w: 28, h: 104 },
              { x: 484, y: 90, w: 20, h: 58 },
              { x: 568, y: 80, w: 24, h: 78 },
              { x: 656, y: 62, w: 18, h: 46 },
              { x: 738, y: 50, w: 26, h: 92 },
              { x: 822, y: 45, w: 16, h: 36 },
              { x: 906, y: 45, w: 28, h: 110 },
              { x: 988, y: 52, w: 20, h: 58 },
              { x: 1066, y: 64, w: 24, h: 80 },
              { x: 1148, y: 76, w: 18, h: 46 },
              { x: 1228, y: 90, w: 26, h: 96 },
              { x: 1306, y: 98, w: 16, h: 38 },
              { x: 1380, y: 94, w: 22, h: 70 },
            ].map((d, i) => {
              const r = d.w / 2;
              return (
                <rect
                  key={`drip-${i}`}
                  x={d.x - r}
                  y={d.y - d.h}
                  width={d.w}
                  height={d.h + r + 6}
                  rx={r}
                  ry={r}
                />
              );
            })}

            {/* Fristående droppar — som glasyr-stänk i hero-zonen ovanför vågen */}
            {[
              { cx: 118, cy: 60, r: 5 },
              { cx: 280, cy: 78, r: 4 },
              { cx: 440, cy: 56, r: 6 },
              { cx: 612, cy: 30, r: 5 },
              { cx: 786, cy: 18, r: 4 },
              { cx: 962, cy: 20, r: 5 },
              { cx: 1132, cy: 42, r: 6 },
              { cx: 1296, cy: 60, r: 5 },
              { cx: 1418, cy: 58, r: 4 },
            ].map((c, i) => (
              <circle key={`dot-${i}`} cx={c.cx} cy={c.cy} r={c.r} />
            ))}
          </g>
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
