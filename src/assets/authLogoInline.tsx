/**
 * Parium auth logo as INLINE SVG.
 * - 0 network requests (also in dev)
 * - Size is controlled by the SAME Tailwind classes already used in Auth*
 *   (we keep the wrapper element so h-* + w-auto behaves like an <img>).
 */

import { cn } from "@/lib/utils";

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
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Rings (use design tokens, not hard-coded colors) */}
        <g stroke={`hsl(var(--primary))`} strokeWidth="26" fill="none" opacity="0.95">
          <circle cx="220" cy="216" r="108" />
          <circle cx="350" cy="216" r="108" />
        </g>

        {/* Wordmark */}
        <text
          x="470"
          y="264"
          fill={`hsl(var(--foreground))`}
          fontSize="150"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontWeight="300"
          letterSpacing="0.01em"
        >
          Parium
        </text>
      </svg>
    </div>
  );
}

export default AuthLogoInline;
