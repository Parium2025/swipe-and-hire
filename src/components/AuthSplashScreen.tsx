import { useEffect, useState, useSyncExternalStore } from 'react';
import { authSplashEvents } from '@/lib/authSplashEvents';

import authLogoDataUri from '@/assets/parium-auth-logo.png?inline';

// Minsta visningstid för att garantera att loggan hinner laddas och avkodas
const MINIMUM_DISPLAY_MS = 2000;

/**
 * AuthSplashScreen - Premium "loading shell" för auth-sidan.
 * 
 * Matchar EXAKT samma struktur som index.html #auth-splash
 * så att fade-in/out blir pixel-perfekt oavsett entry-point.
 */
export function AuthSplashScreen() {
  
  
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
  
  // Trigger content fade-in when image is loaded. The shell background itself is
  // opaque immediately so protected/outside pages never flash during logout.
  useEffect(() => {
    if (isVisible && imageLoaded && !isFadingOut) {
      // Use requestAnimationFrame for smooth fade-in like index.html
      requestAnimationFrame(() => {
        setIsFadingIn(true);
      });
    }
  }, [isVisible, imageLoaded, isFadingOut]);

  // SAFETY: If the logo load event never fires (rare caching/network edge cases),
  // we must not leave an invisible full-screen layer that blocks all interaction.
  useEffect(() => {
    if (!isVisible || imageLoaded) return;
    const t = setTimeout(() => {
      setImageLoaded(true);
    }, 800);
    return () => clearTimeout(t);
  }, [isVisible, imageLoaded]);
  
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
  
  // CSS clamp() handles all sizing fluidly — no JS breakpoint logic needed
  
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
        paddingTop: 'clamp(calc(env(safe-area-inset-top, 0px) + 24px), 5vw, 50px)',
        background: 'hsl(215, 100%, 12%)',
        opacity: isFadingOut ? 0 : 1,
        transition: 'opacity 0.5s ease-out',
        transform: 'translateZ(0)',
        willChange: 'opacity',
        pointerEvents: isFadingOut ? 'none' : 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: isFadingIn && !isFadingOut ? 1 : 0,
          transition: 'opacity 0.4s ease-out',
        }}
      >
        {/* Parium Logo - inbäddad data-URI (offline-redo) */}
        <img
          src={authLogoDataUri}
          alt="Parium"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(true)}
          style={{ 
            height: 'clamp(200px, 30vw, 256px)',
            width: 'auto',
            marginBottom: 0,
            transform: 'translateZ(0)',
          }}
          decoding="sync"
          loading="eager"
          fetchPriority="high"
        />
        
        {/* Tagline - exakt samma som index.html */}
        <p 
          style={{
            color: 'white',
            fontSize: 'clamp(1.25rem, 2.5vw, 1.5rem)',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            marginTop: 'clamp(4px, 1vw, 8px)',
            marginBottom: '40px',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          }}
        >
          Din karriärresa börjar här
        </p>
        
        {/* Pulserande prickar - exakt samma som index.html */}
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
