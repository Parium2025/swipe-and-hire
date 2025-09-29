import React from "react";

interface LogoWithGlowProps {
  className?: string;
}

// Clean logo without any glow effects - matching the original design
export const LogoWithGlow: React.FC<LogoWithGlowProps> = ({ className = "h-40 w-auto" }) => {
  return (
    <div className="relative mx-auto w-fit">
      {/* Circular blue glow with mask to avoid any box edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute -z-10 rounded-full"
        style={{
          inset: '-120px',
          background:
            'radial-gradient(circle at 50% 50%, hsl(var(--secondary) / 0.28) 0%, hsl(var(--secondary) / 0.14) 35%, hsl(var(--secondary) / 0.06) 55%, transparent 78%)',
          filter: 'blur(28px)',
          maskImage:
            'radial-gradient(circle at 50% 50%, black 65%, transparent 82%)',
          WebkitMaskImage:
            'radial-gradient(circle at 50% 50%, black 65%, transparent 82%)',
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
      />
    </div>
  );
};

export default LogoWithGlow;
