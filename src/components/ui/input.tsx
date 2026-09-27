import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onBlur, ...props }, ref) => {
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      onBlur?.(e);
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-[var(--control-height)] w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm text-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-white/40 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        onBlur={handleBlur}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
