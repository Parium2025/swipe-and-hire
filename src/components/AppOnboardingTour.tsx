import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, PanelLeft, User, Crown, ArrowRight } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface AppOnboardingTourProps {
  onComplete: () => void;
}

const AppOnboardingTour = ({ onComplete }: AppOnboardingTourProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  
  const navigate = useNavigate();

  const steps = [
    {
      icon: Heart,
      title: "Här söker du jobb",
      description: "Fyll i fältet, sedan swipa höger på jobb du är intresserad av och vänster på jobb du vill passa",
      page: "/search-jobs",
      allowedElement: null // Bara nästa-knappen tillåten
    },
    {
      icon: PanelLeft,
      title: "Använd sidomenyn",
      description: "Tryck på menyknappen för att öppna sidebaren och se alla funktioner!",
      page: "/search-jobs",
      allowedElement: "[data-sidebar='trigger']" // Bara sidebar trigger tillåten
    },
    {
      icon: User,
      title: "Tryck på Min Profil",
      description: "Tryck på 'Min Profil' i sidomenyn.",
      page: null,
      allowedElement: "[data-onboarding='min-profil']" // Endast 'Min Profil' tillåten
    },
    {
      icon: Crown,
      title: "Uppgradera till Premium",
      description: "Få tillgång till fler funktioner och öka dina chanser att hitta drömjobbet med våra premiumfunktioner!",
      page: "/subscription",
      allowedElement: null // Bara nästa-knappen tillåten
    }
  ];


  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      const nextStep = currentStep + 1;
      const nextStepData = steps[nextStep];
      
      // Navigate to the next page if needed (only if different)
      if (nextStepData.page && nextStepData.page !== location.pathname) {
        navigate(nextStepData.page);
      }
      setCurrentStep(nextStep);
    } else {
      onComplete();
    }
  };

  // Blockera klick på alla element utom tillåtna
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element;
      const step = steps[currentStep];
      
      // Tillåt alltid klick på onboarding-kortet
      if ((target as HTMLElement).closest('.onboarding-tour')) return;
      
      if (step.allowedElement) {
        const isAllowed = (target as HTMLElement).closest(step.allowedElement);
        if (isAllowed) {
          if (currentStep === 1) {
            setTimeout(() => handleNext(), 300);
          }
          return;
        }
      }
      
      // Blockera alla andra klick
      e.preventDefault();
      e.stopPropagation();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Blockera alla tangenttryckningar utom Escape (för att inte hindra utvecklare)
      if (e.key !== 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Fånga alla klick och tangenttryckningar
    document.addEventListener('click', handleClick, true);
    document.addEventListener('mousedown', handleClick, true);
    document.addEventListener('touchstart', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('mousedown', handleClick, true);
      document.removeEventListener('touchstart', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [currentStep]);

  const currentStepData = steps[currentStep];
  const Icon = currentStepData.icon;

  const location = useLocation();
  // Gå vidare när användaren har navigerat till /profile via sidomenyn
  useEffect(() => {
    if (currentStep === 2 && location.pathname === '/profile') {
      setCurrentStep(3);
    }
  }, [currentStep, location.pathname]);

  // Positionera första steget under Sök-rubriken, föredra hjälprubriken
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    const update = () => {
      if (currentStep === 0 && location.pathname === '/search-jobs') {
        const hero = document.querySelector("[data-onboarding='search-hero']") as HTMLElement | null;
        const label = document.querySelector("[data-onboarding='search-label']") as HTMLElement | null;
        const anchor = hero || label;
        if (anchor) {
          const rect = anchor.getBoundingClientRect();
          setCardPos({ top: rect.bottom - 20, left: rect.left + rect.width / 2 });
          return;
        }
      }
      setCardPos(null);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [currentStep, location.pathname]);

  // Om vi är på sista steget (Premium) säkerställ att vi är på /subscription
  useEffect(() => {
    if (currentStep === 3 && location.pathname !== '/subscription') {
      navigate('/subscription');
    }
  }, [currentStep, location.pathname, navigate]);

  // Highlight för tillåtna element
  const renderHighlight = () => {
    if (currentStepData.allowedElement) {
      return (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <style>
            {`
              ${currentStepData.allowedElement} {
                position: relative !important;
                z-index: 60 !important;
                animation: pulse-glow 2s infinite !important;
                pointer-events: auto !important;
              }
              
              @keyframes pulse-glow {
                0%, 100% {
                  box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7);
                }
                50% {
                  box-shadow: 0 0 0 10px rgba(255, 255, 255, 0);
                }
              }
            `}
          </style>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      {/* Fullscreen overlay that blocks all interactions */}
      <div className="fixed inset-0 bg-black/10 z-30 backdrop-blur-0 pointer-events-auto" />
      
      {/* Highlight för tillåtna element */}
      {renderHighlight()}
      
      {/* Onboarding tour card */}
      <div className={`fixed z-50 onboarding-tour ${cardPos ? '' : 'top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 transform'}`} style={cardPos ? { top: cardPos.top, left: cardPos.left, transform: 'translateX(-50%)' } : undefined}>
        <Card className="w-64 bg-[hsl(var(--surface-blue))]/90 backdrop-blur-sm border-white/20 shadow-2xl animate-fade-in">
          <CardContent className="p-4">
            {/* Progress indicator */}
            <div className="flex justify-center mb-3">
              <div className="flex space-x-1.5">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                      index === currentStep 
                        ? 'bg-white w-4' 
                        : index < currentStep 
                          ? 'bg-white/60' 
                          : 'bg-white/30'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Icon */}
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon className="h-6 w-6 text-white" />
              </div>
            </div>

            {/* Content */}
            <div className="text-center">
              <h3 className="text-lg font-bold text-white mb-2">
                {currentStepData.title}
              </h3>
              
              <Badge variant="outline" className="mb-3 border-white/20 text-white bg-white/20 text-xs">
                {currentStep + 1} av {steps.length}
              </Badge>
              
              <p className="text-white/80 text-xs leading-relaxed mb-4">
                {currentStepData.description}
              </p>
              
              {/* Navigation button - dold för steg 2 eftersom användaren måste klicka på sidebar */}
              {currentStep !== 1 && (
                <div className="flex justify-center">
                  <Button 
                    onClick={handleNext}
                    size="sm"
                    className="min-w-[80px] text-xs px-3 py-1 h-8"
                  >
                    {currentStep === steps.length - 1 ? 'Färdig!' : 'Nästa'}
                    {currentStep !== steps.length - 1 && <ArrowRight className="h-3 w-3 ml-1" />}
                  </Button>
                </div>
              )}
              
              {/* Specialtext när ett element är markerat */}
              {currentStepData.allowedElement && (
                <div className="text-center">
                  <p className="text-white/60 text-xs">
                    👆 Tryck på det markerade elementet
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default AppOnboardingTour;