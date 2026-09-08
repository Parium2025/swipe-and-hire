import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Chattsidan är en fullhöjdsvy utan extra bottenutrymme, övriga sidor har det.
 *
 * Problemet: routen byts i samma ögonblick man trycker på t.ex. profilen, men
 * chatten ligger kvar synlig ytterligare ~140 ms medan vyn tonas över
 * (KeepAlive `enterDelayMs`). Om bottenutrymmet läggs på direkt krymper
 * chattlistan mitt i övergången — det såg ut som att chatten "klipptes av".
 *
 * Lösning: slå PÅ chattläget direkt (då växer ytan, inget klipps), men slå AV
 * det först när vybytet är klart.
 */
const LEAVE_DELAY_MS = 220;

export function useMessagesChrome(): boolean {
  const { pathname } = useLocation();
  const isMessagesRoute = pathname.startsWith('/messages');
  const [isMessages, setIsMessages] = useState(isMessagesRoute);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (isMessagesRoute) {
      setIsMessages(true);
      return;
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setIsMessages(false);
    }, LEAVE_DELAY_MS);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isMessagesRoute]);

  return isMessages;
}
