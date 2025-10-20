import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, ExternalLink, Info } from 'lucide-react';

interface PremiumUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAppOverride?: boolean;
}

export const PremiumUpgradeDialog = ({ open, onOpenChange, isAppOverride }: PremiumUpgradeDialogProps) => {
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

  const isApp = (typeof isAppOverride === 'boolean') ? isAppOverride : isMobileApp;

  const handleUpgrade = () => {
    if (isApp) {
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
      <DialogContent className="bg-parium-gradient backdrop-blur-sm border-2 border-primary/40 text-white max-w-sm mx-auto left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-primary/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
            <Crown className="h-6 w-6 text-white" />
          </div>
          <DialogTitle className="text-xl font-bold text-white">
            Uppgradera till Premium
          </DialogTitle>
          
          {isApp ? (
            <DialogDescription className="text-center space-y-3 pt-3">
              <span className="font-medium text-sm leading-relaxed block text-white/90">
                För att uppgradera till Premium,<br className="sm:hidden" /> besök vår webbplats
              </span>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-primary/40 mx-auto w-fit">
                <p className="text-lg font-bold text-white tracking-wide">
                  parium.se
                </p>
              </div>
            </DialogDescription>
          ) : (
            <DialogDescription className="text-center space-y-3 pt-3">
              <span className="font-medium text-sm block text-white/90">Uppgradera nu</span>
              <div className="space-y-3 text-white">
                <p className="text-sm leading-relaxed">
                  Du kan uppgradera direkt här på webben eller besöka:
                </p>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-primary/40 mx-auto w-fit">
                  <p className="text-lg font-bold text-white tracking-wide">
                    parium.se
                  </p>
                </div>
                <p className="text-sm text-white/80">
                  Välj det alternativ som passar dig bäst.
                </p>
              </div>
            </DialogDescription>
          )}
        </DialogHeader>
        
        <div className="flex gap-2 pt-3">
          {!isApp ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 bg-primary border-primary/60 text-white hover:bg-primary/90 hover:text-white text-sm py-2"
              >
                Stäng
              </Button>
              <Button
                onClick={handleUpgrade}
                className="flex-1 bg-primary hover:bg-primary/90 text-white text-sm py-2 border border-primary/60"
              >
                Nu kör vi!
              </Button>
            </>
          ) : (
            <Button
              onClick={() => onOpenChange(false)}
              className="w-full bg-primary hover:bg-primary/90 text-white text-sm py-2 border border-primary/60"
            >
              Nu kör vi!
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};