import { useEffect, useState } from 'react';
import { Cookie, X } from 'lucide-react';

const STORAGE_KEY = 'parium-cookie-consent';
const CONSENT_VERSION = 2; // Höj om policyn ändras — då triggas ny fråga
const OPEN_EVENT = 'parium:open-cookie-settings';

export type CookieCategory = 'necessary' | 'analytics' | 'marketing' | 'preferences';

export type CookieConsent = {
  version: number;
  timestamp: string;
  necessary: true; // Alltid true — kan inte stängas av
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
};

/**
 * Läs sparat cookie-besked.
 * Returnerar `null` om användaren inte kvitterat rutan eller om versionen ändrats.
 */
export function getCookieConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsent;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Kolla om en kategori är godkänd.
 * Parium använder i dag enbart nödvändig lagring — statistik- och
 * marknadsföringscookies finns inte i tjänsten och returnerar därför alltid false.
 */
export function hasConsent(category: CookieCategory): boolean {
  return category === 'necessary';
}

/** Öppna rutan igen (används från footer-länken "Cookies"). */
export function openCookieSettings() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  // Initial visning: om rutan inte kvitterats, visa den.
  // Undantag: på /integritetspolicy — användaren ska kunna läsa i lugn och ro.
  useEffect(() => {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    if (path === '/integritetspolicy') return;
    const id = window.setTimeout(() => {
      if (getCookieConsent() === null) setVisible(true);
    }, 400);
    return () => window.clearTimeout(id);
  }, []);

  // Lyssna på "öppna igen"-event från footern
  useEffect(() => {
    const open = () => setVisible(true);
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  // Lås body-scroll när modalen är öppen
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    const root = document.documentElement;
    document.body.style.overflow = 'hidden';
    root.dataset.cookieBannerOpen = 'true';
    return () => {
      document.body.style.overflow = prev;
      delete root.dataset.cookieBannerOpen;
    };
  }, [visible]);

  const acknowledge = () => {
    const consent: CookieConsent = {
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      necessary: true,
      analytics: false,
      marketing: false,
      preferences: false,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
      window.dispatchEvent(
        new CustomEvent('parium:cookie-consent-updated', { detail: consent }),
      );
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  // Stäng med Escape → kvitterar rutan
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') acknowledge();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 animate-fade-in bg-black/70"
        style={{ zIndex: 2147483646 }}
        onClick={acknowledge}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-title"
        aria-describedby="cookie-desc"
        className="pointer-events-none fixed inset-0 flex items-center justify-center px-4 py-4 animate-fade-in"
        style={{
          zIndex: 2147483647,
          paddingTop: 'calc(env(safe-area-inset-top,0px) + 1rem)',
          paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 1rem)',
        }}
      >
        <div className="pointer-events-auto relative flex max-h-[calc(100svh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-2rem)] w-full max-w-[520px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0b1220]/95 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.95)]">
          <button
            type="button"
            onClick={acknowledge}
            aria-label="Stäng"
            className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full text-white transition hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl border border-secondary/30 bg-secondary/10 text-secondary">
                <Cookie className="h-6 w-6" />
              </span>

              <h2 id="cookie-title" className="mt-5 text-xl font-bold text-white sm:text-2xl">
                Om cookies på Parium
              </h2>

              <p
                id="cookie-desc"
                className="mt-3 max-w-[440px] text-[14px] leading-6 text-white sm:text-[15px]"
              >
                Vi använder bara nödvändig lagring — det som krävs för att du ska kunna logga
                in, för säkerhet och för att appen ska minnas dina inställningar i webbläsaren.
              </p>

              <p className="mt-3 max-w-[440px] text-[14px] leading-6 text-white sm:text-[15px]">
                Vi använder <strong>inga</strong> cookies för statistik, spårning eller
                marknadsföring, och delar inget med tredje part i reklamsyfte. Därför finns
                inget att välja bort — nödvändig lagring kräver inte ditt samtycke.{' '}
                <a
                  href="/integritetspolicy"
                  className="underline underline-offset-2 hover:text-secondary"
                >
                  Läs mer i vår integritetspolicy
                </a>
                .
              </p>

              <div className="mt-6 w-full">
                <button
                  type="button"
                  onClick={acknowledge}
                  className="min-h-[50px] w-full rounded-xl bg-secondary px-5 text-sm font-bold text-white shadow-[0_14px_35px_-16px_hsl(var(--secondary))] transition hover:-translate-y-0.5"
                >
                  Jag förstår
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default CookieBanner;
