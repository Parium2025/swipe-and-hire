/**
 * Parium auth logo.
 *
 * CRITICAL: Must use the SAME URL as index.html + bootstrap pre-decode,
 * otherwise the logo can still "load" even though we preloaded/decoded.
 */

import { AUTH_LOGO_URL } from "@/lib/criticalAssets";
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
        // Uses the preloaded/decoded URL so it can paint instantly.
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
