import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { authSplashEvents } from '@/lib/authSplashEvents';
import authLogoDataUri from '@/assets/parium-auth-logo.png?inline';

// Minsta visningstid för att garantera att loggan hinner laddas och avkodas
const MINIMUM_DISPLAY_MS = 4000;

/**
 * AuthSplashScreen - Premium "loading shell" för auth-sidan.
 * 
 * Visas i 4 sekunder vid navigering till /auth för att:
 * 1. Ge tid för Parium-loggan att laddas och avkodas helt
 * 2. Skapa en premium "Spotify-känsla" vid övergång
 * 3. Dölja eventuell laddningsfördröjning på svagt internet
 */
export function AuthSplashScreen() {
  const location = useLocation();
  const isAuthRoute = location.pathname === '/auth';
  
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
  }, [isTriggered]);
  
  // Visa inte om vi inte är på /auth och splash inte är triggad
  if (!isVisible) return null;
  
  return (
    <div
      className={`
        fixed inset-0 z-[9999] flex flex-col items-center justify-center
        bg-parium-gradient
        transition-opacity duration-500 ease-out
        ${isFadingOut ? 'opacity-0' : 'opacity-100'}
      `}
      style={{
        // Samma gradient som auth-sidan för sömlös övergång
        background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-dark)) 100%)',
      }}
    >
      {/* Parium Logo - inbäddad data-URI för 0 nätverksanrop */}
      <img
        src={authLogoDataUri}
        alt="Parium"
        className="h-[60px] w-auto mb-6 select-none pointer-events-none"
        style={{
          // Tvinga synkron avkodning för omedelbar rendering
        }}
        decoding="sync"
        loading="eager"
        fetchPriority="high"
      />
      
      {/* Tagline */}
      <p className="text-white/90 text-lg font-medium tracking-wide mb-8">
        Din karriärresa börjar här
      </p>
      
      {/* Pulserande prickar - långsam, premium animation */}
      <div className="flex items-center gap-2">
        <span 
          className="w-2.5 h-2.5 rounded-full bg-white/60"
          style={{
            animation: 'authSplashPulse 2.5s ease-in-out infinite',
            animationDelay: '0s',
          }}
        />
        <span 
          className="w-2.5 h-2.5 rounded-full bg-white/60"
          style={{
            animation: 'authSplashPulse 2.5s ease-in-out infinite',
            animationDelay: '0.4s',
          }}
        />
        <span 
          className="w-2.5 h-2.5 rounded-full bg-white/60"
          style={{
            animation: 'authSplashPulse 2.5s ease-in-out infinite',
            animationDelay: '0.8s',
          }}
        />
      </div>
      
      {/* CSS för pulsanimation */}
      <style>{`
        @keyframes authSplashPulse {
          0%, 100% {
            opacity: 0.4;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.15);
          }
        }
      `}</style>
    </div>
  );
}

export default AuthSplashScreen;
