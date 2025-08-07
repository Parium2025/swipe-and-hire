import { useEffect, useState } from 'react';

interface AnimatedIntroProps {
  onComplete: () => void;
}

const AnimatedIntro = ({ onComplete }: AnimatedIntroProps) => {
  const [phase, setPhase] = useState<'loading' | 'logo' | 'complete'>('loading');

  useEffect(() => {
    // Start with logo animation
    const logoTimer = setTimeout(() => {
      setPhase('logo');
    }, 200);

    // Complete after all letter animations finish (last letter starts at 2.0s + 0.8s duration)
    const completeTimer = setTimeout(() => {
      setPhase('complete');
      onComplete();
    }, 3000); // Back to 3s to show all letters properly

    return () => {
      clearTimeout(logoTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-primary flex items-center justify-center overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-radial from-primary-glow/20 via-primary to-primary animate-pulse"></div>
      
      {/* Main logo container */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo */}
        <div className={`transform transition-all duration-1000 ease-out ${
          phase === 'loading' 
            ? 'scale-50 opacity-0 translate-y-10' 
            : 'scale-100 opacity-100 translate-y-0'
        }`}>
          <div className="relative">
            {/* Glow effect behind logo */}
            <div className="absolute inset-0 blur-xl bg-secondary/40 rounded-full animate-pulse"></div>
            
            {/* Logo image */}
            <img 
              src="/lovable-uploads/parium-logo-transparent.png" 
              alt="Parium" 
              className="relative h-24 md:h-32 w-auto"
            />
          </div>
        </div>
        
        {/* Animated text */}
        <div className={`mt-8 transform transition-all duration-1000 delay-500 ease-out ${
          phase === 'loading' 
            ? 'scale-90 opacity-0 translate-y-5' 
            : 'scale-100 opacity-100 translate-y-0'
        }`}>
          <h1 className="text-3xl md:text-4xl font-bold text-primary-foreground text-center tracking-wider">
            <span className="inline-block opacity-0 animate-fade-in" style={{ animationDelay: '1s', animationDuration: '0.8s', animationFillMode: 'forwards' }}>P</span>
            <span className="inline-block opacity-0 animate-fade-in" style={{ animationDelay: '1.2s', animationDuration: '0.8s', animationFillMode: 'forwards' }}>A</span>
            <span className="inline-block opacity-0 animate-fade-in" style={{ animationDelay: '1.4s', animationDuration: '0.8s', animationFillMode: 'forwards' }}>R</span>
            <span className="inline-block opacity-0 animate-fade-in" style={{ animationDelay: '1.6s', animationDuration: '0.8s', animationFillMode: 'forwards' }}>I</span>
            <span className="inline-block opacity-0 animate-fade-in" style={{ animationDelay: '1.8s', animationDuration: '0.8s', animationFillMode: 'forwards' }}>U</span>
            <span className="inline-block opacity-0 animate-fade-in" style={{ animationDelay: '2.0s', animationDuration: '0.8s', animationFillMode: 'forwards' }}>M</span>
          </h1>
          
          {/* Subtitle */}
          <p className={`text-primary-foreground/80 text-center mt-4 text-lg transition-all duration-1000 delay-1000 ${
            phase === 'loading' ? 'opacity-0' : 'opacity-100'
          }`}>
            Din karriärresa börjar här
          </p>
        </div>
        
        {/* Loading dots */}
        <div className={`mt-12 flex space-x-2 transition-all duration-500 delay-1500 ${
          phase === 'loading' ? 'opacity-0' : 'opacity-100'
        }`}>
          <div className="w-3 h-3 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
          <div className="w-3 h-3 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-3 h-3 bg-secondary rounded-full" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
      
      {/* Fade out overlay */}
      <div className={`absolute inset-0 bg-primary transition-opacity duration-1000 ${
        phase === 'complete' ? 'opacity-0' : 'opacity-0'
      }`}></div>
    </div>
  );
};

export default AnimatedIntro;