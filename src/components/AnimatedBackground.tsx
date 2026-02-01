import { memo } from 'react';

/**
 * Animated background with bubbles and glow effects.
 * 
 * PERFORMANCE: On touch devices animations are disabled to free GPU/CPU for
 * instant button responsiveness. Only the static glow is rendered.
 */
interface AnimatedBackgroundProps {
  showBubbles?: boolean;
  variant?: 'viewport' | 'card';
}

// Detect touch device once (cheap, avoids re-eval on each render)
const isTouchDevice =
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

export const AnimatedBackground = memo(({ showBubbles = true, variant = 'viewport' }: AnimatedBackgroundProps) => {
  const positionClass = variant === 'card' ? 'absolute' : 'fixed';

  // On touch devices skip animated bubbles entirely for max responsiveness
  const renderBubbles = showBubbles && !isTouchDevice;

  return (
    <div className={`${positionClass} inset-0 pointer-events-none z-0`}>
      {renderBubbles && (
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
          <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-secondary/60 rounded-full animate-pulse" style={{ animationDuration: '2.5s', animationDelay: '-1.3s', animationFillMode: 'backwards' }}>
            <div className="absolute inset-0 bg-secondary/40 rounded-full animate-ping" style={{ animationDuration: '2.5s', animationDelay: '-1.3s', animationFillMode: 'backwards' }}></div>
          </div>
          
          {/* Small star (left) */}
          <div className="absolute top-1/4 left-1/3 w-1 h-1 bg-accent/60 rounded-full animate-pulse" style={{ animationDuration: '3s', animationDelay: '-0.9s', animationFillMode: 'backwards' }}>
            <div className="absolute inset-0 bg-accent/40 rounded-full animate-ping" style={{ animationDuration: '3s', animationDelay: '-0.9s', animationFillMode: 'backwards' }}></div>
          </div>
        </>
      )}
      
      {/* Decorative glow effect in bottom right corner - always shown */}
      <div className="absolute -right-32 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 opacity-10 sm:opacity-15 md:opacity-40 lg:opacity-60 pointer-events-none pwa-bottom-glow">
        <div className="absolute inset-0 bg-primary-glow/40 rounded-full blur-[120px]"></div>
        <div className="absolute inset-4 bg-primary-glow/30 rounded-full blur-[100px]"></div>
        <div className="absolute inset-8 bg-primary-glow/25 rounded-full blur-[80px]"></div>
      </div>
    </div>
  );
});

AnimatedBackground.displayName = 'AnimatedBackground';
