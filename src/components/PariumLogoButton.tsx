// Use public path to match the preload in index.html (no Vite hash)
const LOGO_SRC = "/assets/parium-logo-rings.png";

type PariumLogoButtonProps = {
  onClick: () => void;
  ariaLabel: string;
};

const LOGO_W = 160;
const LOGO_H = 40;

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

/**
 * Home button (logo) using the same structure as profile Avatar:
 * - Always show a fallback immediately (never blank)
 * - Let the browser paint the cached image immediately (no opacity gating)
 */
export function PariumLogoButton({ onClick, ariaLabel }: PariumLogoButtonProps) {
  return (
    <button
      onClick={onClick}
      className="relative z-20 flex items-center hover:opacity-80 transition-opacity shrink-0"
      aria-label={ariaLabel}
      style={{ marginLeft: -4 }}
    >
      <div className="relative h-10 w-40 pointer-events-none" aria-hidden="true">
        {/* Instant fallback mark (no network, never blank) */}
        <PariumRingsMark className="absolute left-0 top-0 h-10 w-10 text-primary" />

        {/* Real logo */}
        <img
          src={LOGO_SRC}
          alt=""
          aria-hidden="true"
          width={LOGO_W}
          height={LOGO_H}
          loading="eager"
          decoding="sync"
          fetchPriority="high"
          className="absolute inset-0 h-10 w-40 object-contain"
        />
      </div>
    </button>
  );
}
