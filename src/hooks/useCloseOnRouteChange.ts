import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Stänger ett öppet helskärmslager (portal till document.body) när användaren
 * byter sida. Sidor hålls vid liv (KeepAlive, display:none), men portaler
 * ärver inte föräldens dolda läge och skulle annars ligga kvar ovanpå nästa sida.
 */
export function useCloseOnRouteChange(open: boolean, onClose: () => void) {
  const { pathname } = useLocation();
  const initialPath = useRef(pathname);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) initialPath.current = pathname;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open && pathname !== initialPath.current) onCloseRef.current();
  }, [pathname, open]);
}
