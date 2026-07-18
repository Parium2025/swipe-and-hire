import { useState, useEffect, useCallback, ImgHTMLAttributes } from "react";

/**
 * ResilientImage
 * Drop-in replacement for <img> with:
 *  - Auto-retry on load error (3 attempts with backoff)
 *  - "Bilden kunde inte laddas. Försök igen"-fallback (text only, no icons)
 *  - 100% visual parity with <img> on success
 *
 * Usage: <ResilientImage src={url} alt="..." className="..." />
 */
interface ResilientImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src?: string | null;
  fallbackClassName?: string;
}

export function ResilientImage({
  src,
  alt,
  className,
  fallbackClassName,
  onLoad,
  onError,
  ...rest
}: ResilientImageProps) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  // Reset when src changes
  useEffect(() => {
    setAttempt(0);
    setFailed(false);
    setLoadedOnce(false);
  }, [src]);

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (attempt < 2) {
        // Retry with backoff: 600ms, 1500ms
        const delay = attempt === 0 ? 600 : 1500;
        setTimeout(() => setAttempt((a) => a + 1), delay);
      } else {
        setFailed(true);
        onError?.(e);
      }
    },
    [attempt, onError]
  );

  const handleManualRetry = useCallback(() => {
    setAttempt(0);
    setFailed(false);
  }, []);

  if (!src) {
    // Empty src — render nothing visible (parent controls placeholder)
    return null;
  }

  if (failed) {
    return (
      <div
        className={
          fallbackClassName ??
          `${className ?? ""} flex flex-col items-center justify-center bg-white/5 text-white/70 text-xs gap-1 p-2 text-center`
        }
        role="img"
        aria-label={alt || "Bilden kunde inte laddas"}
      >
        <span className="leading-tight">Bilden kunde inte laddas</span>
        <button
          type="button"
          onClick={handleManualRetry}
          className="text-white/90 underline underline-offset-2 hover:text-white transition-colors"
        >
          Försök igen
        </button>
      </div>
    );
  }

  // Cache-bust on retry attempts only (not initial load — keeps cache benefits)
  const finalSrc =
    attempt > 0
      ? `${src}${src.includes("?") ? "&" : "?"}_r=${attempt}`
      : src;

  return (
    <img
      {...rest}
      src={finalSrc}
      alt={alt}
      className={className}
      onLoad={(e) => {
        setLoadedOnce(true);
        onLoad?.(e);
      }}
      onError={handleError}
    />
  );
}

export default ResilientImage;
