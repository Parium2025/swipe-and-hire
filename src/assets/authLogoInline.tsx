/**
 * Parium auth logo component.
 * Uses an ES6 import which Vite bundles directly into the JS.
 * This eliminates the network waterfall issue by having the image
 * available immediately when the component mounts.
 */
import authLogo from './parium-auth-logo.png';

interface AuthLogoProps {
  className?: string;
}

export function AuthLogoInline({ className }: AuthLogoProps) {
  return (
    <img
      src={authLogo}
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
