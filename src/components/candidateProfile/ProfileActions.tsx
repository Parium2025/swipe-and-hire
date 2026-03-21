import { Button } from '@/components/ui/button';
import { MessageSquare, CalendarPlus, Users, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { StageSettings } from '@/hooks/useStageSettings';
import type { ManualOutreachActionKey } from '@/lib/outreachManualActions';
import type { ButtonProps } from '@/components/ui/button';

interface QuickAction {
  key: ManualOutreachActionKey;
  label: string;
  variant: ButtonProps['variant'];
  onClick: () => void;
}

interface ProfileActionsProps {
  variant: 'all-candidates' | 'my-candidates';
  hasTeam: boolean;
  onSendMessage: () => void;
  onBookInterview: () => void;
  onShare: () => void;
  onRemove: () => void;
  currentStage?: string;
  stageOrder?: string[];
  stageConfig?: Record<string, StageSettings>;
  onStageChange?: (newStage: string) => void;
  quickActions?: QuickAction[];
}

export const ProfileActions = ({
  variant,
  hasTeam,
  onSendMessage,
  onBookInterview,
  onShare,
  onRemove,
  currentStage,
  stageOrder,
  stageConfig,
  onStageChange,
  quickActions = [],
}: ProfileActionsProps) => {
  if (variant === 'my-candidates') {
    return (
      <div className="pt-4 border-t border-white/20 space-y-3">
        {quickActions.length > 0 && (
          <div className="space-y-2">
            <p className="text-center text-[10px] font-medium uppercase tracking-[0.18em] text-white/70">Snabbutskick</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {quickActions.map((action) => (
                <Button
                  key={action.key}
                  onClick={action.onClick}
                  variant={action.variant}
                  className="h-8 px-3 text-[11px] md:h-9 md:text-sm"
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-center gap-1">
          <Button onClick={onSendMessage} variant="glassPurple" className="min-w-0 flex-1 h-8 px-2 text-[11px] md:h-9 md:px-3 md:text-sm">
            <MessageSquare className="h-3 w-3 md:h-4 md:w-4 mr-1 shrink-0" />
            <span className="truncate">Chatta</span>
          </Button>
          <Button onClick={onBookInterview} variant="glassBlue" className="min-w-0 flex-1 h-8 px-2 text-[11px] md:h-9 md:px-3 md:text-sm">
            <CalendarPlus className="h-3 w-3 md:h-4 md:w-4 mr-1 shrink-0" />
            <span className="truncate">Boka möte</span>
          </Button>
          {hasTeam && (
            <Button onClick={onShare} variant="glassAmber" className="min-w-0 flex-1 h-8 px-2 text-[11px] md:h-9 md:px-3 md:text-sm">
              <Users className="h-3 w-3 md:h-4 md:w-4 mr-1 shrink-0" />
              <span className="truncate">Dela</span>
            </Button>
          )}
          <Button onClick={onRemove} variant="glassRed" className="min-w-0 flex-1 h-8 px-2 text-[11px] md:h-9 md:px-3 md:text-sm">
            <Trash2 className="h-3 w-3 md:h-4 md:w-4 mr-1 shrink-0" />
            <span className="truncate">Ta bort</span>
          </Button>
        </div>

        {currentStage && stageOrder && stageConfig && onStageChange && stageOrder.length > 1 && (() => {
          const currentIndex = stageOrder.indexOf(currentStage);
          const prevStage = currentIndex > 0 ? stageOrder[currentIndex - 1] : null;
          const nextStage = currentIndex < stageOrder.length - 1 ? stageOrder[currentIndex + 1] : null;
          const prevLabel = prevStage ? stageConfig[prevStage]?.label || prevStage : null;
          const nextLabel = nextStage ? stageConfig[nextStage]?.label || nextStage : null;

          return (
            <div className="space-y-2">
              <p className="text-center text-white text-xs font-medium">Flytta kandidat</p>
              <div className="flex min-w-0 items-center justify-between gap-2">
                <button
                  onClick={() => prevStage && onStageChange(prevStage)}
                  disabled={!prevStage}
                  className={`min-w-0 flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-full text-sm transition-colors ${
                    prevStage ? 'text-white bg-white/10 hover:bg-white/20' : 'opacity-40 text-white/50'
                  }`}
                >
                  <ChevronLeft className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate min-w-0">Till {(prevLabel || 'föregående').replace('?', '')}</span>
                </button>
                <div className="flex-shrink min-w-0 max-w-[40%] px-3 py-1 rounded-full bg-white/20 text-white text-xs font-medium truncate text-center">
                  {(stageConfig[currentStage]?.label || currentStage).replace('?', '')}
                </div>
                <button
                  onClick={() => nextStage && onStageChange(nextStage)}
                  disabled={!nextStage}
                  className={`min-w-0 flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-full text-sm transition-colors ${
                    nextStage ? 'text-white bg-white/10 hover:bg-white/20' : 'opacity-40 text-white/50'
                  }`}
                >
                  <span className="truncate min-w-0">Till {(nextLabel || 'nästa').replace('?', '')}</span>
                  <ChevronRight className="h-4 w-4 flex-shrink-0" />
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  return (
    <div className="border-t border-white/15 pt-4 mt-4 space-y-3">
      {quickActions.length > 0 && (
        <div className="space-y-2">
          <p className="text-center text-[10px] font-medium uppercase tracking-[0.18em] text-white/70">Snabbutskick</p>
          <div className="flex flex-wrap justify-center gap-2">
            {quickActions.map((action) => (
              <Button key={action.key} onClick={action.onClick} variant={action.variant} size="sm">
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onSendMessage} variant="glassPurple" size="default">
          <MessageSquare className="h-4 w-4 mr-1.5" />
          Meddelande
        </Button>
        <Button onClick={onBookInterview} variant="glassBlue" size="default">
          <CalendarPlus className="h-4 w-4 mr-1.5" />
          Boka möte
        </Button>
      </div>
    </div>
  );
};
