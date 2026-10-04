import * as React from "react"

import { cn } from "@/lib/utils"
import { fetchPriority } from '@/lib/fetchPriority';

/**
 * Custom Avatar implementation that avoids Radix UI's internal loading state
 * which causes a flash/flicker when images are already cached.
 * 
 * This implementation checks if the image is in browser cache synchronously
 * and renders accordingly to prevent any visible fallback flash.
 */

interface AvatarContextValue {
  imageLoaded: boolean;
  setImageLoaded: (loaded: boolean) => void;
  hasSource: boolean;
  setHasSource: (has: boolean) => void;
}

const AvatarContext = React.createContext<AvatarContextValue | null>(null);

const Avatar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  // Stabilt kontextvärde: ett nytt objekt vid varje rendering fick bildens
  // effekter att köras om i en ping-pong-loop, som kunde fastna med bilden
  // dold OCH initialerna dolda (tom cirkel).
  const [hasSource, setHasSource] = React.useState(false);
  const contextValue = React.useMemo(
    () => ({ imageLoaded, setImageLoaded, hasSource, setHasSource }),
    [imageLoaded, hasSource],
  );
  
  return (
    <AvatarContext.Provider value={contextValue}>
      <div
        ref={ref}
        className={cn(
          "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </AvatarContext.Provider>
  );
})
Avatar.displayName = "Avatar"

interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  onLoadingStatusChange?: (status: 'loading' | 'loaded' | 'error') => void;
}

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, src, alt, onLoadingStatusChange, ...props }, ref) => {
    const context = React.useContext(AvatarContext);
    const setImageLoaded = context?.setImageLoaded;
    const setHasSource = context?.setHasSource;
    const imgRef = React.useRef<HTMLImageElement | null>(null);
    const statusCbRef = React.useRef(onLoadingStatusChange);
    statusCbRef.current = onLoadingStatusChange;

    const isCachedSrc = (value?: string) => {
      if (!value || typeof document === 'undefined') return false;
      const probe = new Image();
      probe.src = value;
      return probe.complete && probe.naturalWidth > 0;
    };

    const [status, setStatus] = React.useState<'loading' | 'loaded' | 'error'>(() =>
      !src ? 'error' : isCachedSrc(src) ? 'loaded' : 'loading',
    );

    // Återställ endast när källan faktiskt byts.
    React.useLayoutEffect(() => {
      if (!src) { setStatus('error'); return; }
      const el = imgRef.current;
      if ((el && el.complete && el.naturalWidth > 0) || isCachedSrc(src)) setStatus('loaded');
      else setStatus('loading');
    }, [src]);

    // Bildens status är enda sanningen för om initialerna ska döljas.
    React.useLayoutEffect(() => {
      setImageLoaded?.(status === 'loaded');
      statusCbRef.current?.(status);
    }, [status, setImageLoaded]);

    // Talar om för initialerna att en bild faktiskt finns att vänta på.
    React.useLayoutEffect(() => {
      setHasSource?.(!!src && status !== 'error');
    }, [src, status, setHasSource]);

    React.useEffect(() => () => { setImageLoaded?.(false); setHasSource?.(false); }, [setImageLoaded, setHasSource]);

    // Fångar en load-händelse som hann ske innan React lyssnade.
    React.useEffect(() => {
      if (status !== 'loading') return;
      const el = imgRef.current;
      if (el && el.complete) setStatus(el.naturalWidth > 0 ? 'loaded' : 'error');
    }, [status, src]);

    const handleLoad = React.useCallback(() => setStatus('loaded'), []);
    const handleError = React.useCallback(() => setStatus('error'), []);

    const setRefs = React.useCallback((node: HTMLImageElement | null) => {
      imgRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLImageElement | null>).current = node;
    }, [ref]);

    if (!src || status === 'error') {
      return null;
    }

    return (
      <img
        ref={setRefs}
        src={src}
        alt={alt || ''}
        onLoad={handleLoad}
        onError={handleError}
        className={cn("aspect-square h-full w-full object-cover", className)}
        data-state={status}
        loading="eager"
        decoding="async"
        {...fetchPriority('high')}
        {...props}
        // Håll bilden osynlig tills den laddats klart — annars kan WebKit hinna
        // rita sin egen trasig-bild-symbol ovanpå initialerna.
        style={status === 'loaded' ? props.style : { ...(props.style ?? {}), visibility: 'hidden' }}
      />
    );
  }
);
AvatarImage.displayName = "AvatarImage"

interface AvatarFallbackProps extends React.HTMLAttributes<HTMLSpanElement> {
  delayMs?: number;
  fallbackType?: 'person' | 'company';
}

const AvatarFallback = React.forwardRef<HTMLSpanElement, AvatarFallbackProps>(
  ({ className, delayMs, fallbackType: _fallbackType, children, ...props }, ref) => {
    const context = React.useContext(AvatarContext);
    // Fördröjning bara när det finns en bild att vänta på — utan bild visas
    // initialerna direkt (före första ritningen).
    const effectiveDelay = context ? (context.hasSource ? delayMs : 0) : delayMs;
    const [showFallback, setShowFallback] = React.useState(!effectiveDelay);
    
    // Återställ alltid synligheten när bildläget ändras. Utan else-grenen låg
    // föregående kandidats 1,2 s-fördröjning kvar när nästa kandidat saknade
    // bild, vilket gjorde att initialerna kom sent trots delayMs={0}.
    React.useLayoutEffect(() => {
      if (effectiveDelay && effectiveDelay > 0) {
        setShowFallback(false);
        const timeout = setTimeout(() => {
          setShowFallback(true);
        }, effectiveDelay);
        return () => clearTimeout(timeout);
      }
      setShowFallback(true);
    }, [effectiveDelay]);
    
    // Don't show fallback if image is already loaded
    if (context?.imageLoaded) {
      return null;
    }
    
    // Show skeleton shimmer while waiting for image (before delayMs expires)
    if (!showFallback) {
      return (
        <span
          className="flex h-full w-full rounded-full animate-pulse bg-white/10"
          aria-hidden="true"
        />
      );
    }

    return (
      <span
        ref={ref}
        className={cn(
          "flex h-full w-full items-center justify-center rounded-full bg-muted",
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);
AvatarFallback.displayName = "AvatarFallback"

export { Avatar, AvatarImage, AvatarFallback }
