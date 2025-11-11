import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface NameAutoFitProps {
  text: string;
  className?: string;
  minFontPx?: number; // lowest we will go
  stepPx?: number; // decrement step
}

/**
 * Auto-fits name text into at most 2 lines without clipping glyphs.
 * - Shrinks font size gradually until no truncation is detected
 * - Falls back to minFontPx if still overflowing
 * - Re-evaluates on resize
 */
export function NameAutoFit({ text, className, minFontPx = 13, stepPx = 0.25 }: NameAutoFitProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const baseSizeRef = useRef<number | null>(null);

  const isTruncated = (el: HTMLElement) => {
    const styles = window.getComputedStyle(el);
    const clamp = (styles.getPropertyValue("-webkit-line-clamp") || "").trim();
    const hasClamp = clamp !== "" && clamp !== "none";

    if (hasClamp) {
      // Clone and measure natural height without clamp
      const clone = el.cloneNode(true) as HTMLElement;
      clone.style.position = "absolute";
      clone.style.visibility = "hidden";
      clone.style.pointerEvents = "none";
      // @ts-ignore vendor property
      clone.style.webkitLineClamp = "unset";
      clone.style.maxHeight = "none";
      clone.style.overflow = "visible";
      clone.style.width = `${el.clientWidth}px`;
      el.parentElement?.appendChild(clone);
      const natural = Math.ceil(clone.scrollHeight);
      el.parentElement?.removeChild(clone);
      const current = Math.ceil(el.clientHeight);
      return natural > current + 1;
    }

    return (
      Math.ceil(el.scrollHeight) > Math.ceil(el.clientHeight) ||
      Math.ceil(el.scrollWidth) > Math.ceil(el.clientWidth)
    );
  };

  const fit = () => {
    const el = ref.current;
    if (!el || typeof window === "undefined") return;

    const styles = window.getComputedStyle(el);
    const currentBase = parseFloat(styles.fontSize);
    if (Number.isFinite(currentBase) && !baseSizeRef.current) {
      baseSizeRef.current = currentBase;
    }

    // Reset to base before fitting
    const base = baseSizeRef.current ?? currentBase;
    el.style.fontSize = `${base}px`;
    

    // Iteratively reduce font size until it fits or we reach min
    let size = base;
    let guard = 0;
    while (isTruncated(el) && size > minFontPx && guard < 120) {
      size -= stepPx;
      el.style.fontSize = `${size}px`;
      guard++;
    }

  };

  useEffect(() => {
    fit();
    const ro = new ResizeObserver(() => setTimeout(fit, 30));
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <span
      ref={ref}
      className={cn(
        "two-line-ellipsis pr-[1ch] block",
        className
      )}
    >
      {text}
    </span>
  );
}

export default NameAutoFit;
