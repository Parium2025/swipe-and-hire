import { useRef, useState, useCallback } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertDialogContentNoFocus } from '@/components/ui/alert-dialog-no-focus';

const DELETE_THRESHOLD = 80;
const MAX_TRANSLATE = 100;

interface SwipeableConversationItemProps {
  children: React.ReactNode;
  onDelete: () => void;
  isDeleting?: boolean;
  conversationName: string;
}

export function SwipeableConversationItem({
  children,
  onDelete,
  isDeleting,
  conversationName,
}: SwipeableConversationItemProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentXRef = useRef(0);
  const isSwipingRef = useRef(false);
  const directionLockedRef = useRef<'horizontal' | 'vertical' | null>(null);
  const [translateX, setTranslateX] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const resetPosition = useCallback(() => {
    setIsResetting(true);
    setTranslateX(0);
    setTimeout(() => setIsResetting(false), 300);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    currentXRef.current = 0;
    isSwipingRef.current = false;
    directionLockedRef.current = null;
    setIsResetting(false);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const deltaX = touch.clientX - startXRef.current;
    const deltaY = touch.clientY - startYRef.current;

    if (!directionLockedRef.current) {
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        directionLockedRef.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
      }
      return;
    }

    if (directionLockedRef.current === 'vertical') return;

    // Only allow swiping LEFT (deltaX < 0) to reveal delete on the right
    if (deltaX >= 0) {
      if (isSwipingRef.current) {
        setTranslateX(0);
      }
      return;
    }

    isSwipingRef.current = true;

    const absDelta = Math.abs(deltaX);
    const clamped = Math.min(absDelta, MAX_TRANSLATE);
    const dampened = clamped > DELETE_THRESHOLD
      ? DELETE_THRESHOLD + (clamped - DELETE_THRESHOLD) * 0.3
      : clamped;

    currentXRef.current = dampened;
    setTranslateX(-dampened); // negative = slide left
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isSwipingRef.current) return;

    if (currentXRef.current >= DELETE_THRESHOLD) {
      resetPosition();
      setShowConfirm(true);
    } else {
      resetPosition();
    }

    isSwipingRef.current = false;
    directionLockedRef.current = null;
  }, [resetPosition]);

  const handleConfirmDelete = useCallback(() => {
    setShowConfirm(false);
    onDelete();
  }, [onDelete]);

  const deleteProgress = Math.min(Math.abs(translateX) / DELETE_THRESHOLD, 1);
  const showDeleteButton = Math.abs(translateX) > 5;

  return (
    <>
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-lg"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Delete button on the RIGHT side */}
        {showDeleteButton && (
          <div className="absolute inset-y-0 right-0 flex items-center z-0 pr-3">
            <div
              className={cn(
                "flex items-center justify-center transition-transform",
                deleteProgress >= 1 ? "scale-110" : "scale-100"
              )}
              style={{
                opacity: deleteProgress,
                transform: `scale(${0.6 + deleteProgress * 0.4})`,
              }}
            >
              <button
                className={cn(
                  "rounded-full flex items-center gap-1.5 px-4 py-2.5",
                  "bg-destructive/20 border border-destructive/40",
                  "text-white font-medium text-sm",
                  "transition-all duration-150",
                  deleteProgress >= 1 && "bg-destructive/30 border-destructive/50"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  resetPosition();
                  setShowConfirm(true);
                }}
                tabIndex={-1}
              >
                <Trash2 className="h-4 w-4 text-white" />
                <span>Ta bort</span>
              </button>
            </div>
          </div>
        )}

        {/* Content layer – slides LEFT to reveal delete on right */}
        <div
          className={cn(
            "relative z-10",
            isResetting && "transition-transform duration-300 ease-out"
          )}
          style={{
            transform: `translateX(${translateX}px)`,
          }}
        >
          {children}
        </div>
      </div>

      {/* Delete confirmation dialog – matches app standard */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContentNoFocus
          className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0"
        >
          <AlertDialogHeader className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-white" />
              </div>
              <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
                Ta bort konversation?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-white text-sm leading-relaxed">
              Vill du ta bort konversationen med{' '}
              <span className="font-semibold text-white inline-block max-w-[200px] truncate align-bottom">
                &quot;{conversationName}&quot;
              </span>
              ? Du försvinner från chatten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
            <AlertDialogCancel
              onClick={() => setShowConfirm(false)}
              className="btn-dialog-action flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              variant="destructiveSoft"
              className="btn-dialog-action flex-1 text-sm flex items-center justify-center rounded-full"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentNoFocus>
      </AlertDialog>
    </>
  );
}
