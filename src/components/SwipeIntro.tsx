import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Heart, ArrowRight, Play, Camera, Video, Sparkles, Hand } from 'lucide-react';
import { useDevice } from '@/hooks/use-device';
import JobAdCard from '@/components/JobAdCard';
import officeBuilding from '@/assets/office-building.jpg';

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

  // Preload phone background image to avoid flicker/delay
  useEffect(() => {
    const img = new Image();
    img.src = officeBuilding;
  }, []);

  const slides = [
    {
      title: "Välkommen till Parium",
      subtitle: "Framtiden börjar med ett swipe",
      content: (
        <div className="flex flex-col items-center space-y-6">
          <div className="relative">
            <div className="w-32 h-52 rounded-[1.5rem] border-4 border-primary-foreground/60 p-3 bg-gradient-to-b from-primary-foreground/10 to-primary-foreground/5 backdrop-blur-sm">
              <div className="relative w-full h-full rounded-[1rem] bg-gradient-to-b from-primary/20 to-primary/40 overflow-hidden flex items-center justify-center">
                {/* Ren animerad swipe-gest utan text */}
                <div className="flex flex-col items-center space-y-3">
                  {/* Animerad swipe-gest */}
                  <div className="relative w-16 h-8 flex items-center">
                    {/* Hand-ikon som swiper */}
                    <div className="absolute text-primary-foreground" style={{ animation: 'swipeLeft 2s ease-in-out infinite' }}>
                    </div>
                    
                    {/* Swipe-spår */}
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full h-0.5 bg-gradient-to-l from-primary-foreground/70 via-primary-foreground/40 to-transparent rounded-full opacity-60"></div>
                    </div>
                    
                    {/* Pil som följer */}
                    <div className="absolute right-0" style={{ animation: 'arrowLeft 2s ease-in-out infinite 0.3s' }}>
                      <ArrowRight className="h-3 w-3 text-primary-foreground rotate-180" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-2 -right-2 bg-primary rounded-full p-2">
              <ArrowRight className="h-4 w-4 text-primary-foreground animate-pulse" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-white text-sm mb-4">
              {device === 'mobile' || device === 'tablet' ? 'Swipa vänster för att fortsätta' : 'Tryck på pilen eller använd piltangenterna'}
            </p>
          </div>
        </div>
      )
    },
    {
      title: "Skapa en profil",
      subtitle: "Ladda upp en kort profilvideo eller en bild",
      content: (
        <div className="flex flex-col items-center justify-center space-y-6 w-full">
          <div className="flex items-center justify-center space-x-4 min-w-full">
            {/* Video option */}
            <div className="relative">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-primary-foreground/20 p-2 bg-gradient-to-b from-primary-foreground/10 to-primary-foreground/5 backdrop-blur-sm">
                <div className="relative w-full h-full rounded-full bg-gradient-to-b from-primary/30 to-primary/50 overflow-hidden flex items-center justify-center">
                  <Video className="h-8 w-8 text-primary-foreground" />
                </div>
              </div>
              <div className="absolute -top-1 -right-1 bg-primary-foreground rounded-full p-1.5 shadow-lg">
                <Play className="h-3 w-3 text-primary animate-pulse" />
              </div>
            </div>

            {/* "eller" text */}
            <div className="text-white text-sm font-medium flex-shrink-0">
              eller
            </div>

            {/* Image option */}
            <div className="relative">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-primary-foreground/20 p-2 bg-gradient-to-b from-primary-foreground/10 to-primary-foreground/5 backdrop-blur-sm">
              <div className="relative w-full h-full rounded-full bg-gradient-to-b from-primary/30 to-primary/50 overflow-hidden flex items-center justify-center">
                <Camera className="h-8 w-8 text-primary-foreground" />
              </div>
              </div>
              <div className="absolute -top-1 -right-1 bg-primary-foreground rounded-full p-1.5 shadow-lg">
                <Camera className="h-3 w-3 text-primary animate-pulse" />
              </div>
            </div>
          </div>
          <div className="text-center max-w-xs">
            <p className="text-white text-sm">
              Din personlighet säger mer än ett CV
            </p>
          </div>
        </div>
      )
    },
    {
      title: "Jobbsök i ett swipe",
      subtitle: "Swipa, Matcha, Börja",
      content: (
        <div className="flex flex-col items-center space-y-8">
          <JobAdCard
            imageUrl={officeBuilding}
            title="UX Designer"
            company="Techno AB"
            location="Stockholm • Hybrid"
            tags={["Figma", "Adobe XD", "Design System"]}
            salary="52,000 kr"
            matchScore={94}
          />
        </div>
      )
    },
    {
      title: "Ta steget - starta direkt!",
      subtitle: "",
      content: (
        <div className="flex flex-col items-center space-y-8">
          {/* Stiliserad nedåtpil */}
          <div className="flex flex-col items-center space-y-2">
            <div className="w-0.5 h-8 bg-gradient-to-b from-primary-foreground/40 to-primary-foreground/20"></div>
            <div className="relative">
              <div className="w-3 h-3 border-r-2 border-b-2 border-primary-foreground/60 rotate-45 animate-pulse"></div>
              <div className="absolute inset-0 w-3 h-3 border-r-2 border-b-2 border-primary-foreground/30 rotate-45 scale-150"></div>
            </div>
          </div>
          
          <Button 
            onClick={onComplete}
            size="lg"
            className="bg-primary text-white hover:bg-primary/90 font-bold text-lg px-10 py-5 rounded-full shadow-xl hover:scale-105 transition-all duration-200"
          >
            Skapa min profil
          </Button>
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
    // Inaktivera swipe på sista sliden
    if (currentSlide === slides.length - 1) return;
    
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
    // Inaktivera swipe på sista sliden
    if (currentSlide === slides.length - 1) return;
    
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
      {/* Keep image in DOM to ensure it's always cached */}
      <img src={officeBuilding} alt="" className="hidden" aria-hidden="true" />
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
      <div className="relative z-10 h-screen flex flex-col justify-start pt-20 pb-24 p-8 cursor-grab active:cursor-grabbing select-none"
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
          className="text-center max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl mx-auto px-4 transition-transform duration-300"
          style={{
            transform: `translateX(${dragOffset}px)`,
            transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {/* Title - Fixed top position */}
          <h1 className="font-bold text-primary-foreground mb-4 animate-fade-in leading-tight text-4xl md:text-5xl">
            {slides[currentSlide].title}
          </h1>
          
          {/* Subtitle */}
          <p className="text-white mb-8 md:mb-10 animate-fade-in leading-relaxed text-xl">
            {slides[currentSlide].subtitle}
          </p>

          {/* Slide Content */}
          <div className={`animate-scale-in ${currentSlide === 1 ? 'mt-16' : 'mt-0'}`}>
            {slides[currentSlide].content}
          </div>
        </div>

          {/* Bottom footer (consistent across slides) */}
          <div className="absolute bottom-6 left-0 right-0">
            <div className="flex flex-col items-center gap-3">
              {/* Dots */}
              <div className="flex justify-center space-x-3">
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
              {/* Helper text under dots */}
              <p className="text-white text-sm">
                {currentSlide < slides.length - 1 
                  ? (device === 'mobile' || device === 'tablet'
                      ? 'Nästa generation av jobbsök är här'
                      : 'Klicka eller använd piltangenterna')
                  : 'Nästa generation av jobbsök är här'
                }
              </p>
            </div>
          </div>
        </div>
    </div>
  );
};

export default SwipeIntro;