/**
 * Parium auth logo with **0 network requests**.
 *
 * IMPORTANT:
 * - We import the ORIGINAL PNG as a data URI via `?inline`.
 * - We use an <img> element with the data URI directly for INSTANT paint
 *   on both mobile AND desktop. Background-image can have decode delays
 *   on desktop browsers that cause the logo to "flash in" after mount.
 * - The <img> with decode="sync" ensures the bitmap is ready before paint.
 * - onLoad callback signals when the bitmap is painted so we can hide splash.
 */

import { cn } from "@/lib/utils";
import authLogoDataUri from "./parium-auth-logo.png?inline";

interface AuthLogoProps {
  className?: string;
  /** Called when the image has loaded and is painted */
  onPainted?: () => void;
}

export function AuthLogoInline({ className, onPainted }: AuthLogoProps) {
  return (
    <img
      src={authLogoDataUri}
      alt="Parium"
      // decode="sync" forces the browser to decode before paint - eliminates flash
      decoding="sync"
      // Eager loading ensures immediate decode
      loading="eager"
      // High priority for LCP
      fetchPriority="high"
      onLoad={() => {
        // Signal that the React logo is now painted
        onPainted?.();
      }}
      className={cn(
        "block object-contain pointer-events-none transform-gpu select-none",
        className
      )}
      style={{
        // GPU compositing hint
        willChange: "transform",
        // Prevent any layout shift
        contentVisibility: "auto",
      }}
      draggable={false}
    />
  );
}

export default AuthLogoInline;
