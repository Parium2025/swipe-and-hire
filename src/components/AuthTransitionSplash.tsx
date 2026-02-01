import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { AUTH_SPLASH_HIDE_EVENT, AUTH_SPLASH_SHOW_EVENT } from "@/lib/authSplashEvents";

/**
 * UI-only overlay to guarantee the auth logo is visible immediately during navigation
 * to /auth (e.g. from Landing or while logging out).
 *
 * Uses the same PNG as the pre-React splash so it benefits from global <link preload>
 * + early decode in main.tsx.
 */
export function AuthTransitionSplash() {
  const [open, setOpen] = useState(false);
  const [present, setPresent] = useState(false);

  useEffect(() => {
    const onShow = () => {
      setPresent(true);
      setOpen(true);
    };

    const onHide = () => setOpen(false);

    window.addEventListener(AUTH_SPLASH_SHOW_EVENT, onShow);
    window.addEventListener(AUTH_SPLASH_HIDE_EVENT, onHide);
    return () => {
      window.removeEventListener(AUTH_SPLASH_SHOW_EVENT, onShow);
      window.removeEventListener(AUTH_SPLASH_HIDE_EVENT, onHide);
    };
  }, []);

  useEffect(() => {
    if (open) return;
    if (!present) return;
    const t = window.setTimeout(() => setPresent(false), 180);
    return () => window.clearTimeout(t);
  }, [open, present]);

  if (!present) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none",
        "bg-parium-gradient transition-opacity duration-200",
        open ? "opacity-100" : "opacity-0"
      )}
    >
      <img
        src="/lovable-uploads/parium-auth-logo.png"
        alt="Parium"
        decoding="sync"
        loading="eager"
        fetchPriority="high"
        width={560}
        height={224}
        className="block w-[min(560px,90vw)] h-auto object-contain"
        draggable={false}
      />
    </div>
  );
}

export default AuthTransitionSplash;
