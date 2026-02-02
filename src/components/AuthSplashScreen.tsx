import { useEffect, useState, useSyncExternalStore } from 'react';
import { authSplashEvents } from '@/lib/authSplashEvents';
import { useDevice } from '@/hooks/use-device';

// Minsta visningstid för att garantera att loggan hinner laddas och avkodas
const MINIMUM_DISPLAY_MS = 2000;

/**
 * AuthSplashScreen - Premium "loading shell" för auth-sidan.
 * 
 * Matchar EXAKT samma struktur som index.html #auth-splash
 * så att fade-in/out blir pixel-perfekt oavsett entry-point.
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
    setImageLoaded(false);
  }, [isTriggered, isVisible]);
  
  // Trigger fade-in when image is loaded
  useEffect(() => {
    if (isVisible && imageLoaded && !isFadingOut) {
      // Use requestAnimationFrame for smooth fade-in like index.html
      requestAnimationFrame(() => {
        setIsFadingIn(true);
      });
    }
  }, [isVisible, imageLoaded, isFadingOut]);
  
  // Auto-hide after minimum display time
  useEffect(() => {
    if (!isTriggered || !isVisible) return;
    
    const timer = setTimeout(() => {
      setIsFadingIn(false);
      setIsFadingOut(true);
      
      setTimeout(() => {
        setIsVisible(false);
        setIsFadingOut(false);
        authSplashEvents.hide();
      }, 500);
    }, MINIMUM_DISPLAY_MS);
    
    return () => clearTimeout(timer);
  }, [isTriggered, isVisible]);
  
  if (!isVisible) return null;
  
  // Beräkna storlekar som matchar index.html EXAKT
  const isMobile = device === 'mobile';
  const isLargeDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
  
  // Logo: desktop 224px, lg 256px, mobile 200px
  const logoHeight = isMobile ? 200 : (isLargeDesktop ? 256 : 224);
  
  // Padding-top: desktop 50px, mobile safe-area + 24px
  const paddingTop = isMobile 
    ? 'calc(env(safe-area-inset-top, 0px) + 24px)' 
    : '50px';
  
  // Tagline font-size: desktop 1.25rem, lg/mobile 1.5rem
  const fontSize = isMobile ? '1.5rem' : (isLargeDesktop ? '1.5rem' : '1.25rem');
  
  // Tagline margin-top: desktop 8px, mobile 4px
  const taglineMarginTop = isMobile ? '4px' : '8px';
  
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
        paddingTop,
        background: 'hsl(215, 100%, 12%)',
        opacity: isFadingIn && !isFadingOut ? 1 : 0,
        transition: 'opacity 0.4s ease-out',
        transform: 'translateZ(0)',
        willChange: 'opacity',
        pointerEvents: isFadingOut ? 'none' : 'auto',
      }}
    >
      {/* Parium Logo - exakt samma som index.html */}
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
      
      {/* Tagline - exakt samma som index.html */}
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
        }}
      >
        Din karriärresa börjar här
      </p>
      
      {/* Pulserande prickar - exakt samma som index.html */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
