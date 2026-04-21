import { memo, type ReactNode } from 'react';
import type { JobPosting } from '@/hooks/useJobsData';

/**
 * VirtualJobGrid (DOM-persistens, ej virtualiserad)
 * --------------------------------------------------
 * För 20 kort/sida är full DOM-virtualisering overkill och introducerar
 * absolute-positioning-buggar. Vi använder istället ren DOM-persistens:
 *
 *  - Alla tabbars kort renderas EN gång och hålls i DOM:en
 *  - Tab-byte = ren CSS-toggle (display:none) → 0ms React-jobb
 *  - Stabila keys per job.id → React.memo träffar alltid
 *
 * Detta är den faktiska "Spotify-modellen" och löser hack-känslan utan
 * att bryta layouten.
 */

export type TabKey = string;

interface TabConfig<T> {
  key: TabKey;
  jobs: T[];
}

interface VirtualJobGridProps<T extends JobPosting> {
  tabs: TabConfig<T>[];
  activeTab: TabKey;
  renderCard: (job: T, idx: number) => ReactNode;
  /** Klass för wrapper. */
  className?: string;
  /** Grid-klass per panel. Default: standard 1/2/3-cols grid. */
  gridClassName?: string;
  emptyState?: ReactNode;
}

function VirtualJobGridImpl<T extends JobPosting>({
  tabs,
  activeTab,
  renderCard,
  className = '',
  gridClassName = 'job-card-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4',
  emptyState,
}: VirtualJobGridProps<T>) {
  return (
    <div className={className}>
      {tabs.map((tab) => {
        const isVisible = tab.key === activeTab;
        if (tab.jobs.length === 0) {
          return (
            <div
              key={tab.key}
              style={{ display: isVisible ? 'block' : 'none' }}
            >
              {isVisible ? emptyState : null}
            </div>
          );
        }
        return (
          <div
            key={tab.key}
            className={gridClassName}
            // display:none gör att React behåller alla DOM-noder MEN
            // browsern hoppar över paint/layout för dolda paneler.
            // Result: tab-byte = en stilflagga, ingen reconcile.
            style={{ display: isVisible ? undefined : 'none' }}
          >
            {tab.jobs.map((job, idx) => (
              <div key={job.id} style={{ contain: 'layout style paint' }}>
                {renderCard(job, idx)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export const VirtualJobGrid = memo(VirtualJobGridImpl) as typeof VirtualJobGridImpl;
