import { useState } from 'react';
import { RotateCcw, Pencil } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertDialogContentNoFocus } from '@/components/ui/alert-dialog-no-focus';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TruncatedText } from '@/components/TruncatedText';

const REPUBLISH_DAYS = 14;

interface RepublishJobDialogProps {
  jobId: string | null;
  jobTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRepublished?: (newJobId: string) => void;
  onEditFirst?: () => void;
}

export function RepublishJobDialog({
  jobId,
  jobTitle,
  open,
  onOpenChange,
  onRepublished,
  onEditFirst,
}: RepublishJobDialogProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!jobId || submitting) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('republish_job', {
        _job_id: jobId,
        _days: REPUBLISH_DAYS,
      });

      if (error) {
        const msg = error.message || '';
        if (/cooldown|för snabbt|too fast|rate/i.test(msg)) {
          toast({
            title: 'Vänta en stund',
            description: 'Du publicerade nyss en annons. Försök igen om några sekunder.',
            variant: 'destructive',
          });
        } else if (/fingerprint|duplicate|identisk/i.test(msg)) {
          toast({
            title: 'Identisk annons finns redan',
            description: 'Det finns redan en aktiv annons med samma innehåll.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Kunde inte återpublicera',
            description: msg || 'Något gick fel. Försök igen.',
            variant: 'destructive',
          });
        }
        return;
      }

      toast({
        title: 'Annons återpublicerad',
        description: `Din annons är aktiv i ${REPUBLISH_DAYS} dagar.`,
      });
      onOpenChange(false);
      if (typeof data === 'string') onRepublished?.(data);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContentNoFocus className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0 max-h-[90dvh] flex flex-col">
        <AlertDialogHeader className="space-y-4 text-center flex-shrink-0">
          <div className="flex items-center justify-center gap-2.5">
            <div className="bg-green-500/20 p-2 rounded-full">
              <RotateCcw className="h-4 w-4 text-white" />
            </div>
            <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
              Återpublicera annons
            </AlertDialogTitle>
          </div>
        </AlertDialogHeader>

        <div className="overflow-y-auto flex-1 my-4">
          <AlertDialogDescription className="text-white text-sm leading-relaxed text-center">
            {jobTitle ? (
              <>
                <TruncatedText
                  text={`"${jobTitle}"`}
                  className="font-semibold text-white inline-block max-w-[220px] truncate align-bottom"
                />{' '}
                återaktiveras i {REPUBLISH_DAYS} dagar. Alla tidigare kandidater, meddelanden och urval följer med.
              </>
            ) : (
              `Annonsen återaktiveras i ${REPUBLISH_DAYS} dagar. Alla tidigare kandidater, meddelanden och urval följer med.`
            )}
          </AlertDialogDescription>

          {onEditFirst && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  onOpenChange(false);
                  onEditFirst();
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white transition-all duration-300 md:hover:bg-white/20 md:hover:border-white/50 disabled:opacity-60"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Redigera annonsen först</span>
              </button>
            </div>
          )}
        </div>


        <AlertDialogFooter className="flex-row gap-2 sm:justify-center flex-shrink-0">
          <AlertDialogCancel
            disabled={submitting}
            className="btn-dialog-action flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
          >
            Avbryt
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={submitting || !jobId}
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            className="btn-dialog-action flex-1 text-sm flex items-center justify-center rounded-full !bg-green-500 md:hover:!bg-green-600 active:!bg-green-500 focus:!bg-green-500 focus-visible:!bg-green-500 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 ring-0 border-0 text-white disabled:!bg-green-500 disabled:opacity-100 transition-none"
          >
            <RotateCcw className="h-4 w-4 mr-1.5" />
            <span>{submitting ? 'Publicerar…' : 'Återpublicera'}</span>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContentNoFocus>
    </AlertDialog>
  );
}
