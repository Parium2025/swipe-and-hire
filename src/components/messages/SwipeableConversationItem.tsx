import { useRef, useState, useCallback, useEffect } from 'react';
import { Trash2, AlertTriangle, MailOpen, MoreVertical } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const DELETE_THRESHOLD = 80;
const MAX_TRANSLATE = 100;
const UNREAD_THRESHOLD = 80;
const DIRECTION_LOCK_PX = 8;

interface SwipeableConversationItemProps {
  children: React.ReactNode;
  onDelete: () => void;
  isDeleting?: boolean;
  conversationName: string;
  /** Dra åt höger för att markera konversationen som oläst igen. */
  onMarkUnread?: () => void;
  /** Döljer oläst-åtgärden när konversationen redan är oläst. */
  canMarkUnread?: boolean;
}

/**
 * Premiumkänsla: all rörelse under fingret skrivs direkt till DOM:en via refs
 * och requestAnimationFrame — inga React-renders per touchmove (som ger hack).
 * State används bara när gesten är klar (dialog) eller när knapparna ska visas.
 */
export function SwipeableConversationItem({
  children,
  onDelete,
  isDeleting,
  conversationName,
  onMarkUnread,
  canMarkUnread = false,
}: SwipeableConversationItemProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const deleteRef = useRef<HTMLDivElement>(null);
  const unreadRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentXRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const pendingXRef = useRef(0);
  const isSwipingRef = useRef(false);
  const directionLockedRef = useRef<'horizontal' | 'vertical' | null>(null);
  const lockOffsetRef = useRef(0);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const paint = useCallback(() => {
    rafRef.current = null;
    const x = pendingXRef.current;
    const content = contentRef.current;
    if (content) content.style.transform = `translate3d(${x}px,0,0)`;

    const del = deleteRef.current;
    if (del) {
      const p = Math.min(Math.max(-x, 0) / DELETE_THRESHOLD, 1);
      del.style.opacity = `${p}`;
      del.style.transform = `scale(${0.6 + p * 0.4})`;
      del.style.visibility = p > 0.02 ? 'visible' : 'hidden';
    }
    const un = unreadRef.current;
    if (un) {
      const p = Math.min(Math.max(x, 0) / UNREAD_THRESHOLD, 1);
      un.style.opacity = `${p}`;
      un.style.transform = `scale(${0.6 + p * 0.4})`;
      un.style.visibility = p > 0.02 ? 'visible' : 'hidden';
    }
  }, []);

  const setX = useCallback((x: number) => {
    pendingXRef.current = x;
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(paint);
  }, [paint]);

  const animateBack = useCallback(() => {
    const content = contentRef.current;
    if (content) {
      content.style.transition = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)';
      content.style.transform = 'translate3d(0,0,0)';
      window.setTimeout(() => {
        if (contentRef.current) contentRef.current.style.transition = '';
      }, 280);
    }
    [deleteRef.current, unreadRef.current].forEach((el) => {
      if (!el) return;
      el.style.transition = 'opacity 200ms ease-out, transform 200ms ease-out';
      el.style.opacity = '0';
      el.style.transform = 'scale(0.6)';
      window.setTimeout(() => {
        if (el) { el.style.transition = ''; el.style.visibility = 'hidden'; }
      }, 220);
    });
    pendingXRef.current = 0;
    currentXRef.current = 0;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    currentXRef.current = 0;
    isSwipingRef.current = false;
    directionLockedRef.current = null;
    lockOffsetRef.current = 0;
    if (contentRef.current) contentRef.current.style.transition = '';
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const deltaX = touch.clientX - startXRef.current;
    const deltaY = touch.clientY - startYRef.current;

    if (!directionLockedRef.current) {
      if (Math.abs(deltaX) > DIRECTION_LOCK_PX || Math.abs(deltaY) > DIRECTION_LOCK_PX) {
        directionLockedRef.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
        // Starta rörelsen från noll — annars hoppar kortet 8 px direkt (kändes "tvärnitande").
        lockOffsetRef.current = deltaX;
      }
      return;
    }

    if (directionLockedRef.current === 'vertical') return;

    const adjusted = deltaX - lockOffsetRef.current;

    // Vänster = ta bort. Höger = markera som oläst (bara när det är möjligt).
    const swipingRight = adjusted > 0;
    if (swipingRight && !(onMarkUnread && canMarkUnread)) {
      if (isSwipingRef.current) setX(0);
      return;
    }

    isSwipingRef.current = true;

    const absDelta = Math.abs(adjusted);
    const threshold = swipingRight ? UNREAD_THRESHOLD : DELETE_THRESHOLD;
    // Mjuk gummibandskurva efter tröskeln istället för hård klippning.
    const over = Math.max(absDelta - threshold, 0);
    const resisted =
      Math.min(absDelta, threshold) +
      (MAX_TRANSLATE - threshold) * (1 - Math.exp(-over / (MAX_TRANSLATE - threshold)));

    const x = swipingRight ? resisted : -resisted;
    currentXRef.current = x;
    setX(x);
  }, [onMarkUnread, canMarkUnread, setX]);

  const handleTouchEnd = useCallback(() => {
    if (!isSwipingRef.current) return;

    const offset = currentXRef.current;
    animateBack();

    if (offset <= -DELETE_THRESHOLD) {
      setShowConfirm(true);
    } else if (offset >= UNREAD_THRESHOLD && onMarkUnread && canMarkUnread) {
      try { navigator.vibrate?.(8); } catch { /* ignoreras */ }
      // Låt tillbakafjädringen hinna starta innan listan uppdateras — annars
      // klipper omrenderingen animationen och det ser ryckigt ut.
      window.setTimeout(() => onMarkUnread(), 220);
    }

    isSwipingRef.current = false;
    directionLockedRef.current = null;
    lockOffsetRef.current = 0;
  }, [animateBack, onMarkUnread, canMarkUnread]);

  const handleConfirmDelete = useCallback(() => {
    setShowConfirm(false);
    onDelete();
  }, [onDelete]);

  return (
    <>
      <div
        className="relative overflow-hidden rounded-lg group"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={animateBack}
      >
        {/* Markera som oläst — visas vid drag åt höger */}
        {onMarkUnread && canMarkUnread && (
          <div className="absolute inset-y-0 left-0 flex items-center z-0 pl-3">
            <div
              ref={unreadRef}
              style={{ opacity: 0, transform: 'scale(0.6)', visibility: 'hidden', willChange: 'transform, opacity' }}
            >
              <button
                className="rounded-full flex items-center gap-1 px-3 py-2 bg-blue-500/20 border border-blue-500/40 text-white font-medium text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  animateBack();
                  onMarkUnread?.();
                }}
                tabIndex={-1}
              >
                <MailOpen className="h-3.5 w-3.5 text-white" />
                <span>Oläst</span>
              </button>
            </div>
          </div>
        )}

        {/* Delete button on the RIGHT side */}
        <div className="absolute inset-y-0 right-0 flex items-center z-0 pr-3">
          <div
            ref={deleteRef}
            style={{ opacity: 0, transform: 'scale(0.6)', visibility: 'hidden', willChange: 'transform, opacity' }}
          >
            <button
              className="rounded-full flex items-center gap-1 px-3 py-2 bg-destructive/20 border border-destructive/40 text-white font-medium text-xs"
              onClick={(e) => {
                e.stopPropagation();
                animateBack();
                setShowConfirm(true);
              }}
              tabIndex={-1}
            >
              <Trash2 className="h-3.5 w-3.5 text-white" />
              <span>Ta bort</span>
            </button>
          </div>
        </div>

        {/* Content layer – slides LEFT to reveal delete on right */}
        <div
          ref={contentRef}
          className="relative z-10"
          style={{ transform: 'translate3d(0,0,0)', willChange: 'transform' }}
        >
          {children}
        </div>

        {/* Desktop: hover-menu for mark unread / delete (mouse alternative to swipe) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100"
              aria-label="Konversationsåtgärder"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="left" align="center" className="min-w-[10rem]">
            <DropdownMenuItem
              disabled={!canMarkUnread}
              onSelect={() => onMarkUnread?.()}
            >
              <MailOpen className="mr-2 h-4 w-4" />
              Markera som oläst
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setShowConfirm(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Ta bort
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
              ? Konversationen försvinner från din inkorg. När båda parter har tagit bort den raderas allt innehåll permanent.
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
