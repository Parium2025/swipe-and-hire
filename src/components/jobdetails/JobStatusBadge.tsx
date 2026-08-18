import { memo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertDialogContentNoFocus } from '@/components/ui/alert-dialog-no-focus';

interface JobStatusBadgeProps {
  jobId: string;
  isActive: boolean;
  expiresAt: string | null;
  canToggle: boolean;
  onOptimisticUpdate: (updates: { is_active: boolean }) => void;
}

/**
 * Renders Aktiv/Inaktiv/Utgången badge with click-to-toggle for the job owner.
 * - Utgången: never clickable.
 * - Non-owners: read-only badge (no toggle, no cursor).
 * - Owner: confirmation dialog before switching, optimistic update, rollback on error.
 */
export const JobStatusBadge = memo(({ jobId, isActive, expiresAt, canToggle, onOptimisticUpdate }: JobStatusBadgeProps) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isExpired = !!expiresAt && new Date(expiresAt) < new Date();
  const statusLabel = isExpired ? 'Utgången' : (isActive ? 'Aktiv' : 'Inaktiv');
  const baseColor = isExpired
    ? 'bg-red-500/80 text-white border-0'
    : isActive
      ? 'bg-green-500/90 text-white border-0'
      : 'bg-gray-500/80 text-white border-0';
  const hoverColor = canToggle && !isExpired
    ? (isActive ? 'hover:bg-green-500' : 'hover:bg-gray-500')
    : '';

  if (isExpired || !canToggle) {
    return (
      <Badge className={`text-xs whitespace-nowrap border ${baseColor}`}>
        {statusLabel}
      </Badge>
    );
  }

  const performToggle = async () => {
    const newActive = !isActive;
    onOptimisticUpdate({ is_active: newActive });
    try {
      const { error } = await supabase
        .from('job_postings')
        .update({ is_active: newActive })
        .eq('id', jobId);
      if (error) throw error;
      toast.success(
        newActive ? 'Jobb aktiverat' : 'Jobb inaktiverat',
        { description: newActive ? 'Jobbet är nu aktivt.' : 'Jobbet är nu inaktivt.' }
      );
    } catch (error: any) {
      onOptimisticUpdate({ is_active: isActive });
      toast.error('Fel', { description: error.message });
    }
  };

  const goingInactive = isActive;

  return (
    <>
      <Badge
        className={`text-xs whitespace-nowrap cursor-pointer transition-colors border ${baseColor} ${hoverColor}`}
        onClick={() => setConfirmOpen(true)}
      >
        {statusLabel}
      </Badge>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContentNoFocus className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-md rounded-xl shadow-lg mx-0">
          <AlertDialogHeader className="space-y-3 text-center">
            <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
              {goingInactive ? 'Inaktivera annons?' : 'Aktivera annons?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white text-sm leading-relaxed">
              {goingInactive
                ? 'Annonsen döljs från jobbsökare. Kandidater som redan är inne får söka klart, sparade annonser förblir sparade.'
                : 'Annonsen blir synlig för jobbsökare igen.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
            <AlertDialogCancel className="btn-dialog-action flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50">
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={performToggle}
              variant={goingInactive ? 'destructiveSoft' : 'glassGreen'}
              className="btn-dialog-action flex-1 text-sm flex items-center justify-center rounded-full"
            >
              {goingInactive ? 'Inaktivera' : 'Aktivera'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentNoFocus>
      </AlertDialog>
    </>
  );
});
JobStatusBadge.displayName = 'JobStatusBadge';
