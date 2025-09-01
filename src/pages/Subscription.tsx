import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Check, Star, CreditCard, Calendar } from 'lucide-react';

const Subscription = () => {
  const currentPlan = 'basic'; // This would come from your subscription state

  const plans = [
    {
      id: 'basic',
      name: 'Basic',
      price: '0',
      period: 'månad',
      description: 'Perfekt för att komma igång',
      features: [
        'Upp till 5 jobbansökningar per månad',
        'Grundläggande profilhantering',
        'E-postnotifikationer',
        'Standardsupport'
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
        'Obegränsade jobbansökningar',
        'Avancerad profilhantering',
        'Prioriterade notifikationer',
        'AI-driven matchning',
        'Prioriterad support',
        'Analys och statistik'
      ],
      icon: Crown,
      buttonText: 'Uppgradera till Premium',
      recommended: true
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="px-4 py-4">
          <h1 className="text-xl font-semibold text-center">Abonnemang</h1>
        </div>
      </div>

      <div className="px-4 pb-6">
        {/* Current Plan Status */}
        <div className="pt-4 mb-6">
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Crown className="h-5 w-5 text-primary" />
                <span className="font-medium">Din nuvarande plan</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Basic Plan</p>
                  <p className="text-sm text-muted-foreground">
                    Aktiv sedan 15 januari 2024
                  </p>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Aktiv
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Available Plans */}
        <div className="space-y-4 mb-6">
          <h2 className="text-lg font-semibold">Tillgängliga abonnemang</h2>
          
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = plan.id === currentPlan;
            
            return (
              <Card 
                key={plan.id}
                className={`relative bg-white/10 backdrop-blur-sm border-white/20 ${plan.recommended ? 'border-primary' : ''} ${isCurrent ? 'border-green-500' : ''}`}
              >
                {plan.recommended && (
                  <div className="absolute -top-2 left-4">
                    <Badge className="bg-primary text-xs">
                      Rekommenderad
                    </Badge>
                  </div>
                )}
                
                <CardContent className="p-4 pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{plan.name}</h3>
                        <p className="text-sm text-muted-foreground">{plan.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {plan.price} kr
                      </div>
                      <div className="text-sm text-muted-foreground">
                        /{plan.period}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                  
                  <Button 
                    className="w-full" 
                    variant={isCurrent ? "outline" : (plan.recommended ? "default" : "outline")}
                    disabled={isCurrent}
                  >
                    {isCurrent ? 'Nuvarande plan' : plan.buttonText}
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