import { memo } from 'react';
import { ReadOnlyMobileJobCard } from '@/components/ReadOnlyMobileJobCard';

/**
 * Datorvyns framsida i förhandsvisningen — renderar EXAKT samma jobbkort
 * som jobbsökare ser i sökresultatet på datorn (ReadOnlyMobileJobCard),
 * i verklig kolumnbredd och nedskalat för att passa i skärm-mockupen.
 */
interface WizardDesktopCardPreviewProps {
  job: React.ComponentProps<typeof ReadOnlyMobileJobCard>['job'];
  onOpenForm: () => void;
}

const REAL_CARD_WIDTH = 360;
const noop = () => {};

export const WizardDesktopCardPreview = memo(function WizardDesktopCardPreview({
  job,
  onOpenForm,
}: WizardDesktopCardPreviewProps) {
  return (
    <div className="absolute inset-0 z-10 overflow-y-auto overflow-x-hidden custom-scrollbar overscroll-contain bg-card-parium">
      <div className="flex min-h-full w-full items-center justify-center py-3">
        <div
          className="job-card-grid job-card-grid-single grid grid-cols-1"
          style={{ width: REAL_CARD_WIDTH, zoom: 0.62 } as React.CSSProperties}
        >
          <ReadOnlyMobileJobCard
            job={job}
            isSavedExternal={false}
            onToggleSave={noop}
            onCardClick={() => onOpenForm()}
          />
        </div>
      </div>
    </div>
  );
});
