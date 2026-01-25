import { useState } from 'react';
import { Smile } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉'];

interface EmojiReactionPickerProps {
  onSelect: (emoji: string) => void;
  isOwn: boolean;
}

export function EmojiReactionPicker({ onSelect, isOwn }: EmojiReactionPickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "p-1.5 rounded-full transition-all duration-200",
            "opacity-0 group-hover:opacity-100",
            "hover:bg-white/10 active:scale-95",
            "text-white/60 hover:text-white"
          )}
          aria-label="Lägg till reaktion"
        >
          <Smile className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-2 bg-slate-800 border-white/10"
        side={isOwn ? "left" : "right"}
        align="center"
      >
        <div className="flex gap-1">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleSelect(emoji)}
              className="p-2 text-xl hover:bg-white/10 rounded-lg transition-colors active:scale-90"
              aria-label={`Reagera med ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
