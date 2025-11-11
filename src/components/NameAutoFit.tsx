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
    // Get the actual available width from parent container
    const parent = el.parentElement;
    if (!parent) return false;
    
    const parentWidth = parent.clientWidth;
    const styles = window.getComputedStyle(parent);
    const paddingLeft = parseFloat(styles.paddingLeft);
    const paddingRight = parseFloat(styles.paddingRight);
    const availableWidth = parentWidth - paddingLeft - paddingRight;
    
    // Clone and measure natural width without clamp
    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.position = "absolute";
    clone.style.visibility = "hidden";
    clone.style.pointerEvents = "none";
    clone.style.width = "max-content";
    clone.style.maxWidth = "none";
    // @ts-ignore vendor property
    clone.style.webkitLineClamp = "unset";
    clone.style.overflow = "visible";
    clone.style.whiteSpace = "normal";
    clone.style.wordBreak = "break-word";
    
    parent.appendChild(clone);
    const naturalWidth = clone.scrollWidth;
    const naturalHeight = clone.scrollHeight;
    parent.removeChild(clone);
    
    // Check if text needs more space than available
    const currentHeight = el.clientHeight;
    const lineHeight = parseFloat(window.getComputedStyle(el).lineHeight);
    const maxLines = 2;
    const maxHeight = lineHeight * maxLines;
    
    // If natural height exceeds max lines, it's truncated
    return naturalHeight > maxHeight + 2;
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
    el.style.width = "100%";
    el.style.maxWidth = "100%";
    

    // Iteratively reduce font size until it fits or we reach min
    let size = base;
    let guard = 0;
    while (isTruncated(el) && size > minFontPx && guard < 150) {
      size -= 0.3; // even gentler step for better precision
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
        "block",
        className
      )}
    >
      {text}
    </span>
  );
}

export default NameAutoFit;
