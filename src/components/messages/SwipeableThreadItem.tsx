import { useState, useRef, useCallback } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MessageThread } from './types';
import { ThreadItem } from './ThreadItem';

interface SwipeableThreadItemProps {
  thread: MessageThread;
  currentUserId: string;
  onClick: () => void;
  onDelete: (threadId: string) => void;
}

const SWIPE_THRESHOLD = 80;
const DELETE_TRIGGER_THRESHOLD = 120;

export function SwipeableThreadItem({
  thread,
  currentUserId,
  onClick,
  onDelete,
}: SwipeableThreadItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  
  // Transform x position to background color intensity
  const deleteOpacity = useTransform(x, [-DELETE_TRIGGER_THRESHOLD, -SWIPE_THRESHOLD, 0], [1, 0.5, 0]);
  const iconScale = useTransform(x, [-DELETE_TRIGGER_THRESHOLD, -SWIPE_THRESHOLD, 0], [1.2, 1, 0.8]);

  const handleDragEnd = useCallback((
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    // Check if swipe exceeds threshold
    if (offset < -DELETE_TRIGGER_THRESHOLD || velocity < -500) {
      setIsDeleting(true);
      onDelete(thread.id);
    }
  }, [thread.id, onDelete]);

  if (isDeleting) {
    return (
      <motion.div
        initial={{ height: 'auto', opacity: 1 }}
        animate={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="overflow-hidden"
      />
    );
  }

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-xl">
      {/* Delete background */}
      <motion.div 
        className="absolute inset-0 bg-red-500/80 flex items-center justify-end pr-6"
        style={{ opacity: deleteOpacity }}
      >
        <motion.div style={{ scale: iconScale }}>
          <Trash2 className="h-6 w-6 text-white" />
        </motion.div>
      </motion.div>

      {/* Swipeable content */}
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -DELETE_TRIGGER_THRESHOLD - 20, right: 0 }}
        dragElastic={{ left: 0.2, right: 0 }}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="relative z-10 bg-slate-900 touch-pan-y"
      >
        <ThreadItem
          thread={thread}
          currentUserId={currentUserId}
          onClick={onClick}
        />
      </motion.div>
    </div>
  );
}
