/**
 * Parium logo as inline SVG component.
 * This eliminates network requests entirely, ensuring the logo
 * is available in the very first paint frame on the auth page.
 * 
 * The logo is embedded directly in the JavaScript bundle as JSX.
 * ViewBox matches the original PNG dimensions for pixel-perfect sizing.
 */

interface AuthLogoProps {
  className?: string;
}

export function AuthLogoInline({ className }: AuthLogoProps) {
  return (
    <svg
      viewBox="0 0 1080 432"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Parium"
      role="img"
      style={{ display: 'block' }}
    >
      {/* Left ring */}
      <circle
        cx="175"
        cy="216"
        r="95"
        stroke="#3B9EFF"
        strokeWidth="22"
        fill="none"
      />
      {/* Right ring (overlapping) */}
      <circle
        cx="285"
        cy="216"
        r="95"
        stroke="#3B9EFF"
        strokeWidth="22"
        fill="none"
      />
      {/* Text "Parium" */}
      <text
        x="420"
        y="248"
        fill="white"
        fontSize="130"
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
