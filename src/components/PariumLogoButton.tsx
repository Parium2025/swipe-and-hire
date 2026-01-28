import { useEffect, useState } from "react";

// Use public path to match the preload in index.html (no Vite hash)
const LOGO_SRC = "/assets/parium-logo-rings.png";

type PariumLogoButtonProps = {
  onClick: () => void;
  ariaLabel: string;
};

function PariumRingsMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={className}
      fill="none"
    >
      <g
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="26" cy="32" r="14" />
        <circle cx="40" cy="32" r="14" />
      </g>
    </svg>
  );
}

// Module-level cache so the logo stays "warm" across route remounts
let logoReady = false;
let logoReadyPromise: Promise<void> | null = null;

function ensureLogoReady(src: string) {
  if (logoReady) return Promise.resolve();
  if (logoReadyPromise) return logoReadyPromise;

  logoReadyPromise = new Promise((resolve) => {
    const img = new Image();

    const done = () => {
      logoReady = true;
      resolve();
    };

    img.onload = () => {
      // Try to decode into the image cache so paints are instant
      const anyImg = img as any;
      if (typeof anyImg.decode === "function") {
        anyImg.decode().then(done).catch(done);
      } else {
        done();
      }
    };
    img.onerror = done; // never block
    img.src = src;
  });

  return logoReadyPromise;
}

/**
 * Home button (logo) using the same structure as profile Avatar:
 * - Always show a fallback immediately (never blank)
 * - Fade logo in only once it's loaded/decoded
 */
export function PariumLogoButton({ onClick, ariaLabel }: PariumLogoButtonProps) {
  const [ready, setReady] = useState<boolean>(logoReady);

  useEffect(() => {
    let alive = true;
    void ensureLogoReady(LOGO_SRC).finally(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <button
      onClick={onClick}
      className="relative z-20 flex items-center hover:opacity-80 transition-opacity shrink-0"
      aria-label={ariaLabel}
      style={{ marginLeft: -4 }}
    >
      <div className="relative h-10 w-10 pointer-events-none" aria-hidden="true">
        {/* Instant fallback mark (no image loading, never blank) */}
        <PariumRingsMark className="absolute inset-0 h-10 w-10 text-primary" />

        {/* Real PNG (fades in when loaded/decoded; should look identical) */}
        <img
          src={LOGO_SRC}
          alt=""
          aria-hidden="true"
          width={40}
          height={40}
          loading="eager"
          decoding="sync"
          className={`absolute inset-0 h-10 w-10 object-contain transition-opacity duration-150 ${
            ready ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>
    </button>
  );
}
