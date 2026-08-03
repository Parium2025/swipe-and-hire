import { useEffect, useRef, useState } from 'react';
import { getCompanyInitials } from '@/lib/companyInitials';
import { fetchPriority } from '@/lib/fetchPriority';

interface CompanyLogoAvatarProps {
  logoUrl?: string | null;
  companyName: string;
  className?: string;
}

/**
 * Företagslogga i jobbannonsen.
 *
 * Initialerna ligger ALLTID i botten. Loggan tonar in ovanpå så fort den är
 * laddad — och försvinner igen om den fallerar. Ingen "Bilden kunde inte
 * laddas"-text får någonsin klämmas in i den lilla cirkeln.
 */
const loadedLogoUrls = new Set<string>();

export function CompanyLogoAvatar({ logoUrl, companyName, className }: CompanyLogoAvatarProps) {
  // Om loggan redan laddats någon gång i sessionen ska den visas direkt —
  // ingen intoning, ingen "laddning" varje gång man går in i ett jobb.
  const [loaded, setLoaded] = useState(() => !!logoUrl && loadedLogoUrls.has(logoUrl));
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoaded(!!logoUrl && loadedLogoUrls.has(logoUrl));
    setAttempt(0);
    setFailed(false);
  }, [logoUrl]);

  // Städa upp eventuell väntande återförsökstimer vid unmount.
  useEffect(() => () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
  }, []);

  // Nätverket tillbaka / flik i fokus → försök igen tyst.
  useEffect(() => {
    if (!failed) return;
    const retry = () => {
      setAttempt(0);
      setFailed(false);
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') retry();
    };
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [failed]);

  const src = logoUrl && !failed
    ? attempt > 0
      ? `${logoUrl}${logoUrl.includes('?') ? '&' : '?'}_r=${attempt}`
      : logoUrl
    : null;

  return (
    <div
      className={
        className ??
        'relative h-14 w-14 shrink-0 rounded-full overflow-hidden bg-white/20 ring-2 ring-white/20 flex items-center justify-center active:scale-95 transition-transform'
      }
    >
      <span className="text-white font-semibold text-sm select-none">
        {getCompanyInitials(companyName)}
      </span>

      {src && (
        <img
          src={src}
          alt={`${companyName} logotyp`}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          loading="eager"
          {...fetchPriority('high')}
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (attempt < 2) {
              const delays = [600, 1800];
              retryTimer.current = setTimeout(() => setAttempt((a) => a + 1), delays[attempt]);
            } else {
              setFailed(true);
            }
          }}
        />
      )}
    </div>
  );
}

export default CompanyLogoAvatar;
