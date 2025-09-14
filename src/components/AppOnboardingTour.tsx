import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, PanelLeft, User, Crown, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AppOnboardingTourProps {
  onComplete: () => void;
}

const AppOnboardingTour = ({ onComplete }: AppOnboardingTourProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [sidebarWasOpened, setSidebarWasOpened] = useState(false);
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
      title: "Din profil",
      description: "Håll din profil uppdaterad med bilder, CV och information.",
      page: "/profile",
      allowedElement: null // Bara nästa-knappen tillåten
    },
    {
      icon: Crown,
      title: "Uppgradera till Premium",
      description: "Få tillgång till fler funktioner och öka dina chanser att hitta drömjobbet med våra premiumfunktioner!",
      page: "/subscription",
      allowedElement: null // Bara nästa-knappen tillåten
    }
  ];

  // Lyssna på sidebar-öppning för steg 2
  useEffect(() => {
    if (currentStep === 1 && !sidebarWasOpened) {
      const checkSidebar = () => {
        const sidebar = document.querySelector('[data-sidebar="sidebar"]');
        if (sidebar && !sidebar.hasAttribute('data-state') || sidebar?.getAttribute('data-state') === 'expanded') {
          setSidebarWasOpened(true);
          // Automatiskt gå till nästa steg efter kort fördröjning
          setTimeout(() => {
            handleNext();
          }, 1000);
        }
      };

      const interval = setInterval(checkSidebar, 100);
      return () => clearInterval(interval);
    }
  }, [currentStep, sidebarWasOpened]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      const nextStep = currentStep + 1;
      const nextStepData = steps[nextStep];
      
      // Navigate to the next page if needed
      if (nextStepData.page) {
        navigate(nextStepData.page);
      }
      
      setCurrentStep(nextStep);
      
      // Reset sidebar state for next step
      if (nextStep !== 1) {
        setSidebarWasOpened(false);
      }
    } else {
      onComplete();
    }
  };

  // Blockera klick på alla element utom tillåtna
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element;
      const currentStepData = steps[currentStep];
      
      // Tillåt alltid klick på onboarding-turen själv
      if (target.closest('.onboarding-tour')) {
        return;
      }
      
      // För steg 2 (sidebar), tillåt bara sidebar trigger
      if (currentStep === 1 && currentStepData.allowedElement) {
        const allowedElement = document.querySelector(currentStepData.allowedElement);
        if (!target.closest(currentStepData.allowedElement) && target !== allowedElement) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }
      
      // För alla andra steg, blockera alla klick utom på onboarding-turen
      if (currentStep !== 1) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [currentStep]);

  const currentStepData = steps[currentStep];
  const Icon = currentStepData.icon;

  // Highlight för sidebar trigger på steg 2
  const renderHighlight = () => {
    if (currentStep === 1 && currentStepData.allowedElement) {
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
      {/* Fullscreen overlay */}
      <div className="fixed inset-0 bg-black/50 z-30 backdrop-blur-sm" />
      
      {/* Highlight för tillåtna element */}
      {renderHighlight()}
      
      {/* Onboarding tour card */}
      <div className="fixed top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 onboarding-tour">
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
              
              {/* Specialtext för steg 2 */}
              {currentStep === 1 && (
                <div className="text-center">
                  <p className="text-white/60 text-xs">
                    👆 Tryck på menyknappen som pulsar
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