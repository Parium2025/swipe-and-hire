import { useEffect, useState } from 'react';

/** Only publish decoded media belonging to the current source/account. */
export function useReadyProfileImage(src: string | null, accountId: string | undefined, profileReady: boolean) {
  const [result, setResult] = useState<{ accountId: string; src: string; ready: boolean } | null>(null);
  useEffect(() => {
    if (!src || !accountId || !profileReady) return;
    let cancelled = false;
    const probe = new Image();
    const complete = (ready: boolean) => {
      if (!cancelled) setResult({ accountId, src, ready });
    };
    const ready = () => complete(probe.naturalWidth > 0);
    probe.onerror = () => complete(false);
    probe.onload = () => { if (typeof probe.decode !== 'function') ready(); };
    probe.src = src;
    if (typeof probe.decode === 'function') probe.decode().then(ready).catch(() => complete(false));
    else if (probe.complete) ready();
    return () => { cancelled = true; probe.onload = null; probe.onerror = null; };
  }, [src, accountId, profileReady]);
  const current = profileReady && !!accountId && result?.accountId === accountId && result?.src === src;
  return {
    shown: current && result?.ready ? src : null,
    loading: !accountId || !profileReady || (!!src && !current),
    invalidate: () => setResult(null),
  };
}