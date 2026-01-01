import * as React from "react";
import { DialogContent } from "@/components/ui/dialog";

/**
 * A wrapper around DialogContent that prevents auto-focus on open/close.
 * This eliminates the "double border" / focus ring flash that occurs when
 * Radix auto-focuses elements by default.
 */
export const DialogContentNoFocus = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  React.ComponentPropsWithoutRef<typeof DialogContent>
>(({ onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => (
  <DialogContent
    ref={ref}
    onOpenAutoFocus={(e) => {
      e.preventDefault();
      onOpenAutoFocus?.(e);
    }}
    onCloseAutoFocus={(e) => {
      e.preventDefault();
      onCloseAutoFocus?.(e);
    }}
    {...props}
  />
));

DialogContentNoFocus.displayName = "DialogContentNoFocus";
