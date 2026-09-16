import { useState, useEffect, useCallback, ImgHTMLAttributes } from "react";

const EMPTY_FALLBACK_SRCS: Array<string | null | undefined> = [];

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
  fallbackSrcs?: Array<string | null | undefined>;
  fallbackClassName?: string;
}

export function ResilientImage({
  src,
  fallbackSrcs = EMPTY_FALLBACK_SRCS,
  alt,
  className,
  fallbackClassName,
  onLoad,
  onError,
  ...rest
}: ResilientImageProps) {
  const fallbackSrcSignature = fallbackSrcs.filter(Boolean).join("|");
  const sourceSignature = `${src ?? ''}|${fallbackSrcSignature}`;
  const [imageState, setImageState] = useState({ sourceSignature, attempt: 0, sourceIndex: 0, failed: false });
  // When a persistent card slot receives a different job, stale retry/failure
  // state must never leak into the first frame of the new image.
  const state = imageState.sourceSignature === sourceSignature
    ? imageState
    : { sourceSignature, attempt: 0, sourceIndex: 0, failed: false };
  const { attempt, sourceIndex, failed } = state;
  const sources = [src, ...fallbackSrcs].filter((value, index, array): value is string => {
    return typeof value === "string" && value.trim().length > 0 && array.indexOf(value) === index;
  });
  const activeSrc = sources[Math.min(sourceIndex, Math.max(sources.length - 1, 0))] ?? null;

  // Reset when src changes
  useEffect(() => {
    setImageState({ sourceSignature, attempt: 0, sourceIndex: 0, failed: false });
  }, [sourceSignature]);

  // Auto-recover when tab regains focus or network comes back online
  useEffect(() => {
    if (!failed) return;
    const retry = () => {
      setImageState({ sourceSignature, attempt: 0, sourceIndex: 0, failed: false });
    };
    const onVis = () => {
      if (document.visibilityState === "visible") retry();
    };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [failed, sourceSignature]);

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (sourceIndex < sources.length - 1) {
        setImageState((current) => ({
          sourceSignature,
          attempt: 0,
          sourceIndex: current.sourceSignature === sourceSignature ? current.sourceIndex + 1 : 1,
          failed: false,
        }));
        return;
      }

      // 5 attempts total, gentle backoff. Keeps CDN cache benefits since
      // we only cache-bust after attempt 3 (transient blip vs. stuck cache).
      if (attempt < 4) {
        const delays = [500, 1200, 2500, 4500];
        setTimeout(() => setImageState((current) => current.sourceSignature === sourceSignature
          ? { ...current, attempt: current.attempt + 1 }
          : current), delays[attempt]);
      } else {
        setImageState({ sourceSignature, attempt, sourceIndex, failed: true });
        onError?.(e);
      }
    },
    [attempt, onError, sourceIndex, sourceSignature, sources.length]
  );

  const handleManualRetry = useCallback(() => {
    setImageState({ sourceSignature, attempt: 0, sourceIndex: 0, failed: false });
  }, [sourceSignature]);

  if (!activeSrc) {
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

  // Only cache-bust after multiple failures — preserves Supabase transform CDN cache
  // on happy path (avoids re-render cost and hitting transform rate limits).
  const finalSrc =
    attempt >= 3
      ? `${activeSrc}${activeSrc.includes("?") ? "&" : "?"}_r=${attempt}`
      : activeSrc;

  return (
    <img
      decoding="async"
      {...rest}
      src={finalSrc}
      alt={alt}
      className={className}
      onLoad={onLoad}
      onError={handleError}
    />
  );
}

export default ResilientImage;
