/**
 * Parium auth logo as INLINE SVG in the JS bundle.
 *
 * IMPORTANT:
 * - We embed the ORIGINAL PNG as a data URI inside an <svg><image/></svg>.
 *   This keeps it pixel-perfect (identical to the original logo), while still
 *   being an inline SVG component.
 * - Size is controlled by the SAME Tailwind classes already used in Auth*
 *   (h-*, w-auto, scale-*). The wrapper keeps <img>-like intrinsic sizing.
 */

import { cn } from "@/lib/utils";
import authLogoDataUri from "./parium-auth-logo.png?inline";

interface AuthLogoProps {
  className?: string;
}

// Original PNG is 1080x432 (2.5 aspect ratio)
const AUTH_LOGO_ASPECT = 1080 / 432;

export function AuthLogoInline({ className }: AuthLogoProps) {
  return (
    <div
      className={cn("block", className)}
      style={{ aspectRatio: String(AUTH_LOGO_ASPECT) }}
      aria-label="Parium"
      role="img"
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 1080 432"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <image
          href={authLogoDataUri}
          // Safari compatibility
          xlinkHref={authLogoDataUri as unknown as string}
          width="1080"
          height="432"
          preserveAspectRatio="xMidYMid meet"
        />
      </svg>
    </div>
  );
}

export default AuthLogoInline;
