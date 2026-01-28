import { useEffect, useState } from "react";
import pariumLogoRings from "@/assets/parium-logo-rings.png";

type PariumLogoButtonProps = {
  onClick: () => void;
  ariaLabel: string;
};

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
    void ensureLogoReady(pariumLogoRings).finally(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <button
      onClick={onClick}
      // NOTE: We intentionally overlap the following nav items via negative marginRight.
      // Ensure the logo is always on top so it can't be visually covered ("pop in"/disappear)
      // when counts/labels change width during navigation.
      className="relative z-20 flex items-center hover:opacity-80 transition-opacity shrink-0"
      aria-label={ariaLabel}
      // -ml-1 (4px) + old -mr-[104px] to visually align and keep menus tight
      style={{ marginLeft: -4, marginRight: -104 }}
    >
      <div className="relative h-10 w-40 pointer-events-none" aria-hidden="true">
        {/* Fallback (always visible, like AvatarFallback) */}
        <div className="absolute inset-0 flex items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-primary/15 ring-1 ring-primary/25 flex items-center justify-center">
            <span className="text-primary text-sm font-bold">P</span>
          </div>
          <span className="text-foreground font-semibold tracking-wide">Parium</span>
        </div>

        {/* Real logo (only shown once loaded/decoded) */}
        <img
          src={pariumLogoRings}
          alt="Parium"
          width={160}
          height={40}
          loading="eager"
          decoding="sync"
          fetchPriority="high"
          className={`absolute inset-0 h-10 w-40 object-contain object-left transition-opacity duration-150 ${
            ready ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>
    </button>
  );
}
