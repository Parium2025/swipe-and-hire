import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { authSplashEvents } from '@/lib/authSplashEvents';

import authLogoDataUri from '@/assets/parium-auth-logo.png?inline';

// Bara en kort frame-cover. Den får täcka blink, men aldrig vänta in auth/profile.
// Premium app-feel: låt taglinen hinna andas. Login → app får längst tid
// eftersom /home behöver ett par frames på sig att rendera efter navigate,
// annars ser man en kort blink innan hemskärmen paintat.
const APP_TO_AUTH_COVER_MS = 620;
const AUTH_TO_APP_COVER_MS = 950;
const CONTENT_FADE_OUT_MS = 220;

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
  const [lockedRole, setLockedRole] = useState<string | null>(() => authSplashEvents.getRole());
  const wasTriggeredRef = useRef(false);
  const isVisibleRef = useRef(false);
  const cycleStartPathRef = useRef<string | null>(null);
  const isAuthPath = (path?: string | null) => path === '/auth' || path === '/auth/';

  useEffect(() => {
    isVisibleRef.current = isVisible;
    if (isVisible) {
      // React-overlayn är nu monterad och helt opak, så den synkrona gaten
      // som lades in i click-framen kan tas bort utan att något bakom syns.
      authSplashEvents.releaseGate();
    }
  }, [isVisible]);
  
  useEffect(() => {
    if (!isTriggered) {
      wasTriggeredRef.current = false;
      if (!isVisibleRef.current) return;

      // Fade CONTENT only (background stays opaque) so the app beneath
      // never blinks through a semi-transparent overlay.
      setIsFadingOut(true);
      setIsFadingIn(false);
      const timer = setTimeout(() => {
        isVisibleRef.current = false;
        setIsVisible(false);
        setIsFadingOut(false);
        setDotsFading(false);
      }, 180);
      return () => clearTimeout(timer);
    }

    // Kör init exakt en gång per splash-cykel. Tidigare kördes detta även när
    // isVisible slog om till true, vilket kunde nollställa opacity/imageLoaded
    // och skapa den korta blinkningen mitt i animationen.
    if (wasTriggeredRef.current) {
      return;
    }

    wasTriggeredRef.current = true;
    cycleStartPathRef.current = typeof window !== 'undefined' ? window.location.pathname : '/auth';

    // Lås taglinen för hela splash-cykeln. Rollen kan uppdateras i bakgrunden
    // under login, men texten får inte byta mitt i animationen och skapa blink.
    setLockedRole(authSplashEvents.getRole());
    setIsVisible(true);
    setIsFadingOut(false);
    setIsFadingIn(false);
    setDotsFading(false);
    setImageLoaded(false);
  }, [isTriggered]);
  
  // Trigger content fade-in when image is loaded. The shell background itself is
  // opaque immediately so protected/outside pages never flash during logout.
  useEffect(() => {
    if (isVisible && imageLoaded && !isFadingOut) {
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
  
  // Dölj efter en kort, fast cover. Vi väntar inte på route/profile/nätverk här,
  // eftersom logout då känns seg. Detta maskerar bara browserns enstaka blink-frame.
  useEffect(() => {
    if (!isTriggered || !isVisible) return;

    const startPath = cycleStartPathRef.current;
    if (!startPath) return;

    const coverMs = isAuthPath(startPath) ? AUTH_TO_APP_COVER_MS : APP_TO_AUTH_COVER_MS;
    let finishTimer: ReturnType<typeof setTimeout> | undefined;

    const dotsTimer = setTimeout(() => {
      setDotsFading(true);
    }, Math.max(coverMs - 80, 0));

    const timer = setTimeout(() => {
      setIsFadingIn(false);
      setIsFadingOut(true);
      
      // Background stays OPAQUE the whole time. When the content is fully
      // invisible we remove the shell in a single frame — no fade of the
      // background layer, so the app beneath never bleeds through.
      finishTimer = setTimeout(() => {
        isVisibleRef.current = false;
        setIsVisible(false);
        setIsFadingOut(false);
        setDotsFading(false);
        authSplashEvents.hide();
      }, CONTENT_FADE_OUT_MS);
    }, coverMs);
    
    return () => {
      clearTimeout(dotsTimer);
      clearTimeout(timer);
      if (finishTimer) clearTimeout(finishTimer);
    };
  }, [isTriggered, isVisible]);
  
  if (!isVisible) return null;
  
  // CSS clamp() handles all sizing fluidly — no JS breakpoint logic needed
  const displayRole = lockedRole === 'employer' ? 'employer' : 'job_seeker';
  
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 'clamp(calc(env(safe-area-inset-top, 0px) + 24px), 5vw, 50px)',
        background: 'hsl(215, 100%, 12%)',
        // Background is ALWAYS fully opaque — we never fade the shell itself,
        // only the inner content. This eliminates the "blink through" effect
        // where the app beneath was visible during a semi-transparent fade.
        opacity: 1,
        transform: 'translateZ(0)',
        pointerEvents: isFadingOut ? 'none' : 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: isFadingIn && !isFadingOut ? 1 : 0,
          transition: 'opacity 0.14s ease-out',
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
        
        {/* Tagline - exakt samma som index.html. Byter text beroende på
            senast kända roll (persisterad i localStorage av useAuth) så att
            arbetsgivare får en tagline anpassad för dem. */}
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
            visibility: 'visible',
          }}
        >
          {displayRole === 'employer'
            ? 'Bygg ditt drömteam här'
            : 'Din karriärresa börjar här'}
        </p>
        
        {/* Pulserande prickar - exakt samma som index.html */}
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
            opacity: dotsFading ? 0 : 1,
            transition: 'opacity 0.12s ease-out',
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
