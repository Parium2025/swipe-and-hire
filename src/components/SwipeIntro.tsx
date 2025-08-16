import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Heart, ArrowRight, Play, Smartphone, Video, Sparkles, Hand } from 'lucide-react';
import { useDevice } from '@/hooks/use-device';

interface SwipeIntroProps {
  onComplete: () => void;
}

const SwipeIntro: React.FC<SwipeIntroProps> = ({ onComplete }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const device = useDevice();

  const slides = [
    {
      title: "Välkommen till Parium",
      subtitle: "Framtiden börjar med ett swipe",
      content: (
        <div className="flex flex-col items-center space-y-6">
          <div className="relative">
            {/* Stor, dramatisk telefon med 3D-effekt */}
            <div className="relative transform-gpu hover:scale-105 transition-transform duration-500">
              {/* 3D skugga */}
              <div className="absolute top-2 left-2 w-40 h-72 rounded-[2rem] bg-black/20 blur-xl"></div>
              
              {/* Telefon med gradient border */}
              <div className="relative w-40 h-72 rounded-[2rem] border-4 border-gradient-to-r from-primary-foreground/80 via-secondary/60 to-primary-foreground/80 p-4 bg-gradient-to-b from-primary-foreground/15 to-primary-foreground/5 backdrop-blur-lg shadow-2xl">
                {/* Skärm med glow effekt */}
                <div className="relative w-full h-full rounded-[1.5rem] bg-gradient-to-br from-primary/30 via-primary/20 to-secondary/30 overflow-hidden flex items-center justify-center shadow-inner">
                  {/* Ambient glow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-secondary/20 via-transparent to-primary/20 animate-pulse"></div>
                  
                  {/* Premium swipe animation */}
                  <div className="relative z-10 flex flex-col items-center space-y-4">
                    {/* Hand med glow */}
                    <div className="relative w-16 h-8 flex items-center">
                      <div className="absolute" style={{ animation: 'swipeLeft 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}>
                        <div className="relative">
                          <Hand className="h-6 w-6 text-primary-foreground rotate-90 drop-shadow-lg" />
                          <div className="absolute inset-0 bg-primary-foreground/30 rounded-full blur-sm animate-pulse"></div>
                        </div>
                      </div>
                      
                      {/* Premium trail med färggradient */}
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full h-1 bg-gradient-to-l from-secondary/80 via-primary-foreground/60 to-transparent rounded-full shadow-lg" style={{ filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))' }}></div>
                      </div>
                      
                      {/* Pil med trail */}
                      <div className="absolute right-0" style={{ animation: 'arrowLeft 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite 0.4s' }}>
                        <ArrowRight className="h-5 w-5 text-secondary rotate-180 drop-shadow-lg" />
                      </div>
                    </div>
                    
                    {/* Pulsande Parium logo/symbol */}
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-secondary to-primary flex items-center justify-center animate-pulse">
                      <div className="w-4 h-4 rounded-full bg-primary-foreground"></div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating action button med glow */}
              <div className="absolute -bottom-3 -right-3 bg-gradient-to-r from-secondary to-primary rounded-full p-3 shadow-2xl animate-bounce">
                <ArrowRight className="h-6 w-6 text-primary-foreground" />
                <div className="absolute inset-0 rounded-full bg-secondary/30 animate-ping"></div>
              </div>
            </div>
            
            {/* Kraftfull instruktionstext */}
            <div className="text-center mt-8">
              <p className="text-primary-foreground/90 text-lg font-bold mb-2 tracking-wide">
                {device === 'mobile' || device === 'tablet' ? 'SWIPA VÄNSTER' : 'KLICKA ELLER TRYCK →'}
              </p>
              <p className="text-primary-foreground/60 text-sm font-medium">
                för att fortsätta din resa
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Snabbare än att skriva ett CV",
      subtitle: "Ladda upp en kort profilvideo – låt jobben hitta dig",
      content: (
        <div className="flex flex-col items-center space-y-6">
          <div className="relative">
            <div className="w-32 h-32 bg-gradient-to-br from-primary to-secondary rounded-full border-4 border-primary-foreground/20 flex items-center justify-center">
              <Video className="h-12 w-12 text-primary-foreground" />
            </div>
            <div className="absolute -top-2 -right-2 bg-primary-foreground rounded-full p-2">
              <Play className="h-4 w-4 text-primary animate-pulse" />
            </div>
          </div>
          <div className="text-center max-w-xs">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Sparkles className="h-5 w-5 text-yellow-400" />
              <span className="text-primary-foreground/80 text-sm">30 sekunder = 1000 ord</span>
              <Sparkles className="h-5 w-5 text-yellow-400" />
            </div>
            <p className="text-primary-foreground/60 text-xs">
              Visa din personlighet och få jobb att komma till dig
            </p>
          </div>
        </div>
      )
    },
    {
      title: "Jobbmatchning på ett helt nytt sätt",
      subtitle: "Swipa, Matcha, Börja",
      content: (
        <div className="flex flex-col items-center space-y-6">
          <div className="relative">
            <div className="w-48 h-80 bg-white/10 rounded-3xl border border-white/20 p-4 backdrop-blur-sm">
              <div className="bg-gradient-to-br from-primary to-secondary rounded-2xl h-full flex flex-col justify-between p-4">
                <div className="text-center">
                  <h3 className="text-primary-foreground font-bold text-lg mb-2">Frontend Developer</h3>
                  <p className="text-primary-foreground/80 text-sm">Stockholm • 45,000 kr/mån</p>
                </div>
                <div className="flex justify-center space-x-4">
                  <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-primary-foreground text-xl">✕</span>
                  </div>
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
                    <Heart className="h-6 w-6 text-primary-foreground fill-primary-foreground" />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 bg-green-500 rounded-full p-3 animate-bounce">
              <Heart className="h-5 w-5 text-primary-foreground fill-primary-foreground" />
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Låt oss börja din resa idag",
      subtitle: "Gratis att testa. Snabbt att starta.",
      content: (
        <div className="flex flex-col items-center space-y-8">
          <div className="relative">
            <div className="relative">
              <Heart className="h-20 w-20 text-red-500 fill-red-500 animate-pulse" />
              <div className="absolute inset-0 rounded-full border-4 border-red-500/30 animate-ping" />
            </div>
            <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2">
              <div className="bg-primary-foreground rounded-xl p-3 shadow-lg">
                <div className="text-xs text-primary font-semibold">Match!</div>
              </div>
            </div>
          </div>
          <Button 
            onClick={onComplete}
            size="lg"
            className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-bold text-lg px-8 py-4 rounded-full shadow-xl hover:scale-105 transition-all duration-200"
          >
            Skapa min profil nu
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <p className="text-primary-foreground/60 text-xs text-center max-w-xs">
            Ingen bindningstid • Avsluta när som helst • 100% säkert
          </p>
        </div>
      )
    }
  ];

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setCurrentX(e.touches[0].clientX);
    setIsDragging(true);
    setDragOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    
    const newX = e.touches[0].clientX;
    const diffX = newX - startX;
    
    // Begränsa drag-avstånd med elastisk effekt
    const maxDrag = 100;
    const elasticFactor = 0.3;
    let constrainedDiff = diffX;
    
    if (Math.abs(diffX) > maxDrag) {
      const excess = Math.abs(diffX) - maxDrag;
      const elasticOffset = excess * elasticFactor;
      constrainedDiff = diffX > 0 ? maxDrag + elasticOffset : -maxDrag - elasticOffset;
    }
    
    setCurrentX(newX);
    setDragOffset(constrainedDiff);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const endX = e.changedTouches[0].clientX;
    const diffX = startX - endX;
    
    // Kräv större rörelse för att aktivera slide-byte
    if (Math.abs(diffX) > 80) {
      if (diffX > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
    
    // Återställ position med animation
    setIsDragging(false);
    setDragOffset(0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setStartX(e.clientX);
    setCurrentX(e.clientX);
    setIsDragging(true);
    setDragOffset(0);
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    
    const newX = e.clientX;
    const diffX = newX - startX;
    
    // Samma elastiska effekt för mus
    const maxDrag = 100;
    const elasticFactor = 0.3;
    let constrainedDiff = diffX;
    
    if (Math.abs(diffX) > maxDrag) {
      const excess = Math.abs(diffX) - maxDrag;
      const elasticOffset = excess * elasticFactor;
      constrainedDiff = diffX > 0 ? maxDrag + elasticOffset : -maxDrag - elasticOffset;
    }
    
    setCurrentX(newX);
    setDragOffset(constrainedDiff);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const endX = e.clientX;
    const diffX = startX - endX;
    
    if (Math.abs(diffX) > 80) {
      if (diffX > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
    
    // Återställ position med animation
    setIsDragging(false);
    setDragOffset(0);
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      setDragOffset(0);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide]);

  return (
    <div className="min-h-screen bg-gradient-parium relative overflow-hidden">
      {/* Static animated background - matched to mobile auth */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-primary-dark"></div>
        
        {/* Soft fade at bottom to prevent hard edges */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary-dark via-primary-dark/80 to-transparent"></div>
        
        {/* Animated floating elements */}
        <div className="absolute top-20 left-10 w-4 h-4 bg-secondary/30 rounded-full animate-bounce" style={{ animationDuration: '2s' }}></div>
        <div className="absolute top-32 left-16 w-2 h-2 bg-accent/40 rounded-full animate-bounce" style={{ animationDuration: '2.5s' }}></div>
        <div className="absolute top-24 left-20 w-3 h-3 bg-secondary/20 rounded-full animate-bounce" style={{ animationDuration: '3s' }}></div>
        
        <div className="absolute bottom-40 right-20 w-5 h-5 bg-accent/30 rounded-full animate-bounce" style={{ animationDuration: '2.2s' }}></div>
        <div className="absolute bottom-32 right-16 w-3 h-3 bg-secondary/25 rounded-full animate-bounce" style={{ animationDuration: '2.8s' }}></div>
        <div className="absolute bottom-36 right-24 w-2 h-2 bg-accent/35 rounded-full animate-bounce" style={{ animationDuration: '2.3s' }}></div>
        
        {/* Pulsing lights */}
        <div className="absolute top-10 right-10 w-3 h-3 bg-secondary/40 rounded-full animate-pulse" style={{ animationDuration: '1.5s' }}></div>
        <div className="absolute top-16 right-20 w-2 h-2 bg-accent/30 rounded-full animate-pulse" style={{ animationDuration: '2s' }}></div>
        <div className="absolute top-12 left-8 w-3 h-3 bg-accent/40 rounded-full animate-pulse" style={{ animationDuration: '1.8s' }}></div>
        
        {/* Small stars */}
        <div className="absolute top-1/4 left-1/3 w-1 h-1 bg-accent/60 rounded-full animate-pulse" style={{ animationDuration: '3s' }}>
          <div className="absolute inset-0 bg-accent/40 rounded-full animate-ping" style={{ animationDuration: '3s' }}></div>
        </div>
        <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-secondary/60 rounded-full animate-pulse" style={{ animationDuration: '2.5s' }}>
          <div className="absolute inset-0 bg-secondary/40 rounded-full animate-ping" style={{ animationDuration: '2.5s' }}></div>
        </div>
      </div>

      {/* Content Container */}
      <div className="relative z-10 h-screen flex items-center justify-center p-8 cursor-grab active:cursor-grabbing select-none"
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <div 
          className="text-center max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg mx-auto px-6 transition-transform duration-300"
          style={{
            transform: `translateX(${dragOffset}px)`,
            transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {/* Hero Title med gradient */}
          <h1 className={`font-black text-transparent bg-clip-text bg-gradient-to-r from-primary-foreground via-secondary to-primary-foreground mb-6 animate-fade-in leading-tight tracking-tight ${
            currentSlide === 0 
              ? 'text-5xl md:text-7xl lg:text-8xl' 
              : 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl break-words'
          }`}>
            {slides[currentSlide].title}
          </h1>
          
          {/* Kraftfull subtitle */}
          <p className={`text-primary-foreground/95 mb-16 animate-fade-in leading-relaxed font-semibold tracking-wide ${
            currentSlide === 0 
              ? 'text-2xl md:text-3xl' 
              : 'text-lg sm:text-xl md:text-2xl'
          }`}>{slides[currentSlide].subtitle}</p>

          {/* Slide Content */}
          <div className="mb-12 animate-scale-in">
            {slides[currentSlide].content}
          </div>

          {/* Progress Dots */}
          <div className="flex justify-center space-x-3 mb-8">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentSlide 
                    ? 'bg-primary-foreground scale-125' 
                    : 'bg-primary-foreground/30 hover:bg-primary-foreground/50'
                }`}
              />
            ))}
          </div>

          {/* Navigation Hint */}
          {currentSlide < slides.length - 1 && (
            <div className="text-center">
              <p className="text-primary-foreground/50 text-sm mb-4">
                {device === 'mobile' || device === 'tablet' 
                  ? 'Nästa generation av jobbsök är här' 
                  : 'Klicka eller använd piltangenterna'
                }
              </p>
              {device === 'desktop' && (
                <Button
                  onClick={nextSlide}
                  variant="outline"
                  size="lg"
                  className="bg-primary-foreground/10 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/20 hover:scale-105 transition-all duration-200"
                >
                  Nästa
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SwipeIntro;