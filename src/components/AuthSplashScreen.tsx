import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { authSplashEvents } from '@/lib/authSplashEvents';
import authLogoDataUri from '@/assets/parium-auth-logo.png?inline';

// Minsta visningstid för att garantera att loggan hinner laddas och avkodas
const MINIMUM_DISPLAY_MS = 4000;

/**
 * AuthSplashScreen - Premium "loading shell" för auth-sidan.
 * 
 * Exakt match av referensbilden:
 * - Parium-logga centrerad (240px bred)
 * - "Din karriärresa börjar här" tätt under loggan
 * - Tre långsamma pulserande prickar (2.5s cykel)
 * - Blå gradient-bakgrund
 */
export function AuthSplashScreen() {
  const location = useLocation();
  
  // Prenumerera på splash-events
  const isTriggered = useSyncExternalStore(
    authSplashEvents.subscribe,
    () => authSplashEvents.isVisible(),
    () => false
  );
  
  const [isVisible, setIsVisible] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  
  useEffect(() => {
    if (!isTriggered) {
      // Snabb fade-out om vi avbryter
      if (isVisible) {
        setIsFadingOut(true);
        const timer = setTimeout(() => {
          setIsVisible(false);
          setIsFadingOut(false);
        }, 300);
        return () => clearTimeout(timer);
      }
      return;
    }
    
    // Visa splash omedelbart
    setIsVisible(true);
    setIsFadingOut(false);
    
    // Starta timer för minsta visningstid
    const showTimer = setTimeout(() => {
      // Starta fade-out efter 4 sekunder
      setIsFadingOut(true);
      
      // Göm helt efter fade-out animation
      const hideTimer = setTimeout(() => {
        setIsVisible(false);
        setIsFadingOut(false);
        authSplashEvents.hide();
      }, 500);
      
      return () => clearTimeout(hideTimer);
    }, MINIMUM_DISPLAY_MS);
    
    return () => clearTimeout(showTimer);
  }, [isTriggered, isVisible]);
  
  // Visa inte om splash inte är triggad
  if (!isVisible) return null;
  
  return (
    <div
      className={`
        fixed inset-0 z-[9999] flex flex-col items-center justify-center
        transition-opacity duration-500 ease-out
        ${isFadingOut ? 'opacity-0' : 'opacity-100'}
      `}
      style={{
        // Exakt samma gradient som auth-sidan
        background: 'linear-gradient(135deg, hsl(210, 100%, 25%) 0%, hsl(210, 100%, 15%) 100%)',
      }}
    >
      {/* Parium Logo - STOR som i referensbilden (240px bred) */}
      <img
        src={authLogoDataUri}
        alt="Parium"
        className="w-[240px] h-auto mb-4 select-none pointer-events-none"
        decoding="sync"
        loading="eager"
        fetchPriority="high"
      />
      
      {/* Tagline - tätt under loggan som i referensbilden */}
      <p className="text-white text-xl font-medium tracking-wide mb-12">
        Din karriärresa börjar här
      </p>
      
      {/* Pulserande prickar - exakt som i referensbilden */}
      <div className="flex items-center gap-3">
        <span 
          className="w-3 h-3 rounded-full bg-white/70"
          style={{
            animation: 'authSplashPulse 2.5s ease-in-out infinite',
            animationDelay: '0s',
          }}
        />
        <span 
          className="w-3 h-3 rounded-full bg-white/70"
          style={{
            animation: 'authSplashPulse 2.5s ease-in-out infinite',
            animationDelay: '0.4s',
          }}
        />
        <span 
          className="w-3 h-3 rounded-full bg-white/70"
          style={{
            animation: 'authSplashPulse 2.5s ease-in-out infinite',
            animationDelay: '0.8s',
          }}
        />
      </div>
      
      {/* CSS för pulsanimation - långsam och premium */}
      <style>{`
        @keyframes authSplashPulse {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }
      `}</style>
    </div>
  );
}

export default AuthSplashScreen;
