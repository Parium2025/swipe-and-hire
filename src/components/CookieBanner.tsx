import { useEffect, useState } from 'react';
import { Cookie, X, ChevronDown } from 'lucide-react';

const STORAGE_KEY = 'parium-cookie-consent';
const CONSENT_VERSION = 3; // Höj om policyn ändras — då triggas ny fråga
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
 * Läs sparat cookie-val.
 * Returnerar `null` om användaren inte svarat eller om versionen ändrats.
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
 * Nödvändig lagring är alltid tillåten. Övriga kategorier styrs av
 * användarens val — Parium använder dem inte i dag, men valet respekteras
 * automatiskt den dag en sådan cookie införs.
 */
export function hasConsent(category: CookieCategory): boolean {
  if (category === 'necessary') return true;
  const consent = getCookieConsent();
  if (!consent) return false;
  return consent[category] === true;
}

/** Öppna rutan igen (används från footer-länken "Cookies"). */
export function openCookieSettings() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

type Choices = { analytics: boolean; marketing: boolean; preferences: boolean };

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [choices, setChoices] = useState<Choices>({
    analytics: false,
    marketing: false,
    preferences: false,
  });

  // Initial visning: om användaren inte svarat, visa rutan.
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
    const open = () => {
      const saved = getCookieConsent();
      if (saved) {
        setChoices({
          analytics: saved.analytics,
          marketing: saved.marketing,
          preferences: saved.preferences,
        });
      }
      setVisible(true);
    };
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

  const save = (next: Choices) => {
    const consent: CookieConsent = {
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      necessary: true,
      ...next,
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
    setCustomizing(false);
  };

  const acceptAll = () => save({ analytics: true, marketing: true, preferences: true });
  const onlyNecessary = () => save({ analytics: false, marketing: false, preferences: false });

  // Stäng med Escape → sparar "endast nödvändiga"
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onlyNecessary();
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
        onClick={onlyNecessary}
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
            onClick={onlyNecessary}
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
                Cookies på Parium
              </h2>

              <p
                id="cookie-desc"
                className="mt-3 max-w-[440px] text-[14px] leading-6 text-white sm:text-[15px]"
              >
                Vi använder nödvändig lagring för inloggning, säkerhet och dina inställningar.
                Den kräver inget samtycke. Övriga kategorier är avstängda i dag — väljer du att
                tillåta dem gäller ditt val automatiskt om vi inför dem i framtiden.{' '}
                <a
                  href="/integritetspolicy"
                  className="underline underline-offset-2 hover:text-secondary"
                >
                  Läs mer i vår integritetspolicy
                </a>
                .
              </p>

              <button
                type="button"
                onClick={() => setCustomizing((v) => !v)}
                aria-expanded={customizing}
                className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-white underline underline-offset-4 transition hover:text-secondary"
              >
                Anpassa mina cookies
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${customizing ? 'rotate-180' : ''}`}
                />
              </button>

              {customizing && (
                <div className="mt-4 w-full space-y-2 text-left">
                  <CategoryRow
                    title="Nödvändiga"
                    desc="Inloggning, säkerhet och grundläggande funktioner. Kan inte stängas av."
                    checked
                    locked
                  />
                  <CategoryRow
                    title="Funktion och inställningar"
                    desc="Kommer ihåg dina filter och val i appen. Används inte i dag."
                    checked={choices.preferences}
                    onChange={(v) => setChoices((c) => ({ ...c, preferences: v }))}
                  />
                  <CategoryRow
                    title="Statistik"
                    desc="Anonym besöksstatistik för att förbättra tjänsten. Används inte i dag."
                    checked={choices.analytics}
                    onChange={(v) => setChoices((c) => ({ ...c, analytics: v }))}
                  />
                  <CategoryRow
                    title="Marknadsföring"
                    desc="Annonsering och spårning. Används inte i dag."
                    checked={choices.marketing}
                    onChange={(v) => setChoices((c) => ({ ...c, marketing: v }))}
                  />
                </div>
              )}

              <div className="mt-6 flex w-full flex-col gap-2">
                <button
                  type="button"
                  onClick={acceptAll}
                  className="min-h-[50px] w-full rounded-xl bg-secondary px-5 text-sm font-bold text-white shadow-[0_14px_35px_-16px_hsl(var(--secondary))] transition hover:-translate-y-0.5"
                >
                  Acceptera alla
                </button>
                {customizing ? (
                  <button
                    type="button"
                    onClick={() => save(choices)}
                    className="min-h-[50px] w-full rounded-xl border border-white/20 bg-white/5 px-5 text-sm font-bold text-white transition hover:bg-white/10"
                  >
                    Spara mina val
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onlyNecessary}
                    className="min-h-[50px] w-full rounded-xl border border-white/20 bg-white/5 px-5 text-sm font-bold text-white transition hover:bg-white/10"
                  >
                    Endast nödvändiga
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function CategoryRow({
  title,
  desc,
  checked,
  onChange,
  locked = false,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  locked?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-[12px] leading-5 text-white/90">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={locked}
        onClick={() => onChange?.(!checked)}
        className={`mt-0.5 h-6 w-11 shrink-0 rounded-full border transition ${
          checked ? 'border-secondary bg-secondary' : 'border-white/25 bg-white/10'
        } ${locked ? 'opacity-60' : ''}`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
          }`}
        />
      </button>
    </div>
  );
}

export default CookieBanner;
