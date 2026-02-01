import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { AUTH_SPLASH_HIDE_EVENT, AUTH_SPLASH_SHOW_EVENT } from "@/lib/authSplashEvents";

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
  const minDisplayMs = 1500; // Minimum display time for smooth loading

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
        src="/lovable-uploads/parium-auth-logo.png"
        alt="Parium"
        decoding="sync"
        loading="eager"
        fetchPriority="high"
        width={240}
        height={96}
        className="block w-[min(240px,60vw)] h-auto object-contain"
        draggable={false}
      />
      
      {/* Tagline */}
      <p className="mt-6 text-white/90 text-lg sm:text-xl font-medium tracking-wide text-center px-4">
        Din karriärresa börjar här
      </p>
      
      {/* Animated dots */}
      <div className="mt-6 flex items-center gap-2">
        <span 
          className="w-3 h-3 rounded-full bg-secondary animate-pulse"
          style={{ animationDelay: '0ms', animationDuration: '1s' }}
        />
        <span 
          className="w-3 h-3 rounded-full bg-secondary animate-pulse"
          style={{ animationDelay: '200ms', animationDuration: '1s' }}
        />
        <span 
          className="w-3 h-3 rounded-full bg-secondary animate-pulse"
          style={{ animationDelay: '400ms', animationDuration: '1s' }}
        />
      </div>
    </div>
  );
}

export default AuthTransitionSplash;
