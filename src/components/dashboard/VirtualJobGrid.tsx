import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';

/**
 * VirtualJobGrid
 * --------------
 * Window-virtualised grid that renders ONLY the rows currently visible in the
 * viewport (plus a small overscan buffer). This lets the dashboard handle
 * thousands — millions, in theory — of job cards while keeping tab switching
 * and scrolling at 60 fps.
 *
 * Why window-virtualisation (not container-virtualisation)?
 *   The dashboard scrolls on the document body (`html`/`body` are the
 *   scroll containers). Wrapping the list in its own scroll container
 *   would break swipe-back, page scroll restoration, and the existing
 *   tab/swipe gestures. `useWindowVirtualizer` reads `window.scrollY`
 *   instead of a container ref, so we keep the native scroll behaviour.
 *
 * Why row-virtualisation (not item-virtualisation)?
 *   The grid has 1 / 2 / 3 columns depending on viewport width. Treating
 *   each row as one virtual item means we don't have to manage column
 *   geometry — CSS Grid handles that inside each row, and the virtualizer
 *   only needs to know row heights.
 */

interface VirtualJobGridProps<T extends { id: string }> {
  items: T[];
  /** Renders a single card. Should be wrapped in `memo` for best perf. */
  renderItem: (item: T, index: number) => React.ReactNode;
  /**
   * Estimated row height in pixels. Used for initial scroll geometry; the
   * virtualizer will measure real rows after they mount and self-correct.
   * Default = 540px which matches the current job-card layout
   * (image header ~210px + body ~330px).
   */
  estimateRowHeight?: number;
  /** Extra rows to render above/below the viewport. */
  overscan?: number;
  /** Optional className for the outer wrapper (e.g. `job-card-grid`). */
  className?: string;
  /** Force single-column layout (for the mobile grid). */
  singleColumn?: boolean;
}

/** Determine how many columns the CSS grid will render at the current viewport. */
function useColumnCount(singleColumn: boolean): number {
  const [cols, setCols] = useState<number>(() => {
    if (singleColumn || typeof window === 'undefined') return 1;
    const w = window.innerWidth;
    if (w >= 1024) return 3; // lg
    if (w >= 640) return 2;  // sm
    return 1;
  });

  useEffect(() => {
    if (singleColumn) {
      setCols(1);
      return;
    }
    const compute = () => {
      const w = window.innerWidth;
      if (w >= 1024) setCols(3);
      else if (w >= 640) setCols(2);
      else setCols(1);
    };
    compute();
    window.addEventListener('resize', compute, { passive: true });
    return () => window.removeEventListener('resize', compute);
  }, [singleColumn]);

  return cols;
}

function VirtualJobGridInner<T extends { id: string }>({
  items,
  renderItem,
  estimateRowHeight = 540,
  overscan = 2,
  className,
  singleColumn = false,
}: VirtualJobGridProps<T>) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const cols = useColumnCount(singleColumn);

  // Group items into rows of `cols` columns.
  const rows = useMemo(() => {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += cols) {
      out.push(items.slice(i, i + cols));
    }
    return out;
  }, [items, cols]);

  // Track the offset of the grid relative to document top so the virtualizer
  // can correctly compute which rows are in view.
  const [scrollMargin, setScrollMargin] = useState(0);
  useEffect(() => {
    const update = () => {
      if (parentRef.current) {
        const rect = parentRef.current.getBoundingClientRect();
        setScrollMargin(rect.top + window.scrollY);
      }
    };
    update();
    window.addEventListener('resize', update, { passive: true });
    return () => window.removeEventListener('resize', update);
  }, [items.length, cols]);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => estimateRowHeight,
    overscan,
    scrollMargin,
    // Stable key for each row so React reuses DOM nodes across renders.
    getItemKey: (index) => rows[index]?.[0]?.id ?? `row-${index}`,
  });

  const totalSize = virtualizer.getTotalSize();
  const virtualRows = virtualizer.getVirtualItems();

  // Grid template based on column count — matches the original Tailwind grid.
  const gridTemplate = `repeat(${cols}, minmax(0, 1fr))`;

  return (
    <div
      ref={parentRef}
      className={className}
      style={{
        position: 'relative',
        height: totalSize,
        width: '100%',
      }}
    >
      {virtualRows.map((virtualRow) => {
        const row = rows[virtualRow.index];
        if (!row) return null;
        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
              display: 'grid',
              gridTemplateColumns: gridTemplate,
              gap: '1rem',
              paddingBottom: '1rem',
              // GPU layer for smooth scroll/tab transitions.
              willChange: 'transform',
            }}
          >
            {row.map((item, colIdx) => (
              <div key={item.id}>{renderItem(item, virtualRow.index * cols + colIdx)}</div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// Generic memo wrapper.
export const VirtualJobGrid = memo(VirtualJobGridInner) as typeof VirtualJobGridInner;
