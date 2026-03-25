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
  return (
    <TooltipProvider delayDuration={300}>
      <div className="animate-in slide-in-from-bottom-4 duration-300 flex justify-center mt-2">
        <div className="flex items-center gap-1.5 sm:gap-2 bg-card-parium/95 backdrop-blur-md border border-white/20 rounded-full px-3 sm:px-4 py-2 sm:py-2.5 shadow-xl overflow-hidden min-w-0 max-w-full">
          <span className="text-white text-xs sm:text-sm font-medium whitespace-nowrap flex-shrink-0">
            {selectedCount}/{totalVisibleCount}
          </span>
          <div className="w-px h-4 sm:h-5 bg-white/20 flex-shrink-0" />
          <button
            onClick={onToggleAllVisible}
            onMouseDown={(e) => e.preventDefault()}
            className="flex items-center justify-center px-2 sm:px-3 h-8 sm:h-9 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 text-white outline-none focus:outline-none transition-all duration-200 rounded-md active:scale-[0.97] touch-manipulation"
          >
            {allVisibleSelected ? <Square className="h-3.5 sm:h-4 w-3.5 sm:w-4 mr-1.5" /> : <CheckSquare className="h-3.5 sm:h-4 w-3.5 sm:w-4 mr-1.5" />}
            {allVisibleSelected ? 'Avmarkera' : 'Välj alla'}
          </button>
          <div className="w-px h-4 sm:h-5 bg-white/20 flex-shrink-0" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                disabled={selectedCount === 0}
                onMouseDown={(e) => e.preventDefault()}
                className={`flex items-center px-2 sm:px-3 h-8 sm:h-9 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 outline-none focus:outline-none transition-all duration-200 rounded-md active:scale-[0.97] touch-manipulation ${
                  selectedCount === 0 ? 'text-white/30 cursor-not-allowed' : 'text-white'
                }`}
              >
                <ArrowDown className="h-3.5 sm:h-4 w-3.5 sm:w-4 mr-1.5" />
                Flytta
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="border-white/20 min-w-[180px]">
              {stageOrder.map(stage => {
                const settings = stageConfig[stage];
                const Icon = getIconByName(settings?.iconName || 'flag');
                return (
                  <DropdownMenuItem 
                    key={stage}
                    onClick={() => onBulkMoveToStage(stage)}
                    className="text-white hover:text-white cursor-pointer"
                  >
                    <div className="h-2 w-2 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: settings?.color || '#6366F1' }} />
                    <Icon className="h-4 w-4 mr-2 text-white/70" />
                    <span className="truncate">{settings?.label || stage}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="w-px h-4 sm:h-5 bg-white/20 flex-shrink-0" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                disabled={selectedCount === 0}
                onClick={onBulkDeleteClick}
                onMouseDown={(e) => e.preventDefault()}
                className={`flex h-8 sm:h-9 items-center justify-center rounded-md px-2 sm:px-2.5 outline-none focus:outline-none transition-all duration-200 active:scale-[0.97] touch-manipulation ${
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
