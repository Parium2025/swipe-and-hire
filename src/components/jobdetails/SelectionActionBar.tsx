import { useState } from 'react';
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

  return (
    <div className="flex items-center gap-1.5 bg-card-parium/95 backdrop-blur-md border border-white/20 rounded-full px-3 py-2 shadow-xl overflow-hidden min-w-0 max-w-full">
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

      <DropdownMenu onOpenChange={(open) => !open && setOpenTooltipStage(null)}>
        <DropdownMenuTrigger asChild>
          <button
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
          sideOffset={8}
          collisionPadding={16}
          className="border-white/20 min-w-[180px] w-[min(86vw,300px)] mx-auto"
        >
          <TooltipProvider delayDuration={120}>
            {stages.map((stage) => {
              const s = settings[stage];
              const StageIcon = getJobStageIconByName(s?.iconName || 'inbox');
              const label = s?.label || stage;
              const isLong = label.length > 20;
              const usesTapTooltip = isTouchMobile && isLong;

              return (
                <Tooltip
                  key={stage}
                  open={usesTapTooltip ? openTooltipStage === stage : undefined}
                  onOpenChange={usesTapTooltip ? (open) => setOpenTooltipStage(open ? stage : null) : undefined}
                >
                  <TooltipTrigger asChild>
                    <DropdownMenuItem
                      onSelect={(e) => {
                        if (usesTapTooltip && openTooltipStage !== stage) {
                          e.preventDefault();
                          setOpenTooltipStage(stage);
                          return;
                        }

                        setOpenTooltipStage(null);
                        onMoveToStage(stage);
                      }}
                      className="text-white hover:text-white cursor-pointer min-h-[44px]"
                    >
                      <div className="h-2 w-2 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: s?.color || 'hsl(var(--primary))' }} />
                      <StageIcon className="h-4 w-4 mr-2 text-white flex-shrink-0" />
                      <span className="truncate min-w-0">{label}</span>
                    </DropdownMenuItem>
                  </TooltipTrigger>

                  {isLong && (
                    <TooltipContent side="top" align="center" sideOffset={8} className="max-w-[260px] z-[999999]">
                      <p className="text-xs leading-relaxed break-all whitespace-normal">{label}</p>
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
