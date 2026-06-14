import { useEffect, useState } from 'react';

const STORAGE_KEY = 'parium-cookie-consent-v1';

/**
 * Enkel cookie-banner. Visas tills användaren accepterar (sparas i localStorage).
 * Visas inte i appen — bara på publika rutter (logiken styrs av AppShell).
 */
const CookieBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const accepted = localStorage.getItem(STORAGE_KEY);
      if (!accepted) {
        // Kort fördröjning så att bannern inte poppar in på första frame
        const t = setTimeout(() => setVisible(true), 600);
        return () => clearTimeout(t);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: true, at: Date.now() }));
    } catch {
      /* noop */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookies"
      className="fixed inset-x-0 bottom-0 z-[1000] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 sm:px-6"
      style={{ pointerEvents: 'none' }}
    >
      <div
        className="mx-auto flex max-w-[640px] flex-col items-center gap-3 rounded-2xl border border-white/15 bg-[#001935]/95 px-5 py-4 text-white shadow-2xl backdrop-blur-md sm:flex-row sm:gap-4 sm:px-6"
        style={{ pointerEvents: 'auto' }}
      >
        <p className="flex-1 text-center text-sm leading-6 text-white/85 sm:text-left">
          Vi använder cookies för att Parium ska fungera och för att förbättra din upplevelse.
        </p>
        <button
          type="button"
          onPointerDown={accept}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-[#001935] shadow-md transition-transform active:scale-[0.97] sm:w-auto"
        >
          Acceptera alla
        </button>
      </div>
    </div>
  );
};

export default CookieBanner;
