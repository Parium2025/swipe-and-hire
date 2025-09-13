import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, Menu, User, Sparkles, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
      description: "Swipa höger på jobb du är intresserad av och vänster på jobb du vill passa. Enkelt och snabbt!",
      position: "bottom-right",
      page: "/search-jobs"
    },
    {
      icon: Menu,
      title: "Använd sidomenyn",
      description: "I sidomenyn hittar du alla funktioner - din profil, inställningar, support och mycket mer!",
      position: "sidebar",
      page: "/search-jobs"
    },
    {
      icon: User,
      title: "Din profil",
      description: "Håll din profil uppdaterad med bilder, CV och information som gör att arbetsgivare vill anställa dig!",
      position: "center",
      page: "/profile"
    },
    {
      icon: Sparkles,
      title: "Uppgradera till Premium",
      description: "Få tillgång till fler funktioner och öka dina chanser att hitta drömjobbet med våra premiumfunktioner!",
      position: "center",
      page: "/subscription"
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      const nextStep = currentStep + 1;
      const nextStepData = steps[nextStep];
      
      // Navigate to the next page if needed
      if (nextStepData.page) {
        navigate(nextStepData.page);
      }
      
      setCurrentStep(nextStep);
    } else {
      onComplete();
    }
  };

  const currentStepData = steps[currentStep];
  const Icon = currentStepData.icon;

  const getPositionClasses = () => {
    switch (currentStepData.position) {
      case "bottom-right":
        return "fixed top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50";
      case "sidebar":
        return "fixed top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50";
      case "center":
        return "fixed top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50";
      default:
        return "fixed top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50";
    }
  };

  return (
    <div className={getPositionClasses()}>
      <Card className="w-64 bg-white/40 backdrop-blur-sm border-white/50 shadow-2xl animate-fade-in">
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
            
            {/* Navigation buttons */}
            <div className="flex justify-between items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onComplete}
                className="text-white/60 hover:text-white hover:bg-white/10 text-xs px-2 py-1 h-8"
              >
                <X className="h-3 w-3 mr-1" />
                Hoppa över
              </Button>
              
              <Button 
                onClick={handleNext}
                size="sm"
                className="min-w-[80px] text-xs px-3 py-1 h-8"
              >
                {currentStep === steps.length - 1 ? 'Färdig!' : 'Nästa'}
                {currentStep !== steps.length - 1 && <ArrowRight className="h-3 w-3 ml-1" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AppOnboardingTour;