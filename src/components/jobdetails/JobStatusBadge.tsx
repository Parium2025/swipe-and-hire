import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface JobStatusBadgeProps {
  jobId: string;
  isActive: boolean;
  expiresAt: string | null;
  onOptimisticUpdate: (updates: { is_active: boolean }) => void;
}

/**
 * Renders Aktiv/Inaktiv/Utgången badge with click-to-toggle for non-expired jobs.
 * Optimistic update with rollback on error.
 */
export const JobStatusBadge = memo(({ jobId, isActive, expiresAt, onOptimisticUpdate }: JobStatusBadgeProps) => {
  const isExpired = !!expiresAt && new Date(expiresAt) < new Date();
  const statusLabel = isExpired ? 'Utgången' : (isActive ? 'Aktiv' : 'Inaktiv');
  const statusColor = isExpired
    ? 'bg-red-500/20 text-white border-red-500/30'
    : isActive
      ? 'bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30'
      : 'bg-gray-500/20 text-gray-300 border-gray-500/30 hover:bg-gray-500/30';

  if (isExpired) {
    return (
      <Badge className={`text-xs whitespace-nowrap border ${statusColor}`}>
        {statusLabel}
      </Badge>
    );
  }

  const handleToggle = async () => {
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

  return (
    <Badge
      className={`text-xs whitespace-nowrap cursor-pointer transition-colors border ${statusColor}`}
      onClick={handleToggle}
    >
      {statusLabel}
    </Badge>
  );
});
JobStatusBadge.displayName = 'JobStatusBadge';
