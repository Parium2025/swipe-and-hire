import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Infinity as InfinityIcon, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ApplicationLimitDialogProps {
  open: boolean;
  onClose: () => void;
  used: number;
  limit: number;
  resetAt: string | null;
}

function formatReset(resetAt: string | null): string | null {
  if (!resetAt) return null;
  try {
    const ms = new Date(resetAt).getTime() - Date.now();
    if (ms <= 0) return null;
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
    if (days <= 1) {
      const hours = Math.max(1, Math.ceil(ms / (1000 * 60 * 60)));
      return `om ${hours} ${hours === 1 ? 'timme' : 'timmar'}`;
    }
    return `om ${days} ${days === 1 ? 'dag' : 'dagar'}`;
  } catch {
    return null;
  }
}

export function ApplicationLimitDialog({ open, onClose, used, limit, resetAt }: ApplicationLimitDialogProps) {
  const navigate = useNavigate();
  const reset = formatReset(resetAt);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md border-white/10 bg-[#0F1115] text-white">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-[0_8px_24px_-8px_rgba(251,191,36,0.6)]">
            <Sparkles className="h-7 w-7 text-black" strokeWidth={2.25} />
          </div>
          <DialogTitle className="text-center text-xl font-semibold tracking-tight">
            Du har använt dina {limit} ansökningar
          </DialogTitle>
          <DialogDescription className="text-center text-white/70">
            Gratisplanen ger dig {limit} ansökningar i veckan.
            {reset ? ` Nästa fria ansökan låses upp ${reset}.` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-start gap-3">
            <InfinityIcon className="mt-0.5 h-5 w-5 text-amber-300" />
            <div>
              <div className="text-sm font-medium">Obegränsade ansökningar</div>
              <div className="text-xs text-white/60">Sök så många jobb du vill, varje vecka.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 text-amber-300" />
            <div>
              <div className="text-sm font-medium">Premium-fördelar</div>
              <div className="text-xs text-white/60">Profilvisningar, statistik och spara fler jobb.</div>
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
            {reset ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Vänta till nästa vecka
              </span>
            ) : (
              'Stäng'
            )}
          </Button>
        </div>

        <div className="mt-1 text-center text-[11px] text-white/40">
          {used}/{limit} använda denna vecka
        </div>
      </DialogContent>
    </Dialog>
  );
}
