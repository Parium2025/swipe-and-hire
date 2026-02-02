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
 * PIXEL-PERFECT: Matchar exakt auth-sidans logo-container (260px höjd på desktop)
 * så att fade-out landar sömlöst på den riktiga loggan utan hopp.
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
  
  // EXAKT samma layout som AuthDesktop/AuthMobile för pixel-perfekt match
  const isMobile = device === 'mobile';
  
  // Logo-storlek matchar exakt AuthDesktop/AuthMobile
  const logoClassName = cn(
    'pointer-events-none select-none transform-gpu',
    isMobile
      ? 'relative h-40 w-[min(400px,90vw)] scale-125'
      : 'relative h-56 w-[min(35rem,90vw)] lg:h-64 lg:w-[min(40rem,90vw)]'
  );
  
  return (
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex flex-col transition-opacity duration-500 ease-out',
        isFadingOut ? 'opacity-0' : 'opacity-100'
      )}
      style={{
        background: 'hsl(215, 100%, 12%)',
        transform: 'translateZ(0)',
        willChange: 'opacity',
      }}
    >
      {/* Exakt samma struktur som AuthDesktop: py-8 + centered content */}
      <div className="relative z-10 flex flex-col min-h-screen py-8 px-6">
        {/* Header med logo - samma struktur som auth-sidan */}
        <div className="flex flex-col items-center w-full max-w-2xl mx-auto">
          <div className="text-center mb-4">
            <div className="mb-2">
              {/* 260px container matchar AuthDesktop exakt */}
              <div 
                className="relative mx-auto w-fit flex items-center justify-center" 
                style={{ height: isMobile ? '200px' : '260px' }}
              >
                {/* Glow effect bakom loggan - exakt som auth-sidan */}
                <div className="absolute inset-0 flex items-center justify-center -translate-y-2">
                  <div className="w-72 h-52 bg-primary-glow/25 rounded-full blur-[40px]"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center -translate-y-2">
                  <div className="w-52 h-36 bg-primary-glow/22 rounded-full blur-[35px]"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center -translate-y-2">
                  <div className="w-44 h-28 bg-primary-glow/20 rounded-full blur-[30px]"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center -translate-y-2">
                  <div className="w-36 h-20 bg-primary-glow/18 rounded-full blur-[25px]"></div>
                </div>
                
                {/* Logo - exakt samma som auth-sidan */}
                <AuthLogoInline className={logoClassName} />
              </div>
            </div>
            
            {/* Tagline - matchar auth-sidans h1 exakt */}
            <h1 className="text-xl lg:text-2xl font-semibold text-white mb-3 relative z-10 [color:rgb(255,255,255)] drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
              Din karriärresa börjar här
            </h1>
          </div>
          
          {/* Pulserande prickar under där formuläret skulle vara */}
          <div className="w-full max-w-md flex justify-center pt-8">
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
          </div>
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
