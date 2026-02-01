/**
 * Parium rings logo (nav) with **0 network requests**.
 *
 * Why:
 * - Background-image can decode async on desktop and cause a visible “pop-in”.
 * - An <img> with decoding="sync" reliably paints the first time it appears.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import ringsDataUri from "./parium-logo-rings.png?inline";

export type PariumLogoRingsInlineProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "src"
>;

export function PariumLogoRingsInline({
  className,
  alt = "Parium",
  decoding,
  loading,
  fetchPriority,
  draggable,
  ...rest
}: PariumLogoRingsInlineProps) {
  return (
    <img
      {...rest}
      src={ringsDataUri}
      alt={alt}
      decoding={decoding ?? "sync"}
      loading={loading ?? "eager"}
      fetchPriority={fetchPriority ?? "high"}
      draggable={draggable ?? false}
      className={cn(
        "block object-contain pointer-events-none transform-gpu select-none",
        className
      )}
      style={{
        willChange: "transform",
        ...(rest.style || {}),
      }}
    />
  );
}

export default PariumLogoRingsInline;
