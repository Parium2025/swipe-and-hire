import * as React from "react";
import { DialogContent } from "@/components/ui/dialog";

/**
 * A wrapper around DialogContent that prevents auto-focus on open/close.
 * This eliminates the "double border" / focus ring flash that occurs when
 * Radix auto-focuses elements by default.
 * 
 * Adds data-parium="dialog-content" for CSS focus-ring suppression.
 */
export const DialogContentNoFocus = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  React.ComponentPropsWithoutRef<typeof DialogContent>
>(({ onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => (
  <DialogContent
    ref={ref}
    data-parium="dialog-content"
    onOpenAutoFocus={(e) => {
      e.preventDefault();
      // Blur any focused element to prevent flash on trigger button
      (document.activeElement as HTMLElement | null)?.blur?.();
      onOpenAutoFocus?.(e);
    }}
    onCloseAutoFocus={(e) => {
      e.preventDefault();
      // Blur to prevent focus returning to trigger button (causes flash)
      (document.activeElement as HTMLElement | null)?.blur?.();
      onCloseAutoFocus?.(e);
    }}
    {...props}
  />
));

DialogContentNoFocus.displayName = "DialogContentNoFocus";
