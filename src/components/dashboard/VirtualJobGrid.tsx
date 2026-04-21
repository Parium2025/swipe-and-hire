import { memo, useRef, useMemo, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { JobPosting } from '@/hooks/useJobsData';

/**
 * VirtualJobGrid
 * --------------
 * En virtualiserad grid där INAKTIVA tabbar fortfarande lever i DOM:en
 * (display:none) men inte renderar några kort-rader förrän de visas.
 *
 * Varför: tab-byte triggar då bara en CSS-toggle, inte ett React reconcile-pass
 * över 20 kort. Kombinerat med virtualisering är detta exakt det Spotify/Gmail
 * gör — instant tab-switching även med tusentals items.
 *
 * Renderar EN tab i taget aktivt (den synliga). De andra hålls som tom DOM
 * tills användaren switchar — då tar virtualizern över. Ingen full remount.
 */

export type TabKey = string;

interface TabConfig<T> {
  key: TabKey;
  jobs: T[];
}

interface VirtualJobGridProps<T extends JobPosting> {
  tabs: TabConfig<T>[];
  activeTab: TabKey;
  /** Render-funktion för varje kort. Hålls stabil för att React.memo ska träffa. */
  renderCard: (job: T, idx: number) => ReactNode;
  /** Estimerad höjd per radhöjd i grid-cellen (inkl gap). */
  estimateRowHeight?: number;
  /** Antal kolumner per breakpoint. */
  columns?: { base: number; sm: number; lg: number };
  /** Hur många rader att rendera utanför viewport (overscan). */
  overscan?: number;
  /** Klass för grid-wrappern (för fade-in mm). */
  className?: string;
  /** Fallback-rendering när tabben är tom. */
  emptyState?: ReactNode;
}

/**
 * Hjälpkomponent: en virtualiserad lista per tab. Använder window scrolling
 * via en parent ref, så det integrerar med befintlig sidlayout.
 */
const TabPanel = memo(function TabPanel<T extends JobPosting>({
  jobs,
  isVisible,
  renderCard,
  estimateRowHeight,
  columns,
  overscan,
  emptyState,
}: {
  jobs: T[];
  isVisible: boolean;
  renderCard: (job: T, idx: number) => ReactNode;
  estimateRowHeight: number;
  columns: { base: number; sm: number; lg: number };
  overscan: number;
  emptyState?: ReactNode;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Räkna kolumner från viewport-bredd. Samma breakpoints som Tailwind:
  //  default: 1, sm:>=640px: 2, lg:>=1024px: 3
  const colCount = useMemo(() => {
    if (typeof window === 'undefined') return columns.base;
    const w = window.innerWidth;
    if (w >= 1024) return columns.lg;
    if (w >= 640) return columns.sm;
    return columns.base;
  }, [columns]);

  const rowCount = Math.ceil(jobs.length / colCount);

  // Vi virtualiserar mot fönstret eftersom korten ligger i sid-scrollen,
  // inte en intern scrollbox. useWindowVirtualizer hade krävt en ref till
  // window — istället mäter vi en offset via parentRef + window scroll.
  const virtualizer = useVirtualizer({
    count: rowCount,
    estimateSize: () => estimateRowHeight,
    overscan,
    getScrollElement: () => {
      // Hitta närmaste scroll-container (main-element i layouten)
      let el: HTMLElement | null = parentRef.current;
      while (el) {
        const style = el.parentElement ? window.getComputedStyle(el.parentElement) : null;
        if (
          style &&
          (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          el.parentElement!.scrollHeight > el.parentElement!.clientHeight
        ) {
          return el.parentElement;
        }
        el = el.parentElement;
      }
      return document.scrollingElement as HTMLElement | null;
    },
  });

  if (jobs.length === 0) {
    return (
      <div style={{ display: isVisible ? 'block' : 'none' }}>
        {emptyState}
      </div>
    );
  }

  const items = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      ref={parentRef}
      style={{
        display: isVisible ? 'block' : 'none',
        position: 'relative',
        height: `${totalSize}px`,
        width: '100%',
      }}
    >
      {items.map((virtualRow) => {
        const startIdx = virtualRow.index * colCount;
        const rowJobs = jobs.slice(startIdx, startIdx + colCount);
        return (
          <div
            key={virtualRow.key}
            data-virtual-row={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
              display: 'grid',
              gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
              gap: '1rem',
              paddingBottom: '1rem',
            }}
          >
            {rowJobs.map((job, i) => (
              <div key={job.id} style={{ contain: 'layout style paint' }}>
                {renderCard(job, startIdx + i)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}) as <T extends JobPosting>(props: {
  jobs: T[];
  isVisible: boolean;
  renderCard: (job: T, idx: number) => ReactNode;
  estimateRowHeight: number;
  columns: { base: number; sm: number; lg: number };
  overscan: number;
  emptyState?: ReactNode;
}) => JSX.Element;

function VirtualJobGridImpl<T extends JobPosting>({
  tabs,
  activeTab,
  renderCard,
  estimateRowHeight = 460,
  columns = { base: 1, sm: 2, lg: 3 },
  overscan = 4,
  className = '',
  emptyState,
}: VirtualJobGridProps<T>) {
  return (
    <div className={className}>
      {tabs.map((tab) => (
        <TabPanel
          key={tab.key}
          jobs={tab.jobs}
          isVisible={tab.key === activeTab}
          renderCard={renderCard}
          estimateRowHeight={estimateRowHeight}
          columns={columns}
          overscan={overscan}
          emptyState={emptyState}
        />
      ))}
    </div>
  );
}

export const VirtualJobGrid = memo(VirtualJobGridImpl) as typeof VirtualJobGridImpl;
