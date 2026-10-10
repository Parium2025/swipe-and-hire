import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Header portraits become interactive only after their image has decoded. */
export function ReadyProfileAvatar({ src, accountId, profileReady, onClick }: {
  src: string | null;
  accountId: string | undefined;
  profileReady: boolean;
  onClick: () => void;
}) {
  const [image, setImage] = useState<{ accountId: string; src: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    setFailed(null);
    if (!src || !accountId) {
      setImage(null);
      return;
    }
    let cancelled = false;
    const probe = new Image();
    const fail = () => { if (!cancelled) setFailed(src); };
    const ready = () => {
      if (!cancelled && probe.naturalWidth > 0) setImage({ accountId, src });
    };
    probe.onerror = fail;
    probe.onload = () => {
      if (typeof probe.decode !== 'function') ready();
    };
    probe.src = src;
    if (typeof probe.decode === 'function') probe.decode().then(ready).catch(fail);
    else if (probe.complete) probe.naturalWidth > 0 ? ready() : fail();
    return () => { cancelled = true; probe.onload = null; probe.onerror = null; };
  }, [src, accountId]);

  const shown = src && image?.accountId === accountId ? image.src : null;
  const loading = !profileReady || (!!src && !shown && failed !== src);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 rounded-full bg-transparent p-0 disabled:opacity-100 hover:bg-transparent active:bg-transparent"
      onClick={onClick}
      disabled={loading}
      aria-busy={loading}
      aria-label="Min profil"
    >
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-glass-surface ring-2 ring-foreground/20">
        {loading ? (
          <span data-profile-avatar-skeleton className="h-full w-full animate-pulse bg-glass-surface motion-reduce:animate-none" aria-hidden="true" />
        ) : shown ? (
          <img src={shown} alt="Profil" className="h-full w-full object-cover" decoding="sync" loading="eager" onError={() => { setImage(null); setFailed(src); }} />
        ) : (
          <User className="h-4 w-4 text-foreground" aria-hidden="true" />
        )}
      </span>
    </Button>
  );
}