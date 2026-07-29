import { useEffect, useState } from 'react';
import { Cookie, ShieldCheck, BarChart3, Megaphone, Settings2, ArrowLeft, X } from 'lucide-react';

const STORAGE_KEY = 'parium-cookie-consent';
const CONSENT_VERSION = 1; // Höj om policyn ändras — då triggas ny fråga
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
 * Läs sparat cookie-samtycke.
 * Returnerar `null` om användaren inte tagit ställning eller om policy-versionen
 * har ändrats (då ska bannern visas på nytt).
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

/** Kolla snabbt om en specifik kategori är godkänd. */
export function hasConsent(category: CookieCategory): boolean {
  if (category === 'necessary') return true;
  const c = getCookieConsent();
  return !!c && c[category] === true;
}

/** Öppna bannern igen (används från footer-länken "Cookie-inställningar"). */
export function openCookieSettings() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

type Mode = 'summary' | 'customize';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<Mode>('summary');
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [preferences, setPreferences] = useState(false);

  // Initial visning: om inget val gjorts, visa banner.
  // Undantag: på /integritetspolicy vill vi INTE auto-öppna — användaren
  // ska kunna läsa policyn i lugn och ro innan de tar ställning.
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
      const existing = getCookieConsent();
      if (existing) {
        setAnalytics(existing.analytics);
        setMarketing(existing.marketing);
        setPreferences(existing.preferences);
      }
      setMode('summary');
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

  // Stäng med Escape → tolkas som "endast nödvändiga"
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') persist(false, false, false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const persist = (a: boolean, m: boolean, p: boolean) => {
    const consent: CookieConsent = {
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      necessary: true,
      analytics: a,
      marketing: m,
      preferences: p,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
      // Notifiera lyssnare (framtida analytics-init kan reagera direkt)
      window.dispatchEvent(
        new CustomEvent('parium:cookie-consent-updated', { detail: consent }),
      );
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 animate-fade-in bg-black/70"
        style={{ zIndex: 2147483646 }}
        onClick={() => persist(false, false, false)}
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
        <div className="pointer-events-auto relative flex max-h-[calc(100svh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-2rem)] w-full max-w-[560px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0b1220]/95 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.95)]">


          {/* Stäng-knapp — tolkas som "endast nödvändiga" om inget val gjorts,
              annars behåller den redan sparat val och stänger bara modalen. */}
          <button
            type="button"
            onClick={() => {
              const existing = getCookieConsent();
              if (existing) {
                setVisible(false);
              } else {
                persist(false, false, false);
              }
            }}
            aria-label="Stäng"
            className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full text-white transition hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>


          {mode === 'summary' ? (
            <SummaryView
              onAcceptAll={() => persist(true, true, true)}
              onNecessaryOnly={() => persist(false, false, false)}
              onCustomize={() => setMode('customize')}
            />
          ) : (
            <CustomizeView
              analytics={analytics}
              marketing={marketing}
              preferences={preferences}
              setAnalytics={setAnalytics}
              setMarketing={setMarketing}
              setPreferences={setPreferences}
              onBack={() => setMode('summary')}
              onAcceptAll={() => persist(true, true, true)}
              onSave={() => persist(analytics, marketing, preferences)}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────── Summary ───────────────────────────
function SummaryView({
  onAcceptAll,
  onNecessaryOnly,
  onCustomize,
}: {
  onAcceptAll: () => void;
  onNecessaryOnly: () => void;
  onCustomize: () => void;
}) {
  return (
    <div className="min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl border border-secondary/30 bg-secondary/10 text-secondary">
          <Cookie className="h-6 w-6" />
        </span>

        <h2 id="cookie-title" className="mt-5 text-xl font-bold text-white sm:text-2xl">
          Vi använder cookies
        </h2>

        <p
          id="cookie-desc"
          className="mt-3 max-w-[440px] text-[14px] leading-6 text-white sm:text-[15px]"
        >
          Parium använder cookies för att sidan ska fungera, komma ihåg dina val och
          hjälpa oss förbättra din upplevelse. Du bestämmer själv vad du accepterar.{' '}
          <a
            href="/integritetspolicy"
            className="underline underline-offset-2 hover:text-secondary"
          >
            Läs mer i vår integritetspolicy
          </a>
          .
        </p>

        <div className="mt-6 flex w-full flex-col gap-2.5">
          <button
            type="button"
            onClick={onAcceptAll}
            className="min-h-[50px] w-full rounded-xl bg-secondary px-5 text-sm font-bold text-white shadow-[0_14px_35px_-16px_hsl(var(--secondary))] transition hover:-translate-y-0.5"
          >
            Acceptera alla
          </button>
          <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3">
            <button
              type="button"
              onClick={onNecessaryOnly}
              className="min-h-[48px] flex-1 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Endast nödvändiga
            </button>
            <button
              type="button"
              onClick={onCustomize}
              className="min-h-[48px] flex-1 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white transition hover:bg-white/10 flex items-center justify-center gap-2"
            >
              <Settings2 className="h-4 w-4" />
              Anpassa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Customize ───────────────────────────
function CustomizeView({
  analytics,
  marketing,
  preferences,
  setAnalytics,
  setMarketing,
  setPreferences,
  onBack,
  onAcceptAll,
  onSave,
}: {
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
  setAnalytics: (v: boolean) => void;
  setMarketing: (v: boolean) => void;
  setPreferences: (v: boolean) => void;
  onBack: () => void;
  onAcceptAll: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-8">
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Tillbaka"
          className="grid h-9 w-9 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 id="cookie-title" className="text-lg font-bold text-white sm:text-xl">
          Cookie-inställningar
        </h2>
      </div>

      <div className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
        <Category
          icon={<ShieldCheck className="h-4 w-4" />}
          title="Nödvändiga"
          badge="Alltid aktiv"
          description="Krävs för att sidan ska fungera: inloggning, sessioner, säkerhet och grundläggande inställningar. Kan inte stängas av."
          checked
          disabled
        />
        <Category
          icon={<Settings2 className="h-4 w-4" />}
          title="Preferenser"
          description="Kommer ihåg dina val — språk, region och sparade filter — så du slipper göra om dem varje besök."
          checked={preferences}
          onChange={setPreferences}
        />
        <Category
          icon={<BarChart3 className="h-4 w-4" />}
          title="Statistik & analys"
          description="Anonymiserad data om hur sidan används så vi kan förbättra Parium. Används inte i dag — aktiveras först om du godkänner."
          checked={analytics}
          onChange={setAnalytics}
        />
        <Category
          icon={<Megaphone className="h-4 w-4" />}
          title="Marknadsföring"
          description="Låter oss visa mer relevanta annonser på andra sajter och mäta hur våra kampanjer fungerar."
          checked={marketing}
          onChange={setMarketing}
        />
      </div>

      <div className="mt-6 flex shrink-0 flex-col gap-2.5 sm:flex-row-reverse sm:gap-3">
        <button
          type="button"
          onClick={onAcceptAll}
          className="min-h-[48px] flex-1 rounded-xl bg-secondary px-5 text-sm font-bold text-white shadow-[0_14px_35px_-16px_hsl(var(--secondary))] transition hover:-translate-y-0.5"
        >
          Acceptera alla
        </button>
        <button
          type="button"
          onClick={onSave}
          className="min-h-[48px] flex-1 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Spara mina val
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────── Category row ───────────────────────────
function Category({
  icon,
  title,
  badge,
  description,
  checked,
  disabled,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-secondary/25 bg-secondary/10 text-secondary">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{title}</span>
            {badge ? (
              <span className="rounded-full border border-secondary/40 bg-secondary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary">
                {badge}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[13px] leading-5 text-white">{description}</p>
        </div>

        <Toggle checked={checked} disabled={disabled} onChange={onChange} label={title} />
      </div>
    </div>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative mt-1 inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full p-[2px] transition-colors duration-200 ease-out ${
        checked ? 'bg-secondary' : 'bg-white/20'
      } ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
    >
      {/* iPhone-style knob — helt innanför ramen, 2px inset på alla sidor */}
      <span
        className={`pointer-events-none block h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.35)] transition-transform duration-200 ease-out ${
          checked ? 'translate-x-[20px]' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default CookieBanner;
