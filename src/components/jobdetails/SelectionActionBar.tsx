import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getJobStageIconByName } from '@/hooks/useJobStageSettings';
import { useDevice } from '@/hooks/use-device';
import { useTouchCapable } from '@/hooks/useInputCapability';
import { ArrowDown, CheckSquare, Square } from 'lucide-react';

interface SelectionActionBarProps {
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  onToggleAll: () => void;
  disabled: boolean;
  stages: string[];
  stageSettings: Record<string, { label?: string; color?: string; iconName?: string }>;
  onMoveToStage: (stage: string) => void;
}

export const SelectionActionBar = ({
  selectedCount,
  totalCount,
  allSelected,
  onToggleAll,
  disabled,
  stages,
  stageSettings: settings,
  onMoveToStage,
}: SelectionActionBarProps) => {
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
    for (const stage of stages) {
      const labelElement = stageLabelRefs.current[stage];
      nextTruncated[stage] =
        !!labelElement && Math.ceil(labelElement.scrollWidth) > Math.ceil(labelElement.clientWidth) + 1;
    }

    setTruncatedStages(nextTruncated);
  }, [isMenuOpen, stages]);

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
    const timer = setTimeout(() => setOpenTooltipStage(null), 1800);
    return () => clearTimeout(timer);
  }, [openTooltipStage]);

  return (
    <div ref={barRef} className="flex items-center gap-1.5 bg-card-parium/95 backdrop-blur-md border border-white/20 rounded-full px-3 py-2 shadow-xl overflow-hidden min-w-0 max-w-full">
      <span className="text-white text-xs font-medium whitespace-nowrap flex-shrink-0">
        {selectedCount}/{totalCount} valda
      </span>
      <div className="w-px h-4 bg-white/20 flex-shrink-0" />
      <button
        onClick={onToggleAll}
        onMouseDown={(e) => e.preventDefault()}
        className="flex items-center justify-center px-2 h-8 text-xs whitespace-nowrap flex-shrink-0 w-[90px] text-white md:hover:bg-white/10 outline-none focus:outline-none transition-all duration-200 rounded-md"
      >
        {allSelected ? <Square className="h-3.5 w-3.5 mr-1" /> : <CheckSquare className="h-3.5 w-3.5 mr-1" />}
        {allSelected ? 'Avmarkera' : 'Välj alla'}
      </button>
      <div className="w-px h-4 bg-white/20 flex-shrink-0" />

      <DropdownMenu
        onOpenChange={(open) => {
          setIsMenuOpen(open);

          if (!open) {
            setOpenTooltipStage(null);
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            ref={moveButtonRef}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            className={`flex items-center px-2 h-8 text-xs whitespace-nowrap flex-shrink-0 outline-none focus:outline-none md:hover:bg-white/10 md:hover:text-white transition-all duration-200 rounded-md ${
              disabled ? 'text-white/30 cursor-not-allowed' : 'text-white'
            }`}
          >
            <ArrowDown className="h-3.5 w-3.5 mr-1" />
            Flytta till
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
            {stages.map((stage) => {
              const s = settings[stage];
              const StageIcon = getJobStageIconByName(s?.iconName || 'inbox');
              const label = s?.label || stage;
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
                        // Truncated + touch: first tap shows tooltip, second tap selects
                        if (usesTapTooltip && !isTooltipVisible) {
                          e.preventDefault();
                          setOpenTooltipStage(stage);
                          return;
                        }

                        // Non-truncated or second tap: select immediately
                        setOpenTooltipStage(null);
                        onMoveToStage(stage);
                      }}
                      onPointerDown={(e) => {
                        // On touch, prevent Radix from closing menu on first tap when truncated
                        if (usesTapTooltip && !isTooltipVisible && e.pointerType === 'touch') {
                          e.preventDefault();
                        }
                      }}
                      className="text-white hover:text-white cursor-pointer min-h-[44px]"
                    >
                      <div className="h-2 w-2 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: s?.color || 'hsl(var(--primary))' }} />
                      <StageIcon className="h-4 w-4 mr-2 text-white flex-shrink-0" />
                      <span
                        ref={(node) => {
                          stageLabelRefs.current[stage] = node;
                        }}
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
    </div>
  );
};
