import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getJobStageIconByName } from '@/hooks/useJobStageSettings';
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
}: SelectionActionBarProps) => (
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
    <DropdownMenu>
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
      <DropdownMenuContent align="center" className="border-white/20 min-w-[180px]">
        {stages.map(stage => {
          const s = settings[stage];
          const StageIcon = getJobStageIconByName(s?.iconName || 'inbox');
          return (
            <DropdownMenuItem 
              key={stage}
              onClick={() => onMoveToStage(stage)}
              className="text-white hover:text-white cursor-pointer"
            >
              <div className="h-2 w-2 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: s?.color || '#0EA5E9' }} />
              <StageIcon className="h-4 w-4 mr-2 text-white/70" />
              <span className="truncate">{s?.label || stage}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);
