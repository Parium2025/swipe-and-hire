import { useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Target = 'review' | 'company_reply' | 'message';

/** Liten anmälningsflagga. Anmälan går till Pariums administratör, aldrig till bolaget eller skribenten. */
export function ReportContentButton({ target, reviewId, messageId }: { target: Target; reviewId: string; messageId?: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    const { error } = await supabase.rpc('report_review_content', {
      _target_type: target, _review_id: reviewId, _message_id: messageId ?? null, _reason: reason,
    } as never);
    setSending(false);
    if (error) {
      toast({
        title: 'Kunde inte skicka anmälan',
        description: error.message.includes('rate_limited') ? 'Du har skickat många anmälningar. Försök igen senare.' : 'Försök igen om en stund.',
        variant: 'destructive',
      });
      return;
    }
    setOpen(false);
    setReason('');
    toast({ title: 'Tack för din anmälan', description: 'Vi granskar innehållet så snart som möjligt.' });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="p-1.5 rounded-md text-white/60 md:hover:text-white md:hover:bg-white/10 transition-colors"
        aria-label="Anmäl innehåll"
        title="Anmäl"
      >
        <Flag className="h-3.5 w-3.5" />
      </button>
      <AlertDialog open={open} onOpenChange={(o) => !sending && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anmäl innehåll</AlertDialogTitle>
            <AlertDialogDescription>
              Anmälan skickas till Parium och granskas. Skribenten får inte veta vem som har anmält.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Beskriv gärna varför (valfritt)…"
            maxLength={500}
            autoResize={false}
            className="h-[90px] min-h-[90px] max-h-[90px] bg-white/5 border-white/10 text-white text-base md:text-sm resize-none placeholder:text-white/40"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Avbryt</AlertDialogCancel>
            <Button type="button" onClick={submit} disabled={sending} variant="destructive">
              {sending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Skicka anmälan
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
