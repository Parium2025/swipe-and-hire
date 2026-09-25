import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Disable layout-driven growth for long mobile forms that must stay fixed while typing. */
  autoResize?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, onBlur, onChange, onPointerDown, onPointerUp, onPointerCancel, autoResize: autoResizeEnabled = true, ...props }, ref) => {
    const internalRef = React.useRef<HTMLTextAreaElement | null>(null);
    const pointerStartRef = React.useRef<{ id: number; x: number; y: number } | null>(null);

    const resizeToContent = React.useCallback((el: HTMLTextAreaElement | null) => {
      if (!el || !autoResizeEnabled) return;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }, [autoResizeEnabled]);

    // Sync ref
    const setRef = React.useCallback((node: HTMLTextAreaElement | null) => {
      internalRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
      resizeToContent(node);
    }, [ref, resizeToContent]);

    // Auto-resize on value changes (controlled components)
    React.useLayoutEffect(() => {
      resizeToContent(internalRef.current);
    }, [props.value, resizeToContent]);

    // Recalculate when a previously hidden accordion/tab becomes visible or
    // changes width. Measuring while hidden can otherwise leave a fixed,
    // internally scrolling textarea until its value changes again.
    React.useEffect(() => {
      if (!autoResizeEnabled) return;
      const element = internalRef.current;
      const container = element?.parentElement;
      if (!element || !container || typeof ResizeObserver === 'undefined') return;

      let frame: number | undefined;
      const observer = new ResizeObserver(() => {
        if (frame !== undefined) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => resizeToContent(element));
      });
      observer.observe(container);

      return () => {
        observer.disconnect();
        if (frame !== undefined) cancelAnimationFrame(frame);
      };
    }, [autoResizeEnabled, resizeToContent]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      resizeToContent(e.currentTarget);
      onChange?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      onBlur?.(e);
    };

    // Let Safari distinguish a tap from a scroll gesture before focusing.
    // Preventing pointerdown made every drag starting over a field reopen the
    // keyboard. A still tap is focused with preventScroll on pointerup instead.
    const handlePointerDown = (e: React.PointerEvent<HTMLTextAreaElement>) => {
      onPointerDown?.(e);
      if (e.defaultPrevented || (e.pointerType !== 'touch' && e.pointerType !== 'pen')) return;
      if (document.activeElement === e.currentTarget) return;
      pointerStartRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLTextAreaElement>) => {
      onPointerUp?.(e);
      const start = pointerStartRef.current;
      pointerStartRef.current = null;
      if (e.defaultPrevented || !start || start.id !== e.pointerId) return;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) return;
      if (document.activeElement === e.currentTarget) return;
      e.preventDefault();
      e.currentTarget.focus({ preventScroll: true });
    };

    const handlePointerCancel = (e: React.PointerEvent<HTMLTextAreaElement>) => {
      pointerStartRef.current = null;
      onPointerCancel?.(e);
    };

    return (
      <textarea
        className={cn(
          "flex min-h-[80px] md:min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm text-foreground ring-offset-background placeholder:text-muted-foreground outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-white/40 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-hidden",
          className
        )}
        ref={setRef}
        onBlur={handleBlur}
        onChange={handleChange}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
