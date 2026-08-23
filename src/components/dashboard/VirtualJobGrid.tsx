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
    <div className={className} style={{ isolation: 'isolate', position: 'relative' }}>
      {tabs.map((tab) => {
        const isVisible = tab.key === activeTab;
        if (tab.jobs.length === 0) {
          return (
            <div
              key={tab.key}
              aria-hidden={!isVisible}
              {...(!isVisible ? { inert: '' } : {})}
              style={isVisible ? undefined : {
                position: 'absolute',
                inset: 0,
                visibility: 'hidden',
                pointerEvents: 'none',
              }}
            >
              {isVisible ? emptyState : null}
            </div>
          );
        }
        return (
          <div
            key={tab.key}
            // Identiska klasser för synlig/dold panel: inga stilskillnader som
            // tvingar Safari att rita om (transform/backdrop-filter) vid flikbyte.
            className={`${gridClassName} job-card-grid-no-entry`}
            aria-hidden={!isVisible}
            {...(!isVisible ? { inert: '' } : {})}
            // Inaktiva paneler layoutas och rasteriseras i förväg så bilder,
            // knappstorlekar och färger redan är klara vid flikbytet. De är
            // samtidigt helt osynliga, inerta och borttagna ur dokumentflödet.
            style={{
              position: isVisible ? 'relative' : 'absolute',
              inset: isVisible ? undefined : 0,
              width: '100%',
              visibility: isVisible ? 'visible' : 'hidden',
              zIndex: isVisible ? 1 : 0,
              pointerEvents: isVisible ? undefined : 'none',
              // Dolda paneler klipps så att deras överskjutande höjd aldrig
              // kan skapa extra scroll-yta under sista kortet i aktiv flik.
              overflow: isVisible ? undefined : 'hidden',
            }}
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
