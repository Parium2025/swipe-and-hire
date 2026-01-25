import { cn } from '@/lib/utils';
import { GroupedReaction } from '@/hooks/useMessageReactions';

interface MessageReactionsProps {
  reactions: GroupedReaction[];
  onToggle: (emoji: string) => void;
  isOwn: boolean;
}

export function MessageReactions({ reactions, onToggle, isOwn }: MessageReactionsProps) {
  if (reactions.length === 0) return null;

  return (
    <div className={cn(
      "flex flex-wrap gap-1 mt-1",
      isOwn ? "justify-end" : "justify-start"
    )}>
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          onClick={() => onToggle(reaction.emoji)}
          className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all",
            "border active:scale-95",
            reaction.hasReacted
              ? "bg-blue-500/30 border-blue-500/50 text-white"
              : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
          )}
        >
          <span className="text-sm">{reaction.emoji}</span>
          <span className="text-white font-medium">{reaction.count}</span>
        </button>
      ))}
    </div>
  );
}
