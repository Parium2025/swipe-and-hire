import { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef, memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChevronDown, Sparkles } from 'lucide-react';
import { TruncatedText } from '@/components/TruncatedText';
import { getJobStageIconByName } from '@/hooks/useJobStageSettings';
import { SortableApplicationCard } from './ApplicationCard';
import type { JobApplication } from '@/hooks/useJobDetailsData';

export interface StatusColumnProps {
  jobId: string;
  status: string;
  applications: JobApplication[];
  /** Serverside-total för steget. Kan vara högre än `applications.length`
   *  medan bakgrundsladdningen fortfarande strömmar in sidor. */
  stageTotal?: number | null;
  /** true medan bakgrundsladdningen fortfarande hämtar sidor. */
  isStreaming?: boolean;
  onOpenProfile: (app: JobApplication) => void;
  onMarkAsViewed: (id: string) => void;
  onPrefetch?: (app: JobApplication) => void;
  onOpenCriteriaDialog?: () => void;
  stageConfig: {
    label: string;
    color: string;
    iconName: string;
    isCustom: boolean;
  };
  totalStageCount: number;
  criteriaCount?: number;
  isSelectionMode?: boolean;
  selectedApplicationIds?: Set<string>;
  onToggleSelect?: (applicationId: string) => void;
  targetStageKey?: string;
  targetStageLabel?: string;
  onMoveCandidatesAndDelete?: () => Promise<void>;
  stageIndex?: number;
  /** Antal kolumnslottar som bredden ska delas på (inkl. "Nytt steg"-slotten). */
  columnSlots?: number;
}

export const StatusColumn = memo(({ 
  jobId,
  status, 
  applications, 
  stageTotal,
  isStreaming: isStreamingPages,
  onOpenProfile, 
  onMarkAsViewed, 
  onPrefetch,
  onOpenCriteriaDialog,
  stageConfig,
  totalStageCount,
  criteriaCount = 0,
  isSelectionMode,
  selectedApplicationIds,
  onToggleSelect,
  targetStageKey,
  targetStageLabel,
  onMoveCandidatesAndDelete,
  stageIndex = 0,
  columnSlots,
}: StatusColumnProps) => {
  const displayCount = Math.max(stageTotal ?? 0, applications.length);
  // Visa bara "Laddar…" när bakgrundsströmmen faktiskt hämtar fler sidor.
  // Annars blinkar texten till varje gång ett kort flyttas mellan steg
  // (lokal flytt sker direkt, serverns totaler hinner efter någon sekund).
  const isStreaming = Boolean(isStreamingPages) && applications.length < displayCount;

  const [liveColor] = useState<string | null>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const displayColor = liveColor || stageConfig.color;
  const Icon = getJobStageIconByName(stageConfig.iconName);
  
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  // ── Virtualisering (aktiveras först vid stora kolumner) ──
  const VIRTUALIZE_THRESHOLD = 60;
  const OVERSCAN = 10;
  const GAP = 6; // space-y-1.5
  const [itemHeight, setItemHeight] = useState(56);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const isVirtual = applications.length > VIRTUALIZE_THRESHOLD;

  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    
    const hasScrollableContent = el.scrollHeight > el.clientHeight;
    const isAtTop = el.scrollTop <= 5;
    const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 5;
    
    setCanScrollUp(hasScrollableContent && !isAtTop);
    setCanScrollDown(hasScrollableContent && !isAtBottom);
    setScrollTop(el.scrollTop);
    setViewportHeight(el.clientHeight);
  }, []);

  // Scroll-eventet kan komma flera gånger per bildruta — mät en gång per bildruta.
  const rafRef = useRef<number | null>(null);
  const onScrollThrottled = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      checkScroll();
    });
  }, [checkScroll]);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    checkScroll();
  }, [applications.length, checkScroll]);

  useLayoutEffect(() => {
    if (!isVirtual) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const card = Array.from(el.children).find(
      (child) => !(child as HTMLElement).dataset.spacer && (child as HTMLElement).offsetHeight > 20
    ) as HTMLElement | undefined;
    const h = card?.offsetHeight;
    if (h && Math.abs(h - itemHeight) > 1) setItemHeight(h);
  });

  const pitch = itemHeight + GAP;
  const { startIndex, endIndex } = useMemo(() => {
    if (!isVirtual) return { startIndex: 0, endIndex: applications.length };
    const vh = viewportHeight || 600;
    const start = Math.max(0, Math.floor(scrollTop / pitch) - OVERSCAN);
    const visible = Math.ceil(vh / pitch) + OVERSCAN * 2;
    return { startIndex: start, endIndex: Math.min(applications.length, start + visible) };
  }, [isVirtual, applications.length, scrollTop, viewportHeight, pitch]);

  const visibleApplications = isVirtual ? applications.slice(startIndex, endIndex) : applications;
  const topSpacer = isVirtual && startIndex > 0 ? startIndex * pitch - GAP : 0;
  const bottomSpacer =
    isVirtual && endIndex < applications.length ? (applications.length - endIndex) * pitch - GAP : 0;

  // dnd-kit behöver bara känna till de kort som faktiskt är monterade.
  const sortableIds = useMemo(() => visibleApplications.map((a) => a.id), [visibleApplications]);

  // Listen for resize to update scroll indicators
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => ro.disconnect();
  }, [checkScroll]);


  // Samma bredduträkning som Mina kandidater: kolumnerna delar hela bredden
  // jämnt, ingen horisontell scroll → inga mätningar som hoppar under drag.
  const slots = Math.max(1, columnSlots ?? totalStageCount);
  const gapTotal = `${(slots - 1) * 0.75}rem`;

  return (
    <div 
      ref={setNodeRef}
      className="flex-none flex flex-col transition-colors h-full min-w-0"
      style={{ width: `calc((100% - ${gapTotal}) / ${slots})` }}
    >
      <div 
        className={`group rounded-md px-2 py-1.5 mb-2 transition-all ring-1 ring-inset ring-white/20 flex-shrink-0 ${isOver ? 'ring-2 ring-white/40' : ''}`}
        style={{ backgroundColor: `${displayColor}33` }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="h-3.5 w-3.5 text-white flex-shrink-0" />
          <TruncatedText
            text={stageConfig.label}
            className="font-medium text-xs text-white truncate flex-1 min-w-0"
          />
          <span 
            className="text-white text-[10px] h-4 min-w-4 px-1 flex items-center justify-center rounded-full flex-shrink-0"
            style={{ backgroundColor: `${displayColor}66` }}
          >
            {displayCount}
          </span>

          {onOpenCriteriaDialog && (
            <button
              onClick={onOpenCriteriaDialog}
              className="p-1 rounded hover:bg-white/20 transition-colors text-white/80 hover:text-white"
              title="Urvalskriterier"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
          )}
          {/* Stegen i en jobbannons är låsta standardsteg – de kan inte byggas
              om, döpas om eller raderas här. Vill man ha egna steg används
              "Mina kandidater". */}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 rounded-lg bg-white/5 ring-1 ring-inset ring-white/10">
        {canScrollUp && (
          <div className="absolute top-0 left-0 right-0 z-10 h-6 rounded-t-lg bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
        )}

        <div 
          ref={scrollContainerRef}
          onScroll={onScrollThrottled}
          className="h-full overflow-y-auto space-y-1.5 p-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent hover:scrollbar-thumb-white/30"
        >
          {topSpacer > 0 && <div data-spacer="top" style={{ height: topSpacer }} />}

          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            {visibleApplications.map((app) => (
              <SortableApplicationCard 
                key={app.id} 
                application={app} 
                onOpenProfile={() => onOpenProfile(app)}
                onMarkAsViewed={onMarkAsViewed}
                onPrefetch={() => onPrefetch?.(app)}
                criteriaCount={criteriaCount}
                isSelectionMode={isSelectionMode}
                isSelected={selectedApplicationIds?.has(app.id)}
                onToggleSelect={() => onToggleSelect?.(app.id)}
              />
            ))}
          </SortableContext>

          {bottomSpacer > 0 && <div data-spacer="bottom" style={{ height: bottomSpacer }} />}

          {isStreaming && (
            <div className="py-2 text-center text-[10px] text-white/70">
              Laddar {applications.length} av {displayCount}…
            </div>
          )}

          {applications.length === 0 && !isStreaming && !isOver && (
            <div className="py-8 text-center text-xs text-white">
              Inga kandidater i detta steg
            </div>
          )}

        </div>

        {canScrollDown && (
          <div className="absolute bottom-0 left-0 right-0 z-10 flex h-8 items-end justify-center rounded-b-lg bg-gradient-to-t from-white/5 to-transparent pb-1 pointer-events-none">
            <div className="animate-bounce">
              <ChevronDown className="h-3.5 w-3.5 text-white/60" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
StatusColumn.displayName = 'StatusColumn';
