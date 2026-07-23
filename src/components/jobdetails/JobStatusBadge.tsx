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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {goingInactive ? 'Inaktivera annons?' : 'Aktivera annons?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {goingInactive
                ? 'Annonsen döljs från jobbsökare. Kandidater som redan är inne får söka klart, sparade annonser förblir sparade.'
                : 'Annonsen blir synlig för jobbsökare igen.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={performToggle}>
              {goingInactive ? 'Inaktivera' : 'Aktivera'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
JobStatusBadge.displayName = 'JobStatusBadge';
