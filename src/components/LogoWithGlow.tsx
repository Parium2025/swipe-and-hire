import React from "react";

interface LogoWithGlowProps {
  className?: string;
}

// Clean logo without any glow effects - matching the original design
export const LogoWithGlow: React.FC<LogoWithGlowProps> = ({ className = "h-40 w-auto" }) => {
  return (
    <div className="relative mx-auto w-fit">
      {/* Brand logo - no glow effects */}
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
