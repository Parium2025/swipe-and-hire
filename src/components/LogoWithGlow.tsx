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
      {/* Radial glow behind the logo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -z-10 rounded-full"
        style={{
          // Expand beyond the image bounds to avoid any hard edges
          inset: `-${glowSize}px`,
          background:
            // Smooth circular falloff using semantic token --secondary
            "radial-gradient(circle at 50% 50%, hsl(var(--secondary) / 0.55) 0%, hsl(var(--secondary) / 0.35) 28%, hsl(var(--secondary) / 0.18) 48%, hsl(var(--secondary) / 0.08) 62%, transparent 75%)",
          filter: "blur(14px)",
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
