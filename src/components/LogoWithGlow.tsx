import React from "react";

interface LogoWithGlowProps {
  className?: string;
}

// Clean logo without any glow effects - matching the original design
export const LogoWithGlow: React.FC<LogoWithGlowProps> = ({ className = "h-40 w-auto" }) => {
  return (
    <div className="relative mx-auto w-fit">
      {/* Circular blue glow behind the logo - perfectly round */}
      <div
        aria-hidden
        className="pointer-events-none absolute -z-10 rounded-full"
        style={{
          width: 'clamp(180px, 24vw, 320px)',
          height: 'clamp(180px, 24vw, 320px)',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          background:
            'radial-gradient(circle at 50% 50%, hsl(var(--secondary) / 0.34) 0%, hsl(var(--secondary) / 0.18) 32%, hsl(var(--secondary) / 0.08) 55%, transparent 72%)',
          filter: 'blur(26px)',
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
