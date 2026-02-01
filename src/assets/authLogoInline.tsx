/**
 * Parium logo as inline SVG component.
 * This eliminates network requests entirely, ensuring the logo
 * is available in the very first paint frame on the auth page.
 * 
 * The logo is embedded directly in the JavaScript bundle as JSX.
 */

interface AuthLogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export function AuthLogoInline({ className, width = 400, height = 160 }: AuthLogoProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 400 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Parium"
      role="img"
    >
      {/* Left ring */}
      <circle
        cx="65"
        cy="80"
        r="35"
        stroke="#3B9EFF"
        strokeWidth="8"
        fill="none"
      />
      {/* Right ring (overlapping) */}
      <circle
        cx="105"
        cy="80"
        r="35"
        stroke="#3B9EFF"
        strokeWidth="8"
        fill="none"
      />
      {/* Text "Parium" */}
      <text
        x="160"
        y="95"
        fill="white"
        fontSize="48"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fontWeight="300"
        letterSpacing="0.02em"
      >
        Parium
      </text>
    </svg>
  );
}

export default AuthLogoInline;
