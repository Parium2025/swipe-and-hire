import { useCallback, useEffect, useRef, useState } from 'react';

const INTERACTION_BLOCK_EVENTS: Array<keyof WindowEventMap> = ['click', 'touchend', 'pointerup', 'mouseup'];

const stopInteractionEvent = (event: Event) => {
  event.preventDefault();
  event.stopPropagation();
  if ('stopImmediatePropagation' in event) {
    (event as Event & { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
  }
};

export function useTouchInteractionLock(defaultDuration = 520) {
  const [isInteractionLocked, setIsInteractionLocked] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const releaseInteractionLock = useCallback(() => {
    setIsInteractionLocked(false);

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
  }, []);

  const lockInteraction = useCallback((duration = defaultDuration) => {
    if (typeof window === 'undefined') return;

    setIsInteractionLocked(true);

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    INTERACTION_BLOCK_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, stopInteractionEvent, { capture: true, passive: false });
    });

    cleanupRef.current = () => {
      INTERACTION_BLOCK_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, stopInteractionEvent, true);
      });
    };

    timeoutRef.current = window.setTimeout(() => {
      releaseInteractionLock();
    }, duration);
  }, [defaultDuration, releaseInteractionLock]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  return {
    isInteractionLocked,
    lockInteraction,
    releaseInteractionLock,
  };
}