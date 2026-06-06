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
              <stop offset="100%" stopColor="hsl(215 100% 10%)" />
            </linearGradient>
          </defs>

          {/* Off-white botten-fyllning under hela drip-zonen */}
          <rect x="0" y="0" width="1440" height="600" fill="hsl(var(--landing-light))" />

          {/* Navy-block med flat botten + vertikala rundade pelare som hänger ner.
              Pelarna är stadium-formade (rundade i båda ändar) men eftersom de
              ankrar uppe i navy-blocket smälter toppen ihop = ser ut som riktig
              icicle/paint-drip referens. */}
          {/* 1) Flat navy-block överst */}
          <rect
            x="0"
            y="-40"
            width="1440"
            height="120"
            fill="url(#landing-drip-volume)"
          />

          {/* 2) Hängande pelare i varierande höjd & bredd */}
          {[
            { x: 30,   w: 28, h: 90 },
            { x: 78,   w: 22, h: 140 },
            { x: 120,  w: 26, h: 70 },
            { x: 168,  w: 30, h: 180 },
            { x: 222,  w: 22, h: 110 },
            { x: 268,  w: 28, h: 60 },
            { x: 320,  w: 24, h: 150 },
            { x: 368,  w: 30, h: 95 },
            { x: 422,  w: 22, h: 200 },
            { x: 470,  w: 26, h: 75 },
            { x: 518,  w: 28, h: 130 },
            { x: 572,  w: 22, h: 165 },
            { x: 618,  w: 30, h: 80 },
            { x: 672,  w: 24, h: 220 },
            { x: 720,  w: 28, h: 105 },
            { x: 772,  w: 22, h: 145 },
            { x: 818,  w: 30, h: 65 },
            { x: 872,  w: 26, h: 175 },
            { x: 922,  w: 22, h: 90 },
            { x: 968,  w: 30, h: 195 },
            { x: 1022, w: 24, h: 115 },
            { x: 1072, w: 28, h: 70 },
            { x: 1122, w: 22, h: 160 },
            { x: 1168, w: 30, h: 100 },
            { x: 1222, w: 26, h: 185 },
            { x: 1272, w: 22, h: 80 },
            { x: 1318, w: 28, h: 140 },
            { x: 1370, w: 24, h: 95 },
            { x: 1408, w: 30, h: 170 },
          ].map((p, i) => (
            <rect
              key={`pillar-${i}`}
              x={p.x}
              y={50}
              width={p.w}
              height={p.h}
              rx={p.w / 2}
              ry={p.w / 2}
              fill="url(#landing-drip-volume)"
            />
          ))}

          {/* 3) Lösa droppar — små runda pärlor utspridda under pelarna */}
          {[
            { cx: 92,   cy: 260, r: 7 },
            { cx: 145,  cy: 230, r: 5 },
            { cx: 246,  cy: 250, r: 6 },
            { cx: 345,  cy: 290, r: 8 },
            { cx: 395,  cy: 240, r: 5 },
            { cx: 498,  cy: 320, r: 7 },
            { cx: 550,  cy: 270, r: 6 },
            { cx: 645,  cy: 300, r: 5 },
            { cx: 698,  cy: 360, r: 8 },
            { cx: 798,  cy: 280, r: 6 },
            { cx: 848,  cy: 240, r: 5 },
            { cx: 945,  cy: 310, r: 7 },
            { cx: 998,  cy: 350, r: 6 },
            { cx: 1098, cy: 260, r: 5 },
            { cx: 1148, cy: 305, r: 7 },
            { cx: 1248, cy: 330, r: 6 },
            { cx: 1298, cy: 260, r: 5 },
            { cx: 1395, cy: 290, r: 7 },
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
