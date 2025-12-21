import * as React from "react";
import { AlertDialogContent } from "@/components/ui/alert-dialog";

/**
 * A wrapper around AlertDialogContent that prevents auto-focus on open/close.
 * This eliminates the "double border" / focus ring flash that occurs when
 * Radix auto-focuses the cancel button by default.
 */
export const AlertDialogContentNoFocus = React.forwardRef<
  React.ElementRef<typeof AlertDialogContent>,
  React.ComponentPropsWithoutRef<typeof AlertDialogContent>
>(({ onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => (
  <AlertDialogContent
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

AlertDialogContentNoFocus.displayName = "AlertDialogContentNoFocus";
