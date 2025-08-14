import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Heart, ArrowRight, Play, Smartphone, Video, Sparkles } from 'lucide-react';
import { useDevice } from '@/hooks/use-device';

interface SwipeIntroProps {
  onComplete: () => void;
}

const SwipeIntro: React.FC<SwipeIntroProps> = ({ onComplete }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [startX, setStartX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const device = useDevice();

  const slides = [
    {
      title: "Välkommen till Parium",
      subtitle: "Framtiden börjar med ett swipe",
      content: (
        <div className="flex flex-col items-center space-y-6">
          <div className="relative">
            <Smartphone className="h-24 w-24 text-white/80" />
            <div className="absolute -bottom-2 -right-2 bg-primary rounded-full p-2">
              <ArrowRight className="h-4 w-4 text-white animate-pulse" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-white/70 text-sm mb-4">
              {device === 'mobile' || device === 'tablet' ? 'Swipa höger för att fortsätta' : 'Tryck på pilen eller använd piltangenterna'}
            </p>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-8 h-1 bg-white/30 rounded-full overflow-hidden">
                <div className="w-full h-full bg-white animate-pulse" />
              </div>
              <ArrowRight className="h-4 w-4 text-white/60 animate-bounce" />
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Hitta ditt nästa jobb på sekunder",
      subtitle: "Svep. Matcha. Börja.",
      content: (
        <div className="flex flex-col items-center space-y-6">
          <div className="relative">
            <div className="w-48 h-80 bg-white/10 rounded-3xl border border-white/20 p-4 backdrop-blur-sm">
              <div className="bg-gradient-to-br from-primary to-secondary rounded-2xl h-full flex flex-col justify-between p-4">
                <div className="text-center">
                  <h3 className="text-white font-bold text-lg mb-2">Frontend Developer</h3>
                  <p className="text-white/80 text-sm">Stockholm • 45,000 kr/mån</p>
                </div>
                <div className="flex justify-center space-x-4">
                  <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xl">✕</span>
                  </div>
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
                    <Heart className="h-6 w-6 text-white fill-white" />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 bg-green-500 rounded-full p-3 animate-bounce">
              <Heart className="h-5 w-5 text-white fill-white" />
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
            <div className="w-32 h-32 bg-gradient-to-br from-primary to-secondary rounded-full border-4 border-white/20 flex items-center justify-center">
              <Video className="h-12 w-12 text-white" />
            </div>
            <div className="absolute -top-2 -right-2 bg-white rounded-full p-2">
              <Play className="h-4 w-4 text-primary animate-pulse" />
            </div>
          </div>
          <div className="text-center max-w-xs">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Sparkles className="h-5 w-5 text-yellow-400" />
              <span className="text-white/80 text-sm">30 sekunder = 1000 ord</span>
              <Sparkles className="h-5 w-5 text-yellow-400" />
            </div>
            <p className="text-white/60 text-xs">
              Visa din personlighet och få jobb att komma till dig
            </p>
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
              <div className="bg-white rounded-xl p-3 shadow-lg">
                <div className="text-xs text-gray-800 font-semibold">Match!</div>
              </div>
            </div>
          </div>
          <Button 
            onClick={onComplete}
            size="lg"
            className="bg-white text-primary hover:bg-white/90 font-bold text-lg px-8 py-4 rounded-full shadow-xl hover:scale-105 transition-all duration-200"
          >
            Skapa min profil nu
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <p className="text-white/60 text-xs text-center max-w-xs">
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
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const endX = e.changedTouches[0].clientX;
    const diffX = startX - endX;
    
    if (Math.abs(diffX) > 50) {
      if (diffX > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
    
    setIsDragging(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (device === 'desktop') {
      setStartX(e.clientX);
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || device !== 'desktop') return;
    e.preventDefault();
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging || device !== 'desktop') return;
    
    const endX = e.clientX;
    const diffX = startX - endX;
    
    if (Math.abs(diffX) > 50) {
      if (diffX > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
    
    setIsDragging(false);
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
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary-foreground to-secondary relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-32 h-32 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-white rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-white rounded-full blur-2xl" />
      </div>

      {/* Content Container */}
      <div
        ref={containerRef}
        className="relative h-screen flex items-center justify-center p-8 cursor-grab active:cursor-grabbing select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div className="text-center max-w-md mx-auto">
          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 animate-fade-in">
            {slides[currentSlide].title}
          </h1>
          
          {/* Subtitle */}
          <p className="text-xl text-white/80 mb-12 animate-fade-in">
            {slides[currentSlide].subtitle}
          </p>

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
                    ? 'bg-white scale-125' 
                    : 'bg-white/30 hover:bg-white/50'
                }`}
              />
            ))}
          </div>

          {/* Navigation Hint */}
          {currentSlide < slides.length - 1 && (
            <div className="text-center">
              <p className="text-white/50 text-sm mb-4">
                {device === 'mobile' || device === 'tablet' 
                  ? 'Swipa för att fortsätta' 
                  : 'Klicka eller använd piltangenterna'
                }
              </p>
              {device === 'desktop' && (
                <Button
                  onClick={nextSlide}
                  variant="outline"
                  size="lg"
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:scale-105 transition-all duration-200"
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