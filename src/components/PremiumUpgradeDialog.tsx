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
      <DialogContent className="bg-parium-gradient backdrop-blur-sm border-white/20 text-white max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
            <Crown className="h-8 w-8 text-white" />
          </div>
          <DialogTitle className="text-2xl font-bold text-white">
            Uppgradera till Premium
          </DialogTitle>
          
          {isApp ? (
            <DialogDescription className="text-center space-y-4 pt-4 px-2">
              <div className="flex flex-col items-center gap-3 text-white/90">
                <Info className="h-6 w-6 mx-auto" />
                <span className="font-medium text-sm sm:text-base leading-relaxed">
                  För att uppgradera till Premium,<br className="sm:hidden" /> besök vår webbplats
                </span>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20 mx-auto max-w-xs">
                <p className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                  parium.se
                </p>
              </div>
            </DialogDescription>
          ) : (
            <DialogDescription className="text-center space-y-4 pt-4 px-2">
              <div className="flex flex-col items-center gap-3 text-white/90">
                <ExternalLink className="h-6 w-6 mx-auto" />
                <span className="font-medium text-sm sm:text-base">Uppgradera nu</span>
              </div>
              <div className="space-y-4 text-white">
                <p className="text-sm sm:text-base leading-relaxed">
                  Du kan uppgradera direkt här på webben eller besöka:
                </p>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20 mx-auto max-w-xs">
                  <p className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                    parium.se
                  </p>
                </div>
                <p className="text-xs sm:text-sm text-white/80">
                  Välj det alternativ som passar dig bäst.
                </p>
              </div>
            </DialogDescription>
          )}
        </DialogHeader>
        
        <div className="flex gap-2 sm:gap-3 pt-4 px-2">
          {!isApp ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 bg-primary border-white/30 text-white hover:bg-primary/90 hover:text-white text-sm sm:text-base py-2 sm:py-3"
              >
                Stäng
              </Button>
              <Button
                onClick={handleUpgrade}
                className="flex-1 bg-primary hover:bg-primary/90 text-white text-sm sm:text-base py-2 sm:py-3"
              >
                Nu kör vi!
              </Button>
            </>
          ) : (
            <Button
              onClick={() => onOpenChange(false)}
              className="w-full bg-primary hover:bg-primary/90 text-white text-sm sm:text-base py-2 sm:py-3"
            >
              Nu kör vi!
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};