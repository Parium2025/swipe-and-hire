import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, ExternalLink, Info } from 'lucide-react';

interface PremiumUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PremiumUpgradeDialog = ({ open, onOpenChange }: PremiumUpgradeDialogProps) => {
  const [isMobileApp, setIsMobileApp] = useState(false);

  useEffect(() => {
    // Detect if running in Capacitor (mobile app) vs web
    // Check multiple ways to detect mobile app
    const isCapacitor = typeof window !== 'undefined' && 
                       (window as any).Capacitor && 
                       (window as any).Capacitor.isNativePlatform();
    
    const isCordova = typeof window !== 'undefined' && 
                     (window as any).cordova;
    
    const isApp = isCapacitor || isCordova || 
                 (typeof navigator !== 'undefined' && 
                  navigator.userAgent && 
                  navigator.userAgent.includes('CapacitorWebView'));
    
    console.log('Platform detection:', { isCapacitor, isCordova, isApp });
    setIsMobileApp(isApp);
  }, []);

  const handleUpgrade = () => {
    if (isMobileApp) {
      // Mobile app: Show info about visiting website
      // No action needed - just show the message
      return;
    } else {
      // Web: Could implement Stripe checkout here or also redirect to website
      console.log('Web upgrade - implement Stripe or redirect to parium.se');
      // For now, same behavior as mobile
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white/95 backdrop-blur-sm border-white/20 text-gray-900">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-gradient-to-r from-primary to-primary-glow flex items-center justify-center">
            <Crown className="h-8 w-8 text-white" />
          </div>
          <DialogTitle className="text-2xl font-bold">
            Uppgradera till Premium
          </DialogTitle>
          
          {isMobileApp ? (
            <DialogDescription className="text-center space-y-4 pt-4">
              <div className="flex items-center justify-center gap-2 text-blue-600">
                <Info className="h-5 w-5" />
                <span className="font-medium">Uppgradering via webbplats</span>
              </div>
              <div className="space-y-3 text-gray-700">
                <p>
                  För att uppgradera till Premium, besök vår webbplats:
                </p>
                <div className="bg-gray-100 rounded-lg p-4 border-2 border-dashed border-gray-300">
                  <p className="text-xl font-bold text-primary">
                    parium.se
                  </p>
                </div>
                <p className="text-sm text-gray-600">
                  Öppna din webbläsare och navigera till adressen ovan för att slutföra din Premium-uppgradering.
                </p>
              </div>
            </DialogDescription>
          ) : (
            <DialogDescription className="text-center space-y-4 pt-4">
              <div className="flex items-center justify-center gap-2 text-green-600">
                <ExternalLink className="h-5 w-5" />
                <span className="font-medium">Uppgradera nu</span>
              </div>
              <div className="space-y-3 text-gray-700">
                <p>
                  Du kan uppgradera direkt här på webben eller besöka:
                </p>
                <div className="bg-gray-100 rounded-lg p-4 border-2 border-dashed border-gray-300">
                  <p className="text-xl font-bold text-primary">
                    parium.se
                  </p>
                </div>
                <p className="text-sm text-gray-600">
                  Välj det alternativ som passar dig bäst.
                </p>
              </div>
            </DialogDescription>
          )}
        </DialogHeader>
        
        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Avbryt
          </Button>
          
          {!isMobileApp && (
            <Button
              onClick={handleUpgrade}
              className="flex-1"
            >
              Fortsätt här
            </Button>
          )}
          
          {isMobileApp && (
            <Button
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Förstått
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};