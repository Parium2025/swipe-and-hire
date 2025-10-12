import React from 'react';

/**
 * Animated background with bubbles and glow effects
 * Used across auth and main app for visual consistency
 */
interface AnimatedBackgroundProps {
  showBubbles?: boolean;
}

export const AnimatedBackground = React.memo(({ showBubbles = true }: AnimatedBackgroundProps) => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0" style={{ paddingTop: 'var(--pwa-top-offset, 0px)', transform: 'translateY(var(--pwa-top-offset, 0px))' }}>
      {showBubbles && (
        <>
          {/* Animated floating elements */}
          <div className="absolute top-20 left-10 w-4 h-4 bg-secondary/30 rounded-full animate-bounce" style={{ animationDuration: '2s' }}></div>
          <div className="absolute top-32 left-16 w-2 h-2 bg-accent/40 rounded-full animate-bounce" style={{ animationDuration: '2.5s' }}></div>
          <div className="absolute top-24 left-20 w-3 h-3 bg-secondary/20 rounded-full animate-bounce" style={{ animationDuration: '3s' }}></div>
          
          <div className="absolute bottom-40 right-20 w-5 h-5 bg-accent/30 rounded-full animate-bounce" style={{ animationDuration: '2.2s' }}></div>
          <div className="absolute bottom-32 right-16 w-3 h-3 bg-secondary/25 rounded-full animate-bounce" style={{ animationDuration: '2.8s' }}></div>
          <div className="absolute bottom-36 right-24 w-2 h-2 bg-accent/35 rounded-full animate-bounce" style={{ animationDuration: '2.3s' }}></div>
          
          {/* Pulsing lights */}
          <div className="absolute top-10 right-10 w-3 h-3 bg-secondary/40 rounded-full animate-pulse" style={{ animationDuration: '1.5s' }}></div>
          <div className="absolute top-16 right-20 w-2 h-2 bg-accent/30 rounded-full animate-pulse" style={{ animationDuration: '2s' }}></div>
          <div className="absolute top-12 left-8 w-3 h-3 bg-accent/40 rounded-full animate-pulse" style={{ animationDuration: '1.8s' }}></div>
          
          {/* Small stars */}
          <div className="absolute top-1/4 left-1/3 w-1 h-1 bg-accent/60 rounded-full animate-pulse" style={{ animationDuration: '3s' }}>
            <div className="absolute inset-0 bg-accent/40 rounded-full animate-ping" style={{ animationDuration: '3s' }}></div>
          </div>
          <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-secondary/60 rounded-full animate-pulse" style={{ animationDuration: '2.5s' }}>
            <div className="absolute inset-0 bg-secondary/40 rounded-full animate-ping" style={{ animationDuration: '2.5s' }}></div>
          </div>
        </>
      )}
      
      {/* Decorative glow effect in bottom right corner - always shown */}
      <div className="absolute -right-32 w-96 h-96 pointer-events-none pwa-bottom-glow">
        <div className="absolute inset-0 bg-primary-glow/40 rounded-full blur-[120px]"></div>
        <div className="absolute inset-4 bg-primary-glow/30 rounded-full blur-[100px]"></div>
        <div className="absolute inset-8 bg-primary-glow/25 rounded-full blur-[80px]"></div>
      </div>
    </div>
  );
});
