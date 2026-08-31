/**
 * Parium auth logo with **0 network requests**.
 *
 * IMPORTANT:
 * - We reuse the ORIGINAL public PNG already preloaded by `index.html`.
 * - We render it as a background-image (same structure as the home logo)
 *   because browsers tend to cache/compose decoded bitmaps more reliably for
 *   <img>/CSS backgrounds than for <svg><image/>.
 * - Size is controlled by the SAME Tailwind classes already used in Auth*
 *   (h-*, w-auto, scale-*). The aspect-ratio wrapper keeps intrinsic sizing.
 */

import { cn } from "@/lib/utils";
import { AUTH_LOGO_URL } from "./authLogo";

interface AuthLogoProps {
  className?: string;
}

// Original PNG is 1080x432 (2.5 aspect ratio)
const AUTH_LOGO_ASPECT = 1080 / 432;

export function AuthLogoInline({ className }: AuthLogoProps) {
  return (
    <div
      className={cn(
        "block bg-contain bg-center bg-no-repeat pointer-events-none transform-gpu",
        className
      )}
      style={{
        aspectRatio: String(AUTH_LOGO_ASPECT),
        backgroundImage: `url(${AUTH_LOGO_URL})`,
        willChange: "transform",
      }}
      data-auth-logo="true"
      aria-label="Parium"
      role="img"
    />
  );
}

export default AuthLogoInline;
