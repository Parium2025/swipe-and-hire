import { useEffect, useState } from 'react';
import { Cookie } from 'lucide-react';

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
    <>
      {/* Backdrop — dimmar bakgrunden men blockerar inte scroll */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[59] bg-black/55 backdrop-blur-[2px] animate-fade-in"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-live="polite"
        aria-labelledby="cookie-title"
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in"
      >
        <div className="relative w-full max-w-[520px] overflow-hidden rounded-3xl border border-white/12 bg-[#0b1220]/98 p-6 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:p-8">
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-secondary/70 to-transparent" />

          <div className="flex flex-col items-center text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-secondary/30 bg-secondary/10 text-secondary">
              <Cookie className="h-6 w-6" />
            </span>

            <h2
              id="cookie-title"
              className="mt-5 text-xl font-bold text-white sm:text-2xl"
            >
              Vi använder cookies
            </h2>

            <p className="mt-3 max-w-[420px] text-[14px] leading-6 text-white sm:text-[15px]">
              Parium använder cookies för att sidan ska fungera, komma ihåg dina val och
              hjälpa oss förbättra din upplevelse. Du bestämmer själv vad du accepterar.{' '}
              <a
                href="/om-oss#integritet"
                className="underline underline-offset-2 hover:text-secondary"
              >
                Läs mer
              </a>
              .
            </p>

            <div className="mt-6 flex w-full flex-col gap-2.5 sm:flex-row sm:gap-3">
              <button
                type="button"
                onClick={() => setConsent('necessary_only')}
                className="min-h-[48px] flex-1 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Endast nödvändiga
              </button>
              <button
                type="button"
                onClick={() => setConsent('accepted')}
                className="min-h-[48px] flex-1 rounded-xl bg-secondary px-5 text-sm font-bold text-white shadow-[0_14px_35px_-16px_hsl(var(--secondary))] transition hover:-translate-y-0.5"
              >
                Acceptera alla
              </button>
            </div>

            <button
              type="button"
              onClick={() => setConsent('necessary_only')}
              className="mt-3 text-xs text-white/50 underline underline-offset-2 hover:text-white/80"
            >
              Stäng
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default CookieBanner;
