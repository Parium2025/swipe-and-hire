import React from "react";

interface LogoWithGlowProps {
  className?: string;
  // Optionally adjust glow size/intensity per breakpoint
  glowSize?: number; // pixel inset expansion for the glow container
}

// Reusable logo with a circular, soft radial glow that blends with the dark background.
// Uses semantic design tokens via HSL CSS variables.
export const LogoWithGlow: React.FC<LogoWithGlowProps> = ({ className = "h-40 w-auto", glowSize = 120 }) => {
  return (
    <div className="relative mx-auto w-fit">
      {/* Subtle radial glow behind the logo - matching original design */}
      <div
        aria-hidden
        className="pointer-events-none absolute -z-10 rounded-full"
        style={{
          // Much smaller expansion for subtlety
          inset: `-60px`,
          background:
            // Very subtle circular falloff - much lower opacity to match original
            "radial-gradient(circle at 50% 50%, hsl(var(--secondary) / 0.15) 0%, hsl(var(--secondary) / 0.08) 35%, hsl(var(--secondary) / 0.04) 55%, transparent 70%)",
          filter: "blur(24px)",
        }}
      />

      {/* Brand logo */}
      <img
        src="/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png"
        alt="Parium"
        className={`relative ${className}`}
        width={400}
        height={160}
        loading="eager"
        decoding="sync"
        fetchPriority="high"
      />
    </div>
  );
};

export default LogoWithGlow;
