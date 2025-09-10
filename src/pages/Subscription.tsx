import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Check, Star, CreditCard, Calendar } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const Subscription = () => {
  const { profile, user } = useAuth();
  const currentPlan = 'basic'; // This would come from your subscription state
  const [selectedPlan, setSelectedPlan] = useState(currentPlan);

  const plans = [
    {
      id: 'basic',
      name: 'Basic',
      price: '0',
      period: 'månad',
      description: 'Perfekt för att komma igång',
      features: [
        'Skapa profil & ladda upp CV',
        'Välj inriktning och se matchade jobb',
        'Swipea jobb - 5 per vecka',
        'Grundläggande funktionalitet'
      ],
      icon: Star,
      buttonText: 'Nuvarande plan',
      recommended: false
    },
    {
      id: 'premium',
      name: 'Premium',
      price: '29',
      period: 'månad',
      description: 'För seriösa jobbsökare',
      features: [
        'Skapa profil & ladda upp CV',
        'Välj inriktning och se matchade jobb',
        'Swipea jobb - Obegränsat',
        'Videopresentation',
        'Pushnotiser för relevanta jobb',
        'Direktkontakt till arbetsgivare (e-post)',
        'Se vilka arbetsgivare visat intresse',
        'Prioriterad synlighet i arbetsgivarens lista',
        'Annonsfri upplevelse'
      ],
      icon: Crown,
      buttonText: 'Uppgradera till Premium',
      recommended: true
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">Abonnemang</h1>
        <p className="text-white">
          Hantera ditt abonnemang och uppgradera din plan
        </p>
      </div>

      <div className="px-4 pb-6">
        {/* Current Plan Status */}
        <div className="pt-4 mb-6">
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Crown className="h-5 w-5 text-white" />
                <span className="font-medium text-white">Din nuvarande plan</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">Basic Plan</p>
                  <p className="text-sm text-white/80">
                    {user?.created_at ? `Aktiv sedan ${new Date(user.created_at).toLocaleDateString('sv-SE', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}` : 'Aktiv plan'}
                  </p>
                </div>
                <Badge variant="secondary" className="bg-white/20 text-white">
                  Aktiv
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Available Plans */}
        <div className="space-y-4 mb-6">
          <h2 className="text-lg font-semibold text-white">Tillgängliga abonnemang</h2>
          
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = plan.id === currentPlan;
            
            return (
              <Card 
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`bg-white/10 backdrop-blur-sm border-white/20 relative cursor-pointer transition-all duration-200 hover:scale-105 ${
                  plan.recommended ? 'border-primary' : ''
                } ${
                  selectedPlan === plan.id ? 'border-green-500 border-2 shadow-lg shadow-green-500/20' : ''
                }`}
              >
                {plan.recommended && (
                  <div className="absolute -top-2 left-4">
                    <Badge className="bg-white/20 text-white text-xs">
                      Rekommenderad
                    </Badge>
                  </div>
                )}
                
                <CardContent className="p-4 pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-white">{plan.name}</h3>
                        <p className="text-sm text-white/80">{plan.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">
                        {plan.price} kr
                      </div>
                      <div className="text-sm text-white/80">
                        /{plan.period}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-white">{feature}</span>
                      </div>
                    ))}
                  </div>
                  
                  <Button 
                    className="w-full" 
                    variant="default"
                    disabled={isCurrent}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selectedPlan === plan.id && !isCurrent) {
                        console.log(`Upgrading to ${plan.name} plan`);
                        // Here you would implement the upgrade logic
                      }
                    }}
                  >
                    {isCurrent ? 'Nuvarande plan' : selectedPlan === plan.id ? `Välj ${plan.name}` : plan.buttonText}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

      </div>
    </div>
  );
};

export default Subscription;