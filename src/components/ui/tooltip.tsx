import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & {
    allowOutsidePointerEvents?: boolean
  }
>(({ className, sideOffset = 4, allowOutsidePointerEvents = false, onPointerDownOutside, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      onPointerDownOutside={(event) => {
        onPointerDownOutside?.(event)
        if (!allowOutsidePointerEvents && !event.defaultPrevented) {
          event.preventDefault()
        }
      }}
      onWheel={(e) => e.stopPropagation()}
      className={cn(
        "z-[999999] overflow-y-auto overscroll-contain max-h-[300px] max-w-[min(90vw,600px)] rounded-md glass-panel px-3 py-1.5 text-sm text-white shadow-md pointer-events-auto break-words whitespace-pre-wrap animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
