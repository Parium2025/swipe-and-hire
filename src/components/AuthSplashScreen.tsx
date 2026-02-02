import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { authSplashEvents } from '@/lib/authSplashEvents';
import authLogoDataUri from '@/assets/parium-auth-logo.png?inline';
import { useDevice } from '@/hooks/use-device';

// Minsta visningstid för att garantera att loggan hinner laddas och avkodas
const MINIMUM_DISPLAY_MS = 4000;

/**
 * AuthSplashScreen - Premium "loading shell" för auth-sidan.
 * 
 * Matchar exakt auth-sidans logo-storlek och position så att
 * fade-out landar pixel-perfekt på den riktiga loggan.
 */
export function AuthSplashScreen() {
  const location = useLocation();
  const device = useDevice();
  
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
    
    setIsVisible(true);
    setIsFadingOut(false);
    
    const showTimer = setTimeout(() => {
      setIsFadingOut(true);
      
      const hideTimer = setTimeout(() => {
        setIsVisible(false);
        setIsFadingOut(false);
        authSplashEvents.hide();
      }, 500);
      
      return () => clearTimeout(hideTimer);
    }, MINIMUM_DISPLAY_MS);
    
    return () => clearTimeout(showTimer);
  }, [isTriggered, isVisible]);
  
  if (!isVisible) return null;
  
  // Beräkna storlek baserat på device för att matcha auth-sidans logo
  // Desktop: h-56 (224px), lg: h-64 (256px)
  // Mobile: h-40 (160px) * scale-125 = 200px
  const isMobile = device === 'mobile';
  const isLargeDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
  
  const logoHeight = isMobile ? 200 : (isLargeDesktop ? 256 : 224);
  
  // Padding-top matchar auth-sidans layout
  // Desktop: py-8 (32px) + lite centrering i 260px container ≈ 50px
  // Mobile: safe-area + pt-6 (24px)
  const paddingTop = isMobile 
    ? 'calc(env(safe-area-inset-top, 0px) + 24px)' 
    : '50px';
  
  // Text-storlek matchar auth-sidans h1
  // Desktop: text-xl (1.25rem), lg: text-2xl (1.5rem)
  // Mobile: text-2xl (1.5rem)
  const fontSize = isMobile ? '1.5rem' : (isLargeDesktop ? '1.5rem' : '1.25rem');
  
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
        paddingTop,
        transform: 'translateZ(0)',
        willChange: 'opacity',
      }}
    >
      {/* Parium Logo - exakt samma höjd som AuthLogoInline */}
      <img
        src={authLogoDataUri}
        alt="Parium"
        className="select-none pointer-events-none"
        style={{ 
          height: `${logoHeight}px`,
          width: 'auto',
          transform: 'translateZ(0)',
        }}
        decoding="sync"
        loading="eager"
        fetchPriority="high"
      />
      
      {/* Tagline - matchar auth-sidans h1 */}
      <p 
        className="text-white font-semibold drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
        style={{
          fontSize,
          letterSpacing: '-0.01em',
          marginTop: isMobile ? '4px' : '8px',
          marginBottom: '40px',
        }}
      >
        Din karriärresa börjar här
      </p>
      
      {/* Pulserande prickar */}
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
