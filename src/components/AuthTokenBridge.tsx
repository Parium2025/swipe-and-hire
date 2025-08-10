import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// This bridge detects Supabase auth/recovery tokens anywhere in the app
// and forwards them to /auth so the Auth page can handle the flow.
const AuthTokenBridge = () => {
  const location = useLocation();

  useEffect(() => {
    // Avoid loops if we are already on /auth
    if (location.pathname === '/auth') return;

    const searchParams = new URLSearchParams(window.location.search);
    const hashStr = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : '';
    const hash = new URLSearchParams(hashStr);

    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    const typeHash = hash.get('type');
    const tokenParamHash = hash.get('token');
    const tokenHashParamHash = hash.get('token_hash');

    const tokenParamQP = searchParams.get('token');
    const tokenHashParamQP = searchParams.get('token_hash');
    const typeQP = searchParams.get('type');

    const hasAccessPair = !!(accessToken && refreshToken);
    const hasTokenParams = !!(
      tokenParamHash ||
      tokenHashParamHash ||
      tokenParamQP ||
      tokenHashParamQP
    );

    const isRecoveryType = (typeHash || typeQP) === 'recovery';

    if (hasAccessPair || hasTokenParams || isRecoveryType) {
      const target = new URL('/auth', window.location.origin);

      // Preserve token/token_hash via query
      const chosenTokenHash = tokenHashParamHash || tokenHashParamQP;
      const chosenToken = tokenParamHash || tokenParamQP;
      if (chosenTokenHash) target.searchParams.set('token_hash', chosenTokenHash);
      if (chosenToken) target.searchParams.set('token', chosenToken);

      // Preserve type if present
      const finalType = typeHash || typeQP || (hasAccessPair ? 'recovery' : undefined);
      if (finalType) target.searchParams.set('type', finalType);

      // If we have access/refresh in hash, keep them in hash on the new URL
      if (hasAccessPair) {
        const newHash = new URLSearchParams();
        newHash.set('access_token', accessToken!);
        newHash.set('refresh_token', refreshToken!);
        if (finalType) newHash.set('type', finalType);
        target.hash = newHash.toString();
      }

      // Use replace to avoid back button returning to an invalid state
      window.location.replace(target.toString());
    }
  }, [location.pathname]);

  return null;
};

export default AuthTokenBridge;
