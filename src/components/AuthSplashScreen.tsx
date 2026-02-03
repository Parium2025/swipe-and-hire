import { useEffect, useState, useSyncExternalStore } from 'react';
import { authSplashEvents } from '@/lib/authSplashEvents';
import { useDevice } from '@/hooks/use-device';

// Minsta visningstid för att garantera att loggan hinner laddas och avkodas
const MINIMUM_DISPLAY_MS = 2000;

// Minsta visningstid

/**
 * AuthSplashScreen - Premium "loading shell" för auth-sidan.
 * 
 * Synkad med auth-sidans layout så att logo + tagline
 * ligger EXAKT på samma position → sömlös fade-övergång.
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
  const [isFadingIn, setIsFadingIn] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [dotsFading, setDotsFading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  useEffect(() => {
    if (!isTriggered) {
      if (isVisible) {
        setIsFadingOut(true);
        const timer = setTimeout(() => {
          setIsVisible(false);
          setIsFadingOut(false);
          setIsFadingIn(false);
        }, 400);
        return () => clearTimeout(timer);
      }
      return;
    }
    
    setIsVisible(true);
    setIsFadingOut(false);
    setIsFadingIn(false);
    setDotsFading(false);
    setImageLoaded(false);
  }, [isTriggered, isVisible]);
  
  // Trigger fade-in when image is loaded
  useEffect(() => {
    if (isVisible && imageLoaded && !isFadingOut) {
      requestAnimationFrame(() => {
        setIsFadingIn(true);
      });
    }
  }, [isVisible, imageLoaded, isFadingOut]);
  
  // Auto-hide after minimum display time
  useEffect(() => {
    if (!isTriggered || !isVisible) return;
    
    // Fade dots 0.5s before splash fades
    const dotsTimer = setTimeout(() => {
      setDotsFading(true);
    }, MINIMUM_DISPLAY_MS - 500);
    
    const timer = setTimeout(() => {
      setIsFadingIn(false);
      setIsFadingOut(true);
      
      setTimeout(() => {
        setIsVisible(false);
        setIsFadingOut(false);
        setDotsFading(false);
        authSplashEvents.hide();
      }, 500);
    }, MINIMUM_DISPLAY_MS);
    
    return () => {
      clearTimeout(dotsTimer);
      clearTimeout(timer);
    };
  }, [isTriggered, isVisible]);
  
  if (!isVisible) return null;
  
  const isMobile = device === 'mobile';
  const isLargeDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // SYNKA MED AUTH-SIDANS LAYOUT (AuthMobile/AuthTablet/AuthDesktop)
  // ─────────────────────────────────────────────────────────────────────────────
  
  // Mobile: AuthMobile.tsx line 659: h-40 (160px) scale-125 = ~200px visual height
  // Tablet: AuthTablet.tsx line 592: h-[224px]
  // Desktop: AuthDesktop.tsx line 583: h-56 (224px), lg:h-64 (256px)
  const logoHeight = isMobile ? 200 : (isLargeDesktop ? 256 : 224);
  
  
  // Auth page padding structure:
  // Mobile: pt-6 (24px) + safe-area-inset-top via env()
  // Tablet: py-safe (auto) + pt-6 (24px) inside nested div
  // Desktop: py-8 (32px) + container padding
  const safePaddingTop = isMobile 
    ? 'calc(env(safe-area-inset-top, 0px) + 24px)' 
    : isLargeDesktop 
      ? '32px' 
      : '24px';
  
  // Tagline: Auth uses "Framtiden börjar med ett swipe"
  // Splash matches visual weight with "Din karriärresa börjar här"
  // Typography synced with auth: text-2xl font-semibold on mobile/tablet, xl-2xl on desktop
  const fontSize = isMobile ? '1.5rem' : (isLargeDesktop ? '1.5rem' : '1.25rem');
  
  // Gap between logo and tagline - match auth layout margins
  // AuthMobile: -mb-6 on logo container, mb-2 on h1
  // AuthDesktop: mb-2 on logo container, mb-3 on h1  
  const taglineMarginTop = isMobile ? '4px' : '12px';
  
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: safePaddingTop,
        paddingLeft: '24px',
        paddingRight: '24px',
        background: 'hsl(215, 100%, 12%)',
        opacity: isFadingIn && !isFadingOut ? 1 : 0,
        transition: 'opacity 0.4s ease-out',
        transform: 'translateZ(0)',
        willChange: 'opacity',
        pointerEvents: isFadingOut ? 'none' : 'auto',
      }}
    >
      {/* Parium Logo - enkel utan glow */}
      <img
        src="/parium-auth-logo.png"
        alt="Parium"
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageLoaded(true)}
        style={{ 
          height: `${logoHeight}px`,
          width: 'auto',
          marginBottom: 0,
          transform: 'translateZ(0)',
        }}
        decoding="sync"
        loading="eager"
        fetchPriority="high"
      />
      
      {/* Tagline - synced typography with auth page h1 */}
      <p 
        style={{
          color: 'white',
          fontSize,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          marginTop: taglineMarginTop,
          marginBottom: '40px',
          textShadow: '0 2px 4px rgba(0,0,0,0.3)',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          textAlign: 'center',
        }}
      >
        Din karriärresa börjar här
      </p>
      
      {/* Pulserande prickar */}
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px',
          opacity: dotsFading ? 0 : 1,
          transition: 'opacity 0.4s ease-out',
        }}
      >
        <span 
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.6)',
            animation: 'authSplashPulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            animationDelay: '-1.7s',
            transform: 'translateZ(0)',
            willChange: 'opacity, transform',
          }}
        />
        <span 
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.6)',
            animation: 'authSplashPulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            animationDelay: '-1.3s',
            transform: 'translateZ(0)',
            willChange: 'opacity, transform',
          }}
        />
        <span 
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.6)',
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
