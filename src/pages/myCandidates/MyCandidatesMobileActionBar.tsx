import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ArrowDown,
  Trash2,
  CheckSquare,
  Square,
} from 'lucide-react';
import { getIconByName } from '@/hooks/useStageSettings';
import { useDevice } from '@/hooks/use-device';
import { useTouchCapable } from '@/hooks/useInputCapability';

interface MyCandidatesMobileActionBarProps {
  selectedCount: number;
  totalVisibleCount: number;
  allVisibleSelected: boolean;
  onToggleAllVisible: () => void;
  stageOrder: string[];
  stageConfig: Record<string, { label: string; color: string; iconName?: string }>;
  onBulkMoveToStage: (stage: string) => void;
  onBulkDeleteClick: () => void;
}

export const MyCandidatesMobileActionBar = ({
  selectedCount,
  totalVisibleCount,
  allVisibleSelected,
  onToggleAllVisible,
  stageOrder,
  stageConfig,
  onBulkMoveToStage,
  onBulkDeleteClick,
}: MyCandidatesMobileActionBarProps) => {
  const device = useDevice();
  const touchCapable = useTouchCapable();
  const isTouchMobile = device === 'mobile' && touchCapable;

  const [openTooltipStage, setOpenTooltipStage] = useState<string | null>(null);
  const [menuAlignOffset, setMenuAlignOffset] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [truncatedStages, setTruncatedStages] = useState<Record<string, boolean>>({});
  const barRef = useRef<HTMLDivElement>(null);
  const moveButtonRef = useRef<HTMLButtonElement>(null);
  const stageLabelRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  const recalculateMenuCentering = useCallback(() => {
    const bar = barRef.current;
    const trigger = moveButtonRef.current;
    if (!bar || !trigger) return;

    const barRect = bar.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();

    const barCenterX = barRect.left + barRect.width / 2;
    const triggerCenterX = triggerRect.left + triggerRect.width / 2;

    setMenuAlignOffset(triggerCenterX - barCenterX);
  }, []);

  const recalculateTruncatedStages = useCallback(() => {
    if (!isMenuOpen) return;

    const nextTruncated: Record<string, boolean> = {};
    for (const stage of stageOrder) {
      const labelElement = stageLabelRefs.current[stage];
      nextTruncated[stage] =
        !!labelElement && Math.ceil(labelElement.scrollWidth) > Math.ceil(labelElement.clientWidth) + 1;
    }

    setTruncatedStages(nextTruncated);
  }, [isMenuOpen, stageOrder]);

  useEffect(() => {
    recalculateMenuCentering();
    recalculateTruncatedStages();

    const handleResize = () => {
      recalculateMenuCentering();
      recalculateTruncatedStages();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [recalculateMenuCentering, recalculateTruncatedStages]);

  useEffect(() => {
    if (!isMenuOpen) {
      setOpenTooltipStage(null);
      return;
    }

    const raf = requestAnimationFrame(() => {
      recalculateMenuCentering();
      recalculateTruncatedStages();
    });

    return () => cancelAnimationFrame(raf);
  }, [isMenuOpen, recalculateMenuCentering, recalculateTruncatedStages]);

  // Auto-dismiss tooltip after 2.5s
  useEffect(() => {
    if (!openTooltipStage) return;
    const timer = setTimeout(() => setOpenTooltipStage(null), 2500);
    return () => clearTimeout(timer);
  }, [openTooltipStage]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="animate-in slide-in-from-bottom-4 duration-300 flex justify-center mt-2">
        <div ref={barRef} className="flex items-center gap-2 bg-card-parium/95 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 shadow-xl overflow-hidden min-w-0 max-w-full">
          <span className="text-white text-xs font-semibold whitespace-nowrap flex-shrink-0">
            {selectedCount}/{totalVisibleCount}
          </span>
          <div className="w-px h-5 bg-white/20 flex-shrink-0" />
          <button
            onClick={onToggleAllVisible}
            onMouseDown={(e) => e.preventDefault()}
            className="flex items-center justify-center px-2.5 h-9 text-xs font-medium whitespace-nowrap flex-shrink-0 text-white outline-none focus:outline-none transition-all duration-200 rounded-md active:scale-[0.97] touch-manipulation"
          >
            {allVisibleSelected ? <Square className="h-4 w-4 mr-1.5" /> : <CheckSquare className="h-4 w-4 mr-1.5" />}
            {allVisibleSelected ? 'Avmarkera' : 'Välj alla'}
          </button>
          <div className="w-px h-5 bg-white/20 flex-shrink-0" />

          <DropdownMenu
            onOpenChange={(open) => {
              setIsMenuOpen(open);
              if (!open) setOpenTooltipStage(null);
            }}
          >
            <DropdownMenuTrigger asChild>
              <button
                ref={moveButtonRef}
                disabled={selectedCount === 0}
                onMouseDown={(e) => e.preventDefault()}
                className={`flex items-center px-2.5 h-9 text-xs font-medium whitespace-nowrap flex-shrink-0 outline-none focus:outline-none transition-all duration-200 rounded-md active:scale-[0.97] touch-manipulation ${
                  selectedCount === 0 ? 'text-white/30 cursor-not-allowed' : 'text-white'
                }`}
              >
                <ArrowDown className="h-4 w-4 mr-1.5" />
                Flytta
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="bottom"
              align="center"
              alignOffset={menuAlignOffset}
              sideOffset={8}
              collisionPadding={16}
              className="border-white/20 min-w-[180px] w-[min(86vw,300px)]"
            >
              <TooltipProvider delayDuration={0} skipDelayDuration={0}>
                {stageOrder.map(stage => {
                  const settings = stageConfig[stage];
                  const Icon = getIconByName(settings?.iconName || 'flag');
                  const label = settings?.label || stage;
                  const isTruncated = truncatedStages[stage] ?? label.length > 18;
                  const usesTapTooltip = isTouchMobile && isTruncated;
                  const isTooltipVisible = openTooltipStage === stage;

                  return (
                    <Tooltip
                      key={stage}
                      open={usesTapTooltip ? isTooltipVisible : undefined}
                      onOpenChange={() => {/* controlled manually */}}
                    >
                      <TooltipTrigger asChild>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            if (usesTapTooltip && !isTooltipVisible) {
                              e.preventDefault();
                              setOpenTooltipStage(stage);
                              return;
                            }
                            setOpenTooltipStage(null);
                            onBulkMoveToStage(stage);
                          }}
                          onPointerDown={(e) => {
                            if (usesTapTooltip && !isTooltipVisible && e.pointerType === 'touch') {
                              e.preventDefault();
                            }
                          }}
                          className="text-white hover:text-white cursor-pointer min-h-[44px]"
                        >
                          <div className="h-2 w-2 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: settings?.color || '#6366F1' }} />
                          <Icon className="h-4 w-4 mr-2 text-white/70 flex-shrink-0" />
                          <span
                            ref={(node) => { stageLabelRefs.current[stage] = node; }}
                            className="truncate min-w-0"
                          >
                            {label}
                          </span>
                        </DropdownMenuItem>
                      </TooltipTrigger>
                      {isTruncated && (
                        <TooltipContent side="top" align="center" sideOffset={8} className="max-w-[260px] z-[999999] pointer-events-none">
                          <p className="text-xs leading-relaxed break-words whitespace-normal">{label}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}
              </TooltipProvider>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="w-px h-5 bg-white/20 flex-shrink-0" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                disabled={selectedCount === 0}
                onClick={onBulkDeleteClick}
                onMouseDown={(e) => e.preventDefault()}
                className={`flex h-9 w-9 items-center justify-center rounded-full outline-none focus:outline-none transition-all duration-200 active:scale-[0.97] touch-manipulation ${
                  selectedCount === 0 ? 'cursor-not-allowed border border-destructive/20 bg-destructive/10 text-white/30' : 'border border-destructive/40 bg-destructive/20 text-white md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white'
                }`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8}>
              <p>Ta bort</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
};
