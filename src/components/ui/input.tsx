import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onBlur, onPointerDown, ...props }, ref) => {
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      onBlur?.(e);
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLInputElement>) => {
      onPointerDown?.(e);
      if (e.defaultPrevented || (e.pointerType !== 'touch' && e.pointerType !== 'pen')) return;
      const element = e.currentTarget;
      const keyboardTypes = new Set(['', 'email', 'number', 'password', 'search', 'tel', 'text', 'url']);
      if (!keyboardTypes.has(element.type)) return;
      if (document.activeElement === element) return;
      e.preventDefault();
      element.focus({ preventScroll: true });
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-[var(--control-height)] w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm text-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-white/40 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
          "[&:-webkit-autofill]:!bg-transparent [&:-webkit-autofill]:!text-foreground [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_hsl(var(--background))] [&:-webkit-autofill]:[-webkit-text-fill-color:hsl(var(--foreground))] [&:-webkit-autofill:hover]:shadow-[inset_0_0_0px_1000px_hsl(var(--background))] [&:-webkit-autofill:focus]:shadow-[inset_0_0_0px_1000px_hsl(var(--background))] [&:-webkit-autofill:active]:shadow-[inset_0_0_0px_1000px_hsl(var(--background))]",
          className
        )}
        ref={ref}
        onBlur={handleBlur}
        onPointerDown={handlePointerDown}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
