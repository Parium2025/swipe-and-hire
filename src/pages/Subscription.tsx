import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Check, Star, CreditCard, Calendar } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PremiumUpgradeDialog } from '@/components/PremiumUpgradeDialog';
import { useIsMobile } from '@/hooks/use-mobile';

const Subscription = () => {
  const { profile, user } = useAuth();
  const isMobile = useIsMobile();
  const [currentPlan, setCurrentPlan] = useState<'basic' | 'premium'>('basic'); // This would come from your subscription state
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'premium'>(currentPlan);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

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
     <div className="max-w-4xl mx-auto px-3 md:px-8 space-y-6 animate-fade-in">
      <div className="text-center mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Abonnemang</h1>
        <p className="text-sm text-white mt-1">
          Hantera ditt abonnemang och uppgradera din plan
        </p>
      </div>

       <div className="pb-6">
        {/* Current Plan Status */}
        <div className="pt-4 mb-6">
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                {currentPlan === 'premium' ? (
                  <Crown className="h-5 w-5 text-white" />
                ) : (
                  <Star className="h-5 w-5 text-white" />
                )}
                <span className="font-medium text-white">Din nuvarande plan</span>
              </div>
               <div className="flex items-center justify-between">
                 <div>
                   <p className="font-semibold text-white">
                     {plans.find(p => p.id === currentPlan)?.name} Plan
                   </p>
                  <p className="text-sm text-white">
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
                onClick={() => setSelectedPlan(plan.id as 'basic' | 'premium')}
                className={`bg-white/10 backdrop-blur-sm border-white/20 relative cursor-pointer transition-all duration-200 border-2 ${
                  plan.recommended ? 'border-primary' : ''
                } ${
                  selectedPlan === plan.id ? 'border-green-500 shadow-lg shadow-green-500/20' : ''
                }`}
              >
                {plan.recommended && (
                  <div className="absolute top-2 left-4">
                    <Badge className="bg-white/20 text-white text-sm">
                      Rekommenderad
                    </Badge>
                  </div>
                )}
                
                <CardContent className={`p-4 ${plan.recommended ? 'pt-14' : 'pt-6'}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-white">{plan.name}</h3>
                        <p className="text-sm text-white">{plan.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white whitespace-nowrap">
                        {plan.price} kr
                      </div>
                      <div className="text-sm text-white">
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
                      if (plan.id === 'premium' && !isCurrent) {
                        if (isMobile) {
                          // App-version (mobilvy): visa dialog med parium.se
                          setShowUpgradeDialog(true);
                        } else {
                          // Webb: Direkt till Stripe (placeholder tills vi kopplar Stripe)
                          alert('Öppnar Stripe (webb)');
                        }
                      }
                    }}
                  >
                    {isCurrent ? 'Nuvarande plan' : plan.buttonText}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

      </div>

      <PremiumUpgradeDialog 
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        isAppOverride={isMobile}
      />
    </div>
  );
};

export default Subscription;