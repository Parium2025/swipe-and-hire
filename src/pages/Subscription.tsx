import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Check, Star, Zap } from 'lucide-react';

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
      description: 'För seriösa jobbsökare och små företag',
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold">Abonnemang</h1>
        <p className="text-muted-foreground text-base sm:text-lg">
          Välj det abonnemang som passar dina behov bäst
        </p>
      </div>

      {/* Current Plan Status */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Crown className="h-5 w-5 text-primary" />
            Din nuvarande plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="font-medium text-base sm:text-lg">Basic Plan</p>
              <p className="text-sm text-muted-foreground">
                Aktiv sedan 15 januari 2024
              </p>
            </div>
            <Badge variant="secondary" className="self-start sm:self-center">Aktiv</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Plans */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = plan.id === currentPlan;
          
          return (
            <Card 
              key={plan.id}
              className={`relative ${plan.recommended ? 'border-primary shadow-lg md:scale-105' : ''} ${isCurrent ? 'border-green-500' : ''}`}
            >
              {plan.recommended && (
                <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-xs">
                  Rekommenderad
                </Badge>
              )}
              
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <CardTitle className="text-lg sm:text-xl">{plan.name}</CardTitle>
                <div className="space-y-1">
                  <div className="text-2xl sm:text-3xl font-bold">
                    {plan.price} kr
                    <span className="text-sm sm:text-base font-normal text-muted-foreground">
                      /{plan.period}
                    </span>
                  </div>
                </div>
                <CardDescription className="text-sm">{plan.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4 sm:space-y-6">
                <ul className="space-y-2 sm:space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button 
                  className="w-full h-10 sm:h-11" 
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

      {/* Billing Information */}
      <Card>
        <CardHeader>
          <CardTitle>Faktureringsinformation</CardTitle>
          <CardDescription>
            Hantera dina betalningsmetoder och faktureringsdetaljer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Nästa fakturering</p>
              <p className="text-sm text-muted-foreground">15 februari 2024</p>
            </div>
            <div>
              <p className="text-sm font-medium">Betalningsmetod</p>
              <p className="text-sm text-muted-foreground">**** **** **** 4532</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              Uppdatera betalningsmetod
            </Button>
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              Ladda ner fakturor
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Subscription;