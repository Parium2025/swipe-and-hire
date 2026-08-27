import { useRef, useState, useCallback, useEffect } from 'react';
import { Trash2, AlertTriangle, MailOpen } from 'lucide-react';
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

const DELETE_THRESHOLD = 64;
const MAX_TRANSLATE = 96;
const UNREAD_THRESHOLD = 64;
const DIRECTION_LOCK_PX = 6;


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
  const thresholdPassedRef = useRef(false);
  const directionLockedRef = useRef<'horizontal' | 'vertical' | null>(null);
  const lockOffsetRef = useRef(0);
  const velocityRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTRef = useRef(0);
  const suppressClickRef = useRef(false);

  // Ökas vid varje ny gest så att timers från en pågående animation
  // aldrig skriver över en ny dragning.
  const gestureIdRef = useRef(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [revealedSide, setRevealedSide] = useState<'delete' | 'unread' | null>(null);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const paint = useCallback(() => {
    rafRef.current = null;
    const x = pendingXRef.current;
    const content = contentRef.current;
    if (content) content.style.transform = `translate3d(${x}px,0,0)`;

    const del = deleteRef.current;
    if (del) {
      // Snabbare intoning: pillret är helt synligt redan innan tröskeln,
      // så det känns som att det ligger under kortet i stället för att tona in.
      const p = Math.min(Math.max(-x, 0) / (DELETE_THRESHOLD * 0.6), 1);
      del.style.opacity = `${p}`;
      del.style.transform = `scale(${0.82 + p * 0.18})`;
      if (p > 0.02 && revealedSide !== 'delete') setRevealedSide('delete');
    }
    const un = unreadRef.current;
    if (un) {
      const p = Math.min(Math.max(x, 0) / (UNREAD_THRESHOLD * 0.6), 1);
      un.style.opacity = `${p}`;
      un.style.transform = `scale(${0.82 + p * 0.18})`;
      if (p > 0.02 && revealedSide !== 'unread') setRevealedSide('unread');
    }
  }, [revealedSide]);


  const setX = useCallback((x: number) => {
    pendingXRef.current = x;
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(paint);
  }, [paint]);

  /**
   * `committed` = gesten utlöste en åtgärd. Då glider kortet tillbaka med
   * iOS-kurvan (långsam, tyngdkänsla) och pillret hänger kvar en aning innan
   * det tonar bort — istället för att snärta tillbaka direkt.
   */
  const animateBack = useCallback((committed = false) => {
    const gestureId = gestureIdRef.current;
    const contentMs = committed ? 260 : 200;
    const easing = 'cubic-bezier(0.32, 0.72, 0, 1)'; // iOS "sheet"-kurva


    // Avbryt ev. köad rAF-paint så den inte skriver över transitionen.
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }

    const content = contentRef.current;
    if (content) {
      content.style.transition = `transform ${contentMs}ms ${easing}`;
      content.style.transform = 'translate3d(0,0,0)';
      window.setTimeout(() => {
        if (gestureId !== gestureIdRef.current) return;
        if (contentRef.current) contentRef.current.style.transition = '';
      }, contentMs + 20);
    }
    [deleteRef.current, unreadRef.current].forEach((el) => {
      if (!el) return;
      const fadeMs = committed ? 180 : 150;
      el.style.transition = `opacity ${fadeMs}ms ease-out, transform ${fadeMs}ms ${easing}`;
      el.style.opacity = '0';
      el.style.transform = 'scale(0.82)';
      window.setTimeout(() => {
        if (gestureId !== gestureIdRef.current) return;
        if (el) el.style.transition = '';
      }, fadeMs + 20);
    });
    // Behåll pillret monterat tills det tonat klart.
    if (committed) {
      window.setTimeout(() => {
        if (gestureId === gestureIdRef.current) setRevealedSide(null);
      }, 200);
    } else {
      setRevealedSide(null);
    }

    pendingXRef.current = 0;
    currentXRef.current = 0;
  }, []);


  /**
   * "Peek": även en kort svepning som släpps innan tröskeln spelar upp HELA
   * rörelsen — kortet glider ut och visar pillret fullt, pausar ett ögonblick
   * och glider sedan tillbaka med den tunga iOS-kurvan. Det ger en lugn,
   * proffsig känsla istället för en snabb, hackig tillbakasnärt.
   */
  const animatePeek = useCallback((direction: 'delete' | 'unread') => {
    const gestureId = gestureIdRef.current;
    const easing = 'cubic-bezier(0.32, 0.72, 0, 1)';
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }

    const content = contentRef.current;
    const pill = direction === 'delete' ? deleteRef.current : unreadRef.current;
    const peekX = direction === 'delete' ? -(DELETE_THRESHOLD + 10) : UNREAD_THRESHOLD + 10;
    setRevealedSide(direction);

    // Fas 1: glid ut och visa hela pillret.
    if (content) {
      content.style.transition = `transform 280ms ${easing}`;
      content.style.transform = `translate3d(${peekX}px,0,0)`;
    }
    if (pill) {
      pill.style.transition = `opacity 200ms ease-out, transform 280ms ${easing}`;
      pill.style.opacity = '1';
      pill.style.transform = 'scale(1)';
    }

    // Fas 2: kort paus, sedan mjuk hemglidning + uttoning.
    window.setTimeout(() => {
      if (gestureId !== gestureIdRef.current) return;
      const c = contentRef.current;
      if (c) {
        c.style.transition = `transform 360ms ${easing}`;
        c.style.transform = 'translate3d(0,0,0)';
        window.setTimeout(() => {
          if (gestureId !== gestureIdRef.current) return;
          if (contentRef.current) contentRef.current.style.transition = '';
        }, 380);
      }
      [deleteRef.current, unreadRef.current].forEach((el) => {
        if (!el) return;
        el.style.transition = `opacity 220ms ease-out 80ms, transform 220ms ${easing} 80ms`;
        el.style.opacity = '0';
        el.style.transform = 'scale(0.82)';
        window.setTimeout(() => {
          if (gestureId !== gestureIdRef.current) return;
          if (el) el.style.transition = '';
        }, 320);
      });
      window.setTimeout(() => {
        if (gestureId === gestureIdRef.current) setRevealedSide(null);
      }, 380);
      pendingXRef.current = 0;
      currentXRef.current = 0;
    }, 320);
  }, []);

  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    pendingXRef.current = 0;
    currentXRef.current = 0;
    setRevealedSide(null);
    if (contentRef.current) contentRef.current.style.transform = 'translate3d(0,0,0)';
  }, [conversationName]);

  const beginDrag = useCallback((clientX: number, clientY: number) => {
    gestureIdRef.current += 1; // ogiltigförklarar timers från ev. pågående animation
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    startXRef.current = clientX;
    startYRef.current = clientY;
    currentXRef.current = 0;
    pendingXRef.current = 0;
    isSwipingRef.current = false;
    directionLockedRef.current = null;
    lockOffsetRef.current = 0;
    velocityRef.current = 0;
    lastXRef.current = clientX;
    lastTRef.current = performance.now();
    if (contentRef.current) contentRef.current.style.transition = '';

  }, []);

  const moveDrag = useCallback((clientX: number, clientY: number) => {
    const deltaX = clientX - startXRef.current;
    const deltaY = clientY - startYRef.current;

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

    // Haptik exakt när tröskeln passeras — som iOS Mail. Endast vid övergången.
    const passed = absDelta >= threshold;
    if (passed !== thresholdPassedRef.current) {
      thresholdPassedRef.current = passed;
      if (passed) { try { navigator.vibrate?.(6); } catch { /* ignoreras */ } }
    }

    const x = swipingRight ? resisted : -resisted;
    currentXRef.current = x;

    // Rullande hastighet (px/ms) — används för att känna igen en snabb flick.
    const now = performance.now();
    const dt = now - lastTRef.current;
    if (dt > 0) {
      const v = (clientX - lastXRef.current) / dt;
      velocityRef.current = velocityRef.current * 0.6 + v * 0.4;
      lastXRef.current = clientX;
      lastTRef.current = now;
    }

    setX(x);
  }, [onMarkUnread, canMarkUnread, setX]);


  const endDrag = useCallback(() => {
    if (!isSwipingRef.current) return;

    const offset = currentXRef.current;
    // Snabb flick ska kännas exakt lika tydlig som en lång dragning: vi väger
    // in hastigheten (px/ms) precis som iOS gör, så en kvick svepning också
    // utlöser åtgärden istället för att bara studsa tillbaka.
    const velocity = velocityRef.current;
    const flickRight = velocity > 0.45 && offset >= 26;
    const flickLeft = velocity < -0.45 && offset <= -26;

    const canUnread = !!onMarkUnread && canMarkUnread;
    const commitUnread = (offset >= UNREAD_THRESHOLD || flickRight) && canUnread;
    const commitDelete = offset <= -DELETE_THRESHOLD || flickLeft;

    if (commitDelete || commitUnread) {
      // Samma lugna rörelse oavsett om man drog hela vägen eller flickade:
      // kortet glider ut, visar pillret helt, pausar och glider hem.
      animatePeek(commitDelete ? 'delete' : 'unread');
    } else if (offset <= -8) {
      // Släppt tidigt åt vänster: visa ändå hela rörelsen (peek) — lugnt och proffsigt.
      animatePeek('delete');
    } else if (offset >= 8 && canUnread) {
      animatePeek('unread');
    } else {
      animateBack(false);
    }

    if (commitDelete) {
      setShowConfirm(true);
    } else if (commitUnread) {
      // Kör i samma frame som fingret släpps. Tillbakafjädringen sker via
      // inline-transform på contentRef och påverkas inte av omrenderingen.
      onMarkUnread?.();
    }
    thresholdPassedRef.current = false;

    isSwipingRef.current = false;
    directionLockedRef.current = null;
    lockOffsetRef.current = 0;
    velocityRef.current = 0;
    // Blockera klicket som annars öppnar konversationen direkt efter dragningen.
    suppressClickRef.current = true;
    window.setTimeout(() => { suppressClickRef.current = false; }, 250);
  }, [animateBack, animatePeek, onMarkUnread, canMarkUnread]);


  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    beginDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, [beginDrag]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    moveDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, [moveDrag]);

  // Mus: exakt samma gest som med fingret — dra åt vänster för att ta bort,
  // åt höger för att markera som oläst.
  // Robusthet: gesten avslutas ALLTID, även om musknappen släpps utanför
  // fönstret/iframen, fönstret tappar fokus eller webbläsaren äter mouseup.
  // Annars skulle kortet "fastna" och följa muspekaren utan nedtryckt knapp.
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    beginDrag(e.clientX, e.clientY);

    let cleanup = () => { /* ersätts nedan */ };

    const finish = () => {
      cleanup();
      endDrag();
    };

    const onMove = (ev: MouseEvent) => {
      // Knappen är inte längre nedtryckt (mouseup missades) → avsluta direkt.
      if (ev.buttons === 0) { finish(); return; }
      ev.preventDefault();
      moveDrag(ev.clientX, ev.clientY);
    };
    const onUp = () => finish();
    const onLeaveDocument = (ev: MouseEvent) => {
      if (ev.relatedTarget === null) finish();
    };

    cleanup = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('blur', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.removeEventListener('mouseleave', onLeaveDocument);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('blur', onUp);
    window.addEventListener('pointercancel', onUp);
    document.addEventListener('mouseleave', onLeaveDocument);
  }, [beginDrag, moveDrag, endDrag]);

  /**
   * Skyddsnät: om kortet av någon anledning ligger kvar utdraget utan aktiv
   * gest (t.ex. mouseup förlorades helt) så glider det hem så fort pekaren
   * rör kortet utan nedtryckt knapp. Man ska alltid kunna "få tag i" det igen.
   */
  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    if (e.buttons !== 0 || isSwipingRef.current) return;
    const content = contentRef.current;
    if (!content) return;
    const t = content.style.transform;
    if (t && t !== 'translate3d(0,0,0)' && t !== 'translate3d(0px, 0px, 0px)') {
      gestureIdRef.current += 1;
      animateBack(false);
    }
  }, [animateBack]);

  const handleClickCapture = useCallback((e: React.MouseEvent) => {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const handleConfirmDelete = useCallback(() => {
    setShowConfirm(false);
    onDelete();
  }, [onDelete]);


  return (
    <>
      <div
        className="relative w-full min-w-0 max-w-full overflow-hidden rounded-lg group"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={endDrag}
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnter}
        onClickCapture={handleClickCapture}
        onTouchCancel={() => animateBack(false)}
      >
        {/* Markera som oläst — visas vid drag åt höger */}
        {onMarkUnread && canMarkUnread && (
          <div className={cn("absolute inset-y-0 left-0 z-0 flex items-center pl-3", revealedSide === 'unread' ? 'visible' : 'invisible')}>
            <div
              ref={unreadRef}
              style={{ opacity: 0, transform: 'scale(0.82)', willChange: 'transform, opacity' }}
            >
              <button
                className="rounded-full flex items-center gap-1 px-3 py-2 bg-blue-500/20 border border-blue-500/40 text-white font-medium text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  animateBack(true);
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
        <div className={cn("absolute inset-y-0 right-0 z-0 flex items-center pr-3", revealedSide === 'delete' ? 'visible' : 'invisible')}>
          <div
            ref={deleteRef}
            style={{ opacity: 0, transform: 'scale(0.82)', willChange: 'transform, opacity' }}
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
          className="relative z-10 block w-full min-w-0 max-w-full overflow-hidden"
          style={{ transform: 'translate3d(0,0,0)', willChange: 'transform' }}
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
              <span className="font-semibold text-white break-words">
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
