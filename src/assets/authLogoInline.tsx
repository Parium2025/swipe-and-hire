/**
 * Parium auth logo component.
 * Uses Vite's `?inline` to force the PNG to be inlined as a data URI.
 * This keeps the logo pixel-perfect (identical to the original PNG)
 * while eliminating any network request/flicker on first paint.
 */
import authLogoDataUri from './parium-auth-logo.png?inline';

interface AuthLogoProps {
  className?: string;
}

export function AuthLogoInline({ className }: AuthLogoProps) {
  return (
    <img
      src={authLogoDataUri}
      alt="Parium"
      className={className}
      loading="eager"
      decoding="sync"
      fetchPriority="high"
      draggable={false}
    />
  );
}

export default AuthLogoInline;
