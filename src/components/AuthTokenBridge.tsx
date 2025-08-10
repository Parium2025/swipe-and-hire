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

    // Hash tokens
    const accessTokenHash = hash.get('access_token');
    const refreshTokenHash = hash.get('refresh_token');
    const typeHash = hash.get('type');
    const tokenParamHash = hash.get('token');
    const tokenHashParamHash = hash.get('token_hash');
    const errorCodeHash = hash.get('error_code') || hash.get('error');
    const errorDescHash = hash.get('error_description') || hash.get('error_message');

    // Query tokens
    const accessTokenQP = searchParams.get('access_token');
    const refreshTokenQP = searchParams.get('refresh_token');
    const typeQP = searchParams.get('type');
    const tokenParamQP = searchParams.get('token');
    const tokenHashParamQP = searchParams.get('token_hash');
    const errorCodeQP = searchParams.get('error_code') || searchParams.get('error');
    const errorDescQP = searchParams.get('error_description') || searchParams.get('error_message');

    const hasAccessPair = !!((accessTokenHash || accessTokenQP) && (refreshTokenHash || refreshTokenQP));
    const hasTokenParams = !!(
      tokenParamHash ||
      tokenHashParamHash ||
      tokenParamQP ||
      tokenHashParamQP
    );

    const hasError = !!(errorCodeHash || errorDescHash || errorCodeQP || errorDescQP);
    const isRecoveryType = (typeHash || typeQP) === 'recovery';

    if (hasAccessPair || hasTokenParams || hasError || isRecoveryType) {
      const target = new URL('/auth', window.location.origin);

      // Preserve error messages if present
      const chosenErrorCode = errorCodeHash || errorCodeQP;
      const chosenErrorDesc = errorDescHash || errorDescQP;
      if (chosenErrorCode) target.searchParams.set('error_code', chosenErrorCode);
      if (chosenErrorDesc) target.searchParams.set('error_description', chosenErrorDesc);

      // Preserve token/token_hash via query
      const chosenTokenHash = tokenHashParamHash || tokenHashParamQP;
      const chosenToken = tokenParamHash || tokenParamQP;
      if (chosenTokenHash) target.searchParams.set('token_hash', chosenTokenHash);
      if (chosenToken) target.searchParams.set('token', chosenToken);

      // Preserve type if present
      const finalType = typeHash || typeQP || (hasAccessPair ? 'recovery' : undefined);
      if (finalType) target.searchParams.set('type', finalType);

      // If we have access/refresh, keep them in hash on the new URL
      const finalAccess = accessTokenHash || accessTokenQP;
      const finalRefresh = refreshTokenHash || refreshTokenQP;
      if (finalAccess && finalRefresh) {
        const newHash = new URLSearchParams();
        newHash.set('access_token', finalAccess);
        newHash.set('refresh_token', finalRefresh);
        if (finalType) newHash.set('type', finalType);
        target.hash = newHash.toString();
      }

      window.location.replace(target.toString());
    }
  }, [location.pathname]);

  return null;
};

export default AuthTokenBridge;
