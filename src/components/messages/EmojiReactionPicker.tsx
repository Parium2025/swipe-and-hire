import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const EMOJI_CATEGORIES = [
  {
    label: '😊',
    emojis: ['👍', '❤️', '😂', '🔥', '🎉', '👀', '🙏', '😍', '😢', '👏', '💯', '🤝'],
  },
  {
    label: '💼',
    emojis: ['✅', '📋', '💪', '🚀', '⭐', '🏆', '📌', '🎯', '💡', '📝', '🤔', '⏰'],
  },
  {
    label: '🫶',
    emojis: ['🥳', '😎', '🤩', '💪🏼', '🫡', '🤗', '😊', '🙌', '💐', '☕', '❤️‍🔥', '✨'],
  },
];

interface EmojiReactionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  /** Position the picker relative to the message */
  isOwn: boolean;
  /** Anchor element rect for positioning */
  anchorRect: DOMRect | null;
}

export function EmojiReactionPicker({
  isOpen,
  onClose,
  onSelectEmoji,
  isOwn,
  anchorRect,
}: EmojiReactionPickerProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Slight delay to prevent the double-tap itself from closing
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handler);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handler);
    };
  }, [isOpen, onClose]);

  // Reset category when opening
  useEffect(() => {
    if (isOpen) setActiveCategory(0);
  }, [isOpen]);

  if (!anchorRect) return null;

  // Robust viewport-aware positioning
  const pickerWidth = 280;
  const pickerHeight = 208; // estimated full height
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const margin = 8;
  const gap = 8;

  let left = isOwn ? anchorRect.right - pickerWidth : anchorRect.left;
  left = Math.max(margin, Math.min(left, viewportWidth - pickerWidth - margin));

  const spaceAbove = anchorRect.top - margin;
  const spaceBelow = viewportHeight - anchorRect.bottom - margin;

  let top: number;
  let verticalDirection: 'up' | 'down';

  if (spaceAbove >= pickerHeight) {
    // Place above bubble
    top = anchorRect.top - pickerHeight - gap;
    verticalDirection = 'up';
  } else if (spaceBelow >= pickerHeight) {
    // Place below bubble
    top = anchorRect.bottom + gap;
    verticalDirection = 'down';
  } else {
    // Bubble is too tall / limited space: clamp inside viewport and pick best animation direction
    const preferredTop = spaceBelow >= spaceAbove
      ? anchorRect.bottom + gap
      : anchorRect.top - pickerHeight - gap;
    top = Math.max(margin, Math.min(preferredTop, viewportHeight - pickerHeight - margin));
    verticalDirection = spaceBelow >= spaceAbove ? 'down' : 'up';
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />

          {/* Picker */}
          <motion.div
            ref={pickerRef}
            className="fixed z-[101] w-[280px]"
            style={{
              left,
              top,
            }}
            initial={{ opacity: 0, scale: 0.85, y: verticalDirection === 'up' ? 10 : -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: verticalDirection === 'up' ? 10 : -10 }}
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 400,
              mass: 0.6,
            }}
          >
            <div className="rounded-2xl bg-black/85 border border-white/15 backdrop-blur-xl shadow-2xl overflow-hidden">
              {/* Quick-access top row (first 6 most common) */}
              <div className="flex items-center justify-around px-2 py-2.5 border-b border-white/10">
                {EMOJI_CATEGORIES[0].emojis.slice(0, 6).map((emoji) => (
                  <button
                    key={`quick-${emoji}`}
                    onClick={() => {
                      onSelectEmoji(emoji);
                      onClose();
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-full md:hover:bg-white/15 active:scale-90 transition-all text-xl"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Category tabs */}
              <div className="flex items-center gap-1 px-3 pt-2 pb-1">
                {EMOJI_CATEGORIES.map((cat, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveCategory(idx)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-sm transition-all",
                      activeCategory === idx
                        ? "bg-white/15 scale-105"
                        : "md:hover:bg-white/10 opacity-60"
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Emoji grid */}
              <div className="grid grid-cols-6 gap-0.5 px-2 py-2">
                {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, idx) => (
                  <button
                    key={`${activeCategory}-${emoji}-${idx}`}
                    onClick={() => {
                      onSelectEmoji(emoji);
                      onClose();
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-full md:hover:bg-white/15 active:scale-75 transition-all text-xl"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
