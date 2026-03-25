import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowDown,
  Trash2,
  CheckSquare,
  Square,
} from 'lucide-react';
import { getIconByName } from '@/hooks/useStageSettings';

interface MyCandidatesDesktopActionBarProps {
  selectedCount: number;
  totalVisibleCount: number;
  allVisibleSelected: boolean;
  onToggleAllVisible: () => void;
  stageOrder: string[];
  stageConfig: Record<string, { label: string; color: string; iconName?: string }>;
  onBulkMoveToStage: (stage: string) => void;
  onBulkDeleteClick: () => void;
}

export const MyCandidatesDesktopActionBar = ({
  selectedCount,
  totalVisibleCount,
  allVisibleSelected,
  onToggleAllVisible,
  stageOrder,
  stageConfig,
  onBulkMoveToStage,
  onBulkDeleteClick,
}: MyCandidatesDesktopActionBarProps) => {
  return (
    <div className="hidden md:flex fixed bottom-6 left-0 right-0 z-50 animate-in slide-in-from-bottom-4 duration-300 px-4 justify-center">
      <div className="flex items-center gap-1.5 bg-card-parium/95 backdrop-blur-md border border-white/20 rounded-full px-3 py-2 shadow-xl overflow-hidden min-w-0 max-w-full">
        <span className="text-white text-xs font-medium whitespace-nowrap flex-shrink-0">
          {selectedCount}/{totalVisibleCount} valda
        </span>
        <div className="w-px h-4 bg-white/20 flex-shrink-0" />
        <button
          onClick={onToggleAllVisible}
          onMouseDown={(e) => e.preventDefault()}
          className="flex items-center justify-center px-2 h-8 text-xs whitespace-nowrap flex-shrink-0 w-[90px] text-white md:hover:bg-white/10 outline-none focus:outline-none transition-all duration-200 rounded-md"
        >
          {allVisibleSelected ? <Square className="h-3.5 w-3.5 mr-1" /> : <CheckSquare className="h-3.5 w-3.5 mr-1" />}
          {allVisibleSelected ? 'Avmarkera' : 'Välj alla'}
        </button>
        <div className="w-px h-4 bg-white/20 flex-shrink-0" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              disabled={selectedCount === 0}
              onMouseDown={(e) => e.preventDefault()}
              className={`flex items-center px-2 h-8 text-xs whitespace-nowrap flex-shrink-0 outline-none focus:outline-none md:hover:bg-white/10 md:hover:text-white transition-all duration-200 rounded-md ${
                selectedCount === 0 ? 'text-white/30 cursor-not-allowed' : 'text-white'
              }`}
            >
              <ArrowDown className="h-3.5 w-3.5 mr-1" />
              Flytta till
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

        <button
          disabled={selectedCount === 0}
          onClick={onBulkDeleteClick}
          onMouseDown={(e) => e.preventDefault()}
          className={`flex h-8 flex-shrink-0 items-center rounded-md px-2 text-xs whitespace-nowrap outline-none focus:outline-none transition-all duration-200 ${
            selectedCount === 0 ? 'cursor-not-allowed border border-destructive/20 bg-destructive/10 text-white/30' : 'border border-destructive/40 bg-destructive/20 text-white md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white'
          }`}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Ta bort
        </button>
      </div>
    </div>
  );
};
