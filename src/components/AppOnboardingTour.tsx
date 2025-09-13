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
        return "fixed bottom-6 right-6 z-50";
      case "sidebar":
        return "fixed top-20 left-6 z-50";
      case "center":
        return "fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50";
      default:
        return "fixed bottom-6 right-6 z-50";
    }
  };

  return (
    <div className={getPositionClasses()}>
      <Card className="w-80 bg-white/95 backdrop-blur-sm border-0 shadow-2xl animate-fade-in">
        <CardContent className="p-6">
          {/* Progress indicator */}
          <div className="flex justify-center mb-4">
            <div className="flex space-x-2">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentStep 
                      ? 'bg-primary w-6' 
                      : index < currentStep 
                        ? 'bg-primary/60' 
                        : 'bg-primary/30'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="h-8 w-8 text-primary" />
            </div>
          </div>

          {/* Content */}
          <div className="text-center">
            <h3 className="text-xl font-bold text-foreground mb-2">
              {currentStepData.title}
            </h3>
            
            <Badge variant="outline" className="mb-4">
              {currentStep + 1} av {steps.length}
            </Badge>
            
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              {currentStepData.description}
            </p>
            
            {/* Navigation buttons */}
            <div className="flex justify-between items-center">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onComplete}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-2" />
                Hoppa över
              </Button>
              
              <Button 
                onClick={handleNext}
                size="sm"
                className="min-w-[100px]"
              >
                {currentStep === steps.length - 1 ? 'Färdig!' : 'Nästa'}
                {currentStep !== steps.length - 1 && <ArrowRight className="h-4 w-4 ml-2" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AppOnboardingTour;