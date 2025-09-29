import React from "react";

interface LogoWithGlowProps {
  className?: string;
}

// Beautiful logo with subtle glow effects
export const LogoWithGlow: React.FC<LogoWithGlowProps> = ({ className = "h-40 w-auto" }) => {
  return (
    <div className="relative mx-auto w-fit">
      {/* Soft blue glow behind logo */}
      <div 
        className="absolute inset-0 rounded-lg"
        style={{
          filter: 'blur(20px)',
          background: 'radial-gradient(ellipse at center, rgba(0, 150, 255, 0.3) 0%, rgba(0, 100, 255, 0.15) 50%, transparent 70%)',
          transform: 'scale(1.2)',
          zIndex: -1
        }}
      />
      
      {/* Brand logo with subtle shadow */}
      <img
        src="/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png"
        alt="Parium"
        className={`relative ${className}`}
        style={{
          filter: 'drop-shadow(0 4px 20px rgba(0, 150, 255, 0.4))',
        }}
        width={400}
        height={160}
        loading="eager"
        decoding="sync"
      />
    </div>
  );
};

export default LogoWithGlow;
