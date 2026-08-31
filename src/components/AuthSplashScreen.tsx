import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { authSplashEvents } from '@/lib/authSplashEvents';

import authLogoDataUri from '@/assets/parium-auth-logo.png?inline';
import { fetchPriority } from '@/lib/fetchPriority';

// Bara en kort frame-cover. Logout är fast (den fungerar redan perfekt).
// Login är route-aware: splashen får inte släppa medan vi fortfarande är kvar
// på /auth, eftersom det är exakt då den lilla millisekunds-blinken syns.
const APP_TO_AUTH_COVER_MS = 620;
const AUTH_TO_APP_MIN_COVER_MS = 920;
const AUTH_TO_APP_MAX_COVER_MS = 2400;
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
  // Loggan är en inbäddad data-URI och för-dekodas i main.tsx. Vänta därför
  // inte på img.onload för att visa text/logga — på iOS/Safari kan just den
  // väntan skapa en kort blank blink i själva splashen.
  const [imageLoaded, setImageLoaded] = useState(true);
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
      }, CONTENT_FADE_OUT_MS);
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
    setImageLoaded(true);
  }, [isTriggered]);

  // Rollen är låst under cykeln för att undvika textbyte mitt i animationen.
  // ENDA undantaget: om vi startade utan känd roll (t.ex. första inloggningen
  // på en ny enhet) får vi uppgradera från default till verklig roll så att en
  // arbetsgivare aldrig fastnar i jobbsökar-taglinen.
  useEffect(() => {
    if (!isTriggered || lockedRole) return;
    const onRole = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === 'employer' || detail === 'job_seeker') {
        setLockedRole(detail);
      }
    };
    window.addEventListener('parium-auth-splash-role', onRole as EventListener);
    return () => window.removeEventListener('parium-auth-splash-role', onRole as EventListener);
  }, [isTriggered, lockedRole]);
  

  
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
  
  // Dölj efter en kort cover. Logout är fast och snabb. Login väntar dessutom
  // tills SPA-routen faktiskt har lämnat /auth + två frames, så vi aldrig
  // exponerar auth-vyn mellan splash och hemskärm.
  useEffect(() => {
    if (!isTriggered || !isVisible) return;

    const startPath = cycleStartPathRef.current;
    if (!startPath) return;

    const isLoginTransition = isAuthPath(startPath);
    const coverMs = isLoginTransition ? AUTH_TO_APP_MIN_COVER_MS : APP_TO_AUTH_COVER_MS;
    const startedAt = Date.now();
    let exitStarted = false;
    let dotsTimer: ReturnType<typeof setTimeout> | undefined;
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    let finishTimer: ReturnType<typeof setTimeout> | undefined;
    let routePollTimer: ReturnType<typeof setTimeout> | undefined;
    let rafOne: number | undefined;
    let rafTwo: number | undefined;

    const finish = () => {
      if (exitStarted) return;
      exitStarted = true;
      setIsFadingIn(false);
      setIsFadingOut(true);
      setDotsFading(true);
      
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
    };

    const finishAfterPaint = () => {
      rafOne = requestAnimationFrame(() => {
        rafTwo = requestAnimationFrame(finish);
      });
    };

    const waitForLoginRouteToPaint = () => {
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : startPath;
      const routeHasLeftAuth = !isAuthPath(currentPath);
      const hitSafetyCap = Date.now() - startedAt >= AUTH_TO_APP_MAX_COVER_MS;

      if (routeHasLeftAuth) {
        setDotsFading(true);
        routePollTimer = setTimeout(finishAfterPaint, 80);
        return;
      }

      if (hitSafetyCap) {
        finish();
        return;
      }

      routePollTimer = setTimeout(waitForLoginRouteToPaint, 40);
    };

    if (isLoginTransition) {
      exitTimer = setTimeout(waitForLoginRouteToPaint, coverMs);
    } else {
      dotsTimer = setTimeout(() => {
        setDotsFading(true);
      }, Math.max(coverMs - 80, 0));
      exitTimer = setTimeout(finish, coverMs);
    }
    
    return () => {
      clearTimeout(dotsTimer);
      clearTimeout(exitTimer);
      clearTimeout(routePollTimer);
      if (finishTimer) clearTimeout(finishTimer);
      if (rafOne) cancelAnimationFrame(rafOne);
      if (rafTwo) cancelAnimationFrame(rafTwo);
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
          transition: 'opacity 0.28s ease-out',
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
          {...fetchPriority('high')}
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
