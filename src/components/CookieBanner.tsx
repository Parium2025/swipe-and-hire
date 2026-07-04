import { useEffect, useState } from 'react';
import { Cookie, X } from 'lucide-react';

const STORAGE_KEY = 'parium-cookie-consent';

type Consent = 'accepted' | 'necessary_only';

/**
 * Enkel, GDPR-säker cookie-banner.
 * - Visas endast om användaren inte redan tagit ställning.
 * - Sparar val i localStorage (persistent över sessioner).
 * - "Endast nödvändiga" är default — inga tredjepartsspårare aktiveras
 *   utan explicit "Acceptera alla".
 * - Framtida analytics-integrationer (t.ex. GA4) kan läsa flaggan
 *   via `getCookieConsent()` innan de laddas.
 */
export function getCookieConsent(): Consent | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'accepted' || v === 'necessary_only' ? v : null;
  } catch {
    return null;
  }
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Vänta en tick så banner inte flashar under första renderpassen.
    const id = window.setTimeout(() => {
      if (getCookieConsent() === null) setVisible(true);
    }, 400);
    return () => window.clearTimeout(id);
  }, []);

  const setConsent = (value: Consent) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie-inställningar"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-[720px] animate-fade-in sm:inset-x-4 sm:bottom-4"
    >
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220]/95 p-4 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-5">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-secondary/60 to-transparent" />

        <button
          type="button"
          onClick={() => setConsent('necessary_only')}
          aria-label="Stäng"
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col gap-4 pr-6 sm:flex-row sm:items-center sm:gap-5">
          <div className="flex items-start gap-3 sm:flex-1">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-secondary/30 bg-secondary/10 text-secondary">
              <Cookie className="h-5 w-5" />
            </span>
            <p className="text-[13.5px] leading-6 text-white sm:text-sm">
              Vi använder cookies för att Parium ska fungera och för att förbättra din
              upplevelse.{' '}
              <a
                href="/om-oss#integritet"
                className="underline underline-offset-2 hover:text-secondary"
              >
                Läs mer
              </a>
              .
            </p>
          </div>

          <div className="flex shrink-0 gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setConsent('necessary_only')}
              className="min-h-[44px] rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Endast nödvändiga
            </button>
            <button
              type="button"
              onClick={() => setConsent('accepted')}
              className="min-h-[44px] rounded-xl bg-secondary px-5 text-sm font-bold text-white shadow-[0_14px_35px_-16px_hsl(var(--secondary))] transition hover:-translate-y-0.5"
            >
              Acceptera
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CookieBanner;
