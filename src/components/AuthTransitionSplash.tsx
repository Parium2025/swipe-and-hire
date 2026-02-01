import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { AUTH_SPLASH_HIDE_EVENT, AUTH_SPLASH_SHOW_EVENT } from "@/lib/authSplashEvents";
import authLogoDataUri from "@/assets/parium-auth-logo.png?inline";

/**
 * Branded loading splash that acts as a "shell" during navigation to /auth.
 * 
 * Shows:
 * - Parium logo
 * - "Din karriärresa börjar här" tagline
 * - Animated pulsing dots
 * 
 * Displayed when:
 * - Clicking "Logga in" from landing page
 * - Logging out
 * - Refresh when navigating to outsidan
 * 
 * NOT displayed when:
 * - Already logged in
 * - On the landing page itself
 * 
 * Stays visible for minimum ~1.5s to ensure everything loads smoothly.
 */
export function AuthTransitionSplash() {
  const [open, setOpen] = useState(false);
  const [present, setPresent] = useState(false);
  const showTimeRef = useRef<number>(0);
  const minDisplayMs = 4000; // Minimum display time for premium, consistent shell

  useEffect(() => {
    const onShow = () => {
      showTimeRef.current = Date.now();
      setPresent(true);
      setOpen(true);
    };

    const onHide = () => {
      // Ensure minimum display time before hiding
      const elapsed = Date.now() - showTimeRef.current;
      const remaining = Math.max(0, minDisplayMs - elapsed);
      
      if (remaining > 0) {
        setTimeout(() => setOpen(false), remaining);
      } else {
        setOpen(false);
      }
    };

    window.addEventListener(AUTH_SPLASH_SHOW_EVENT, onShow);
    window.addEventListener(AUTH_SPLASH_HIDE_EVENT, onHide);
    return () => {
      window.removeEventListener(AUTH_SPLASH_SHOW_EVENT, onShow);
      window.removeEventListener(AUTH_SPLASH_HIDE_EVENT, onHide);
    };
  }, []);

  // Remove from DOM after fade-out animation completes
  useEffect(() => {
    if (open) return;
    if (!present) return;
    const t = window.setTimeout(() => setPresent(false), 300);
    return () => window.clearTimeout(t);
  }, [open, present]);

  if (!present) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "fixed inset-0 z-[9999] flex flex-col items-center justify-center",
        "bg-parium-gradient transition-opacity duration-300",
        open ? "opacity-100" : "opacity-0"
      )}
    >
      {/* Logo */}
      <img
        src={authLogoDataUri}
        alt="Parium"
        decoding="sync"
        loading="eager"
        fetchPriority="high"
        width={240}
        height={96}
        // The PNG has built-in whitespace under the text; pull the next line up.
        className="block w-[min(240px,60vw)] h-auto object-contain mb-[-64px]"
        draggable={false}
      />
      
      {/* Tagline */}
      <p className="mt-0 text-white/90 text-lg sm:text-xl font-medium tracking-wide text-center px-4">
        Din karriärresa börjar här
      </p>
      
      {/* Animated dots */}
      <div className="mt-6 flex items-center gap-2">
        {([0, 400, 800] as const).map((delay) => (
          <span
            key={delay}
            className="w-3 h-3 rounded-full"
            style={{
              background: 'hsl(var(--primary-glow))',
              opacity: 0.35,
              transform: 'scale(0.85) translateZ(0)',
              willChange: 'transform, opacity',
              backfaceVisibility: 'hidden',
              animation: `splash-pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite ${delay}ms`,
              animationFillMode: 'both',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default AuthTransitionSplash;
