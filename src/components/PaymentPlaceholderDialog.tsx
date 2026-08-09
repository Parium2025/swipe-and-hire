import { motion } from 'framer-motion';
import { Clock, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface PaymentPlaceholderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName?: string;
  priceSek?: number;
  billingPeriod?: 'monthly' | 'one_time';
}

/**
 * Placeholder-modal som visas när användaren klickar "Fortsätt till betalning".
 * Ersätts av Stripe Checkout-redirect när betalningarna aktiveras.
 */
export function PaymentPlaceholderDialog({
  open,
  onOpenChange,
  planName,
  priceSek,
  billingPeriod = 'monthly',
}: PaymentPlaceholderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-white/10 bg-[#0F172A] text-white">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-secondary/30">
            <Clock className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl font-semibold text-white">
            Betalning aktiveras snart
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-white">
            Vi fixar sista biten med vår betalningsleverantör. Så fort det är klart kan du välja plan och köra igång direkt.
          </DialogDescription>
        </DialogHeader>

        {planName && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-secondary" />
                <span className="text-sm font-medium text-white">{planName}</span>
              </div>
              {priceSek !== undefined && (
                <span className="text-sm text-white">
                  {priceSek.toLocaleString('sv-SE')} kr
                  <span className="ml-1 text-xs text-white">
                    {billingPeriod === 'monthly' ? '/mån' : 'engång'}
                  </span>
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-white">
              Vi meddelar dig via e-post så fort betalning är öppen.
            </p>
          </motion.div>
        )}

        <div className="mt-2 flex flex-col gap-2">
          <Button
            onClick={() => onOpenChange(false)}
            className="h-11 w-full rounded-full bg-secondary text-white transition-none hover:bg-secondary hover:brightness-100"
          >
            Okej, jag väntar
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
