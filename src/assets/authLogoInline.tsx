/**
 * Parium auth logo rendered as a **data URI** (base64) via Vite's `?inline`.
 *
 * Why: when navigating to /auth (logout → auth), the JS bundle is already in
 * memory, so the logo can paint with **zero network requests** and no pop-in.
 */

import authLogoDataUri from "@/assets/parium-auth-logo.png?inline";
import { cn } from "@/lib/utils";

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
        // Same structure as the home-logo button: background-image + contain.
        // Data URI (base64) => no request when switching routes.
        backgroundImage: `url(${authLogoDataUri})`,
        willChange: "transform",
      }}
      data-auth-logo="true"
      aria-label="Parium"
      role="img"
    />
  );
}

export default AuthLogoInline;
