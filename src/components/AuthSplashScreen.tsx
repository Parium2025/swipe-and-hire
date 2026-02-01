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
        fixed inset-0 z-[9999] flex flex-col items-center
        transition-opacity duration-500 ease-out
        ${isFadingOut ? 'opacity-0' : 'opacity-100'}
      `}
      style={{
        background: 'hsl(215, 100%, 12%)',
        justifyContent: 'flex-start',
        // Matchar auth-sidans layout: safe-area + pt-6(24px) + center av 200px container
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px + 76px)',
        transform: 'translateZ(0)',
        willChange: 'opacity',
      }}
    >
      {/* Parium Logo - matchar AuthLogoInline storlek: h-40 * scale-125 */}
      <img
        src={authLogoDataUri}
        alt="Parium"
        className="w-[350px] h-auto select-none pointer-events-none"
        style={{ transform: 'translateZ(0)', marginBottom: '-24px' }}
        decoding="sync"
        loading="eager"
        fetchPriority="high"
      />
      
      {/* Tagline - matchar auth-sidans h1: text-2xl font-semibold + drop-shadow */}
      <p className="text-white text-2xl font-semibold tracking-tight mb-12 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
        Din karriärresa börjar här
      </p>
      
      {/* Pulserande prickar - GPU-accelererade med negativ delay */}
      <div className="flex items-center gap-2.5">
        <span 
          className="w-2.5 h-2.5 rounded-full bg-white/60"
          style={{
            animation: 'authSplashPulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            animationDelay: '-1.7s',
            transform: 'translateZ(0)',
            willChange: 'opacity, transform',
          }}
        />
        <span 
          className="w-2.5 h-2.5 rounded-full bg-white/60"
          style={{
            animation: 'authSplashPulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            animationDelay: '-1.3s',
            transform: 'translateZ(0)',
            willChange: 'opacity, transform',
          }}
        />
        <span 
          className="w-2.5 h-2.5 rounded-full bg-white/60"
          style={{
            animation: 'authSplashPulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            animationDelay: '-0.9s',
            transform: 'translateZ(0)',
            willChange: 'opacity, transform',
          }}
        />
      </div>
      
      {/* CSS för mjuk pulsanimation */}
      <style>{`
        @keyframes authSplashPulse {
          0%, 100% {
            opacity: 0.4;
            transform: translateZ(0) scale(1);
          }
          50% {
            opacity: 1;
            transform: translateZ(0) scale(1.15);
          }
        }
      `}</style>
    </div>
  );
}

export default AuthSplashScreen;
