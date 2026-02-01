import { useEffect, useState, useSyncExternalStore } from 'react';
import { authSplashEvents } from '@/lib/authSplashEvents';
import { useDevice } from '@/hooks/use-device';
import { AuthLogoInline } from '@/assets/authLogoInline';
import { cn } from '@/lib/utils';

// Minsta visningstid för att garantera att loggan hinner laddas och avkodas
const MINIMUM_DISPLAY_MS = 4000;

/**
 * AuthSplashScreen - Premium "loading shell" för auth-sidan.
 * 
 * Matchar exakt auth-sidans logo-storlek och position så att
 * fade-out landar pixel-perfekt på den riktiga loggan.
 */
export function AuthSplashScreen() {
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
  
  // Matcha EXAKT samma constraints som AuthDesktop/AuthMobile för att undvika
  // att loggan blir större än 90vw (det som orsakar "gigantisk" logo-flash).
  const isMobile = device === 'mobile';
  const isLargeDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
  const logoClassName = cn(
    'pointer-events-none select-none transform-gpu',
    isMobile
      ? 'relative h-40 w-[min(400px,90vw)] scale-125'
      : 'relative h-56 w-[min(35rem,90vw)] lg:h-64 lg:w-[min(40rem,90vw)]'
  );
  
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
      {/* Parium Logo - renderas med EXAKT samma layout som auth-sidan */}
      <AuthLogoInline className={logoClassName} />
      
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
