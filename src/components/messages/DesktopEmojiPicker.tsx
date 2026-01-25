import { useState, useRef, useEffect } from 'react';
import { Smile } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

const EMOJI_CATEGORIES = {
  'Smileys': ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '🥰', '😘', '😋', '😛', '🤪', '😎', '🤩', '🥳'],
  'Gestures': ['👍', '👎', '👏', '🙌', '🤝', '🙏', '💪', '✌️', '🤞', '👌', '🤙', '👋', '✋', '🖐️', '👆', '👇', '👉', '👈', '🫶', '❤️'],
  'Objects': ['🔥', '⭐', '💯', '✨', '💡', '🎉', '🎊', '🏆', '💎', '📌', '📍', '🎯', '💼', '📊', '📈', '💰', '🎁', '📝', '📅', '⏰'],
  'Nature': ['☀️', '🌙', '⭐', '🌈', '🌸', '🌺', '🌻', '🌴', '🍀', '🌲', '🌊', '🔮', '💧', '❄️', '🍁', '🌷', '🌹', '🌼', '🌾', '🍃'],
};

interface DesktopEmojiPickerProps {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
}

export function DesktopEmojiPicker({ onSelect, disabled }: DesktopEmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<keyof typeof EMOJI_CATEGORIES>('Smileys');

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    // Don't close - let user add multiple emojis
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          className={cn(
            "hidden md:flex h-11 w-11 flex-shrink-0",
            "border border-white/30 text-white",
            "md:hover:bg-white/10 md:hover:border-white/50",
            "transition-all duration-300",
            "active:scale-95 active:bg-white/20"
          )}
          aria-label="Öppna emoji-väljare"
        >
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0 bg-slate-900/95 border-white/10 backdrop-blur-xl"
        side="top"
        align="end"
        sideOffset={8}
      >
        {/* Category tabs */}
        <div className="flex border-b border-white/10 p-1 gap-1">
          {Object.keys(EMOJI_CATEGORIES).map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category as keyof typeof EMOJI_CATEGORIES)}
              className={cn(
                "flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors",
                activeCategory === category
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              {category}
            </button>
          ))}
        </div>
        
        {/* Emoji grid */}
        <div className="p-2 max-h-48 overflow-y-auto">
          <div className="grid grid-cols-10 gap-0.5">
            {EMOJI_CATEGORIES[activeCategory].map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleSelect(emoji)}
                className="p-1.5 text-xl hover:bg-white/10 rounded-md transition-colors active:scale-90"
                aria-label={`Lägg till ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
