import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface NameAutoFitProps {
  text: string;
  className?: string;
  minFontPx?: number; // lowest we will go
}

/**
 * Auto-fits name text into at most 2 lines without clipping glyphs.
 * - Shrinks font size gradually until no truncation is detected
 * - Falls back to minFontPx if still overflowing
 * - Re-evaluates on resize
 */
export function NameAutoFit({ text, className, minFontPx = 12 }: NameAutoFitProps) {
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
    el.style.letterSpacing = styles.letterSpacing || "";

    // Iteratively reduce font size until it fits or we reach min
    let size = base;
    let guard = 0;
    while (isTruncated(el) && size > minFontPx && guard < 40) {
      size -= 0.5; // gentle step for smoother sizing
      el.style.fontSize = `${size}px`;
      guard++;
    }

    // Tiny tracking tweak if it's barely overflowing
    if (isTruncated(el)) {
      el.style.letterSpacing = "-0.2px";
      let extraGuard = 0;
      while (isTruncated(el) && size > minFontPx && extraGuard < 6) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
        extraGuard++;
      }
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
        "two-line-ellipsis block", // keep 2-line clamp, no fades
        className
      )}
    >
      {text}
    </span>
  );
}

export default NameAutoFit;
