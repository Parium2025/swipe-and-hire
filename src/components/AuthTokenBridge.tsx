import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { quarantineRuntimeAuthCredentials } from '@/lib/authBootstrapCredentials';

// This bridge detects Supabase auth/recovery tokens anywhere in the app
// and forwards them to /auth so the Auth page can handle the flow.

const AuthTokenBridge = ({ children }: { children?: ReactNode }) => {
  // Subscribe to every router location change, then quarantine credentials
  // synchronously before any descendant route can consume the one-time slot.
  useLocation();
  const target = quarantineRuntimeAuthCredentials(window.location.href);

  if (target) return <Navigate to={target} replace />;
  return <>{children ?? null}</>;
};

export default AuthTokenBridge;
