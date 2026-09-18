import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Bookmark, Infinity as InfinityIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SavedJobsLimitDialogProps {
  open: boolean;
  onClose: () => void;
  limit: number;
}

export function SavedJobsLimitDialog({ open, onClose, limit }: SavedJobsLimitDialogProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md border-white/10 bg-[#0F1115] text-white">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-[0_8px_24px_-8px_rgba(251,191,36,0.6)]">
            <Bookmark className="h-7 w-7 text-black" strokeWidth={2.25} fill="currentColor" />
          </div>
          <DialogTitle className="text-center text-xl font-semibold tracking-tight">
            Du har sparat {limit} jobb
          </DialogTitle>
          <DialogDescription className="text-center text-white/70">
            Gratisplanen låter dig spara upp till {limit} jobb samtidigt. Ta bort ett sparat jobb — eller uppgradera för att spara obegränsat.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-start gap-3">
            <InfinityIcon className="mt-0.5 h-5 w-5 text-amber-300" />
            <div>
              <div className="text-sm font-medium">Spara hur många jobb du vill</div>
              <div className="text-xs text-white/60">Ingen gräns — bygg din egen lista.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 text-amber-300" />
            <div>
              <div className="text-sm font-medium">Premium-fördelar</div>
              <div className="text-xs text-white/60">Obegränsade ansökningar, profilvisningar och statistik.</div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <Button
            onClick={() => {
              onClose();
              navigate('/subscription');
            }}
            className="h-12 w-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 text-base font-semibold text-black hover:brightness-105"
          >
            Uppgradera till Premium
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-11 w-full rounded-full text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white"
          >
            Stäng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
