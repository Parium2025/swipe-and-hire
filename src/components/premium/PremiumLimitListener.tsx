import { useEffect, useState } from 'react';
import { onSavedJobsLimit } from '@/lib/premiumEvents';
import { SavedJobsLimitDialog } from '@/components/premium/SavedJobsLimitDialog';

/**
 * Global lyssnare som renderar premium-gränsdialoger.
 * Monteras en gång i App.tsx.
 */
export function PremiumLimitListener() {
  const [savedJobsOpen, setSavedJobsOpen] = useState(false);
  const [savedJobsLimit, setSavedJobsLimit] = useState(3);

  useEffect(() => {
    return onSavedJobsLimit(({ limit }) => {
      setSavedJobsLimit(limit);
      setSavedJobsOpen(true);
    });
  }, []);

  return (
    <SavedJobsLimitDialog
      open={savedJobsOpen}
      onClose={() => setSavedJobsOpen(false)}
      limit={savedJobsLimit}
    />
  );
}
