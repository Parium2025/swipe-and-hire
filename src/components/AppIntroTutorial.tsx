import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, Menu, User, Sparkles, ArrowRight, ArrowLeft } from 'lucide-react';

interface AppIntroTutorialProps {
  onComplete: () => void;
}

const AppIntroTutorial = ({ onComplete }: AppIntroTutorialProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      icon: Heart,
      title: "Här söker du jobb",
      description: "Swipa höger på jobb du är intresserad av och vänster på jobb du vill passa. Enkelt och snabbt!",
      illustration: (
        <div className="relative w-32 h-32 mx-auto mb-4">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl"></div>
          <div className="absolute inset-2 bg-white rounded-xl shadow-lg flex items-center justify-center">
            <Heart className="h-8 w-8 text-primary" />
          </div>
          <div className="absolute -right-1 -top-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
            <ArrowRight className="h-3 w-3 text-white" />
          </div>
          <div className="absolute -left-1 -top-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
            <ArrowLeft className="h-3 w-3 text-white" />
          </div>
        </div>
      )
    },
    {
      icon: Menu,
      title: "Använd sidomenyn",
      description: "I sidomenyn hittar du alla funktioner - din profil, inställningar, support och mycket mer!",
      illustration: (
        <div className="relative w-32 h-32 mx-auto mb-4">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-2xl"></div>
          <div className="absolute inset-2 bg-white rounded-xl shadow-lg flex items-center justify-center">
            <Menu className="h-8 w-8 text-secondary" />
          </div>
          <div className="absolute -right-2 top-2 space-y-1">
            <div className="w-4 h-1 bg-accent rounded"></div>
            <div className="w-4 h-1 bg-accent rounded"></div>
            <div className="w-4 h-1 bg-accent rounded"></div>
          </div>
        </div>
      )
    },
    {
      icon: User,
      title: "Din profil",
      description: "Håll din profil uppdaterad med bilder, CV och information som gör att arbetsgivare vill anställa dig!",
      illustration: (
        <div className="relative w-32 h-32 mx-auto mb-4">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-accent/10 rounded-2xl"></div>
          <div className="absolute inset-2 bg-white rounded-xl shadow-lg flex items-center justify-center">
            <User className="h-8 w-8 text-accent" />
          </div>
          <div className="absolute -right-1 -bottom-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-xs text-white font-bold">✓</span>
          </div>
        </div>
      )
    },
    {
      icon: Sparkles,
      title: "Uppgradera till Premium",
      description: "Få tillgång till fler funktioner och öka dina chanser att hitta drömjobbet med våra premiumfunktioner!",
      illustration: (
        <div className="relative w-32 h-32 mx-auto mb-4">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-200/40 to-orange-200/40 rounded-2xl"></div>
          <div className="absolute inset-2 bg-white rounded-xl shadow-lg flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-yellow-600" />
          </div>
          <div className="absolute -top-1 -right-1 w-8 h-4 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full flex items-center justify-center">
            <span className="text-xs text-white font-bold">PRO</span>
          </div>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const currentStepData = steps[currentStep];
  const Icon = currentStepData.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Progress indicator */}
        <div className="flex justify-center mb-8">
          <div className="flex space-x-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentStep 
                    ? 'bg-primary w-6' 
                    : index < currentStep 
                      ? 'bg-primary/60' 
                      : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Main card */}
        <Card className="relative overflow-hidden animate-fade-in">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent"></div>
          <CardHeader className="text-center pb-4">
            <div className="mb-4">
              {currentStepData.illustration}
            </div>
            <CardTitle className="text-2xl mb-2">{currentStepData.title}</CardTitle>
            <Badge variant="outline" className="mx-auto">
              {currentStep + 1} av {steps.length}
            </Badge>
          </CardHeader>
          <CardContent className="text-center pb-8">
            <p className="text-muted-foreground leading-relaxed mb-8">
              {currentStepData.description}
            </p>
            
            {/* Navigation buttons */}
            <div className="flex justify-between items-center">
              <div className="flex-1">
                {currentStep > 0 && (
                  <Button 
                    variant="ghost" 
                    onClick={handlePrevious}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Tillbaka
                  </Button>
                )}
              </div>
              
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleSkip}
                  className="text-muted-foreground"
                >
                  Hoppa över
                </Button>
                <Button onClick={handleNext} className="min-w-[100px]">
                  {currentStep === steps.length - 1 ? 'Börja använda appen!' : 'Nästa'}
                  {currentStep !== steps.length - 1 && <ArrowRight className="h-4 w-4 ml-2" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Skip message */}
        <div className="text-center mt-4">
          <p className="text-sm text-muted-foreground">
            Du kan alltid komma åt dessa funktioner via menyn senare
          </p>
        </div>
      </div>
    </div>
  );
};

export default AppIntroTutorial;