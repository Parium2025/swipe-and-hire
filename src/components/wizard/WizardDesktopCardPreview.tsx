import { memo, useLayoutEffect, useRef, useState } from 'react';
import { ReadOnlyMobileJobCard } from '@/components/ReadOnlyMobileJobCard';

/**
 * Datorvyns framsida i förhandsvisningen — renderar EXAKT samma jobbkort
 * som jobbsökare ser i sökresultatet på datorn (ReadOnlyMobileJobCard),
 * i verklig kolumnbredd (samma som 3-kolumnsgridden på /search-jobs),
 * skalat så att kortet fyller skärm-mockupens höjd.
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
  const frameRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number | null>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const card = cardRef.current;
    if (!frame || !card) return;
    const measure = () => {
      const h = card.offsetHeight;
      const w = card.offsetWidth;
      if (!h || !w) return;
      const pad = 16;
      const next = Math.min((frame.clientHeight - pad) / h, (frame.clientWidth - pad) / w);
      setZoom(Math.max(0.2, next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(frame);
    ro.observe(card);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={frameRef} className="absolute inset-0 z-10 overflow-hidden bg-card-parium flex items-center justify-center">
      <div style={{ zoom: zoom ?? 1, visibility: zoom ? 'visible' : 'hidden' } as React.CSSProperties}>
        <div ref={cardRef} className="job-card-grid grid grid-cols-1" style={{ width: REAL_CARD_WIDTH }}>
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
