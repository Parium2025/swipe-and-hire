import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  X, Check, Building, FileText, User, Heart, MessageCircle, Eye,
  CreditCard, HelpCircle, ArrowRight,
} from 'lucide-react';
import { useDevice } from '@/hooks/use-device';
import { useAuth } from '@/hooks/useAuth';
import { loadCoachState, saveCoachState, type CoachState } from '@/lib/onboardingState';



/**
 * 🎓 PAGE INTRO COACH
 *
 * Diskret, premium "första gången här"-kort som förklarar vad sidan gör och
 * vad nästa naturliga steg är. Visas en gång per sida (sparas lokalt), kan
 * alltid stängas och kan alltid tas fram igen via Support → "Hjälp & tips".
 *
 * Kortet är alltid centrerat på skärmen — samma placering överallt.
 */

const STORAGE_PREFIX = 'parium_page_coach_v1_';
const ACTIVE_TOUR_KEY = 'parium_page_coach_active';
/** Hårdstopp: när guiden avslutats visas INGA sidtips förrän man startar om den. */
const COACH_DISABLED_KEY = 'parium_page_coach_disabled';
/** Speglar WELCOME_CARD_REPLAY_EVENT i AppOnboardingTour (undviker cirkulär import). */
const WELCOME_CARD_REPLAY_EVENT_NAME = 'parium:welcome-card-replay';

const TOUR_PATHS = [
  '/search-jobs',
  '/saved-jobs',
  '/my-applications',
  '/messages',
  '/profile',
  '/profile-preview',
  '/subscription',
  '/support',
] as const;

/** Event som öppnar tipset för nuvarande sida igen. */
export const PAGE_COACH_REPLAY_EVENT = 'parium:page-coach-replay';

/** Läser av nuvarande status ur localStorage (snabb cache). */
function readLocalCoachState(): CoachState {
  const seen: Record<string, boolean> = {};
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(STORAGE_PREFIX))
      .forEach((k) => {
        if (localStorage.getItem(k) === '1') seen[k.slice(STORAGE_PREFIX.length)] = true;
      });
    return { seen, disabled: localStorage.getItem(COACH_DISABLED_KEY) === '1' };
  } catch {
    return { seen, disabled: false };
  }
}

/** Skriver molnstatus till localStorage (cachen). */
function writeLocalCoachState(state: CoachState) {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(STORAGE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
    Object.entries(state.seen ?? {}).forEach(([key, value]) => {
      if (value) localStorage.setItem(STORAGE_PREFIX + key, '1');
    });
    if (state.disabled) localStorage.setItem(COACH_DISABLED_KEY, '1');
    else localStorage.removeItem(COACH_DISABLED_KEY);
  } catch {
    /* ignorera */
  }
}

/** Speglar aktuell lokal status till kontot så den följer med mellan enheter. */
function syncCoachStateToCloud() {
  void saveCoachState(readLocalCoachState());
}

export function resetPageCoachMarks() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(STORAGE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem(COACH_DISABLED_KEY);
  } catch {
    /* ignorera */
  }
  syncCoachStateToCloud();
}

/** Är guiden avstängd? Hårdstopp som gäller alla sidor. */
function isCoachDisabled(): boolean {
  try {
    return localStorage.getItem(COACH_DISABLED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Markera samtliga sidtips som sedda — används när guiden avslutas. */
export function markAllPageCoachesSeen() {
  try {
    Object.values(CONFIGS).forEach((c) => localStorage.setItem(STORAGE_PREFIX + c.key, '1'));
    localStorage.setItem(COACH_DISABLED_KEY, '1');
    localStorage.removeItem(ACTIVE_TOUR_KEY);
  } catch {
    /* ignorera */
  }
  syncCoachStateToCloud();
}

/** Starta den sammanhängande guiden från den valda sidan. */
export function startPageCoachTour(path: string) {
  resetPageCoachMarks();
  try {
    localStorage.setItem(ACTIVE_TOUR_KEY, path);
  } catch {
    /* ignorera */
  }
}

/** Nollställ och visa tipset för sidan man står på just nu. */
export function replayPageCoach() {
  resetPageCoachMarks();
  window.dispatchEvent(new CustomEvent(PAGE_COACH_REPLAY_EVENT));
}




interface CoachConfig {
  key: string;
  icon: typeof Building;
  title: string;
  lines: (isTouch: boolean) => string[];
  cta?: { label: string; path: string };
}

const CONFIGS: Record<string, CoachConfig> = {
  '/search-jobs': {
    key: 'search-jobs',
    icon: Building,
    title: 'Så hittar du rätt jobb',
    lines: (isTouch) => [
      'Sök på yrke, företag eller ort — eller filtrera på plats, yrkesområde, anställning och lön.',
      'Knapparna 12 tim, 24 tim, 3 dagar och 7 dagar visar hur nyligen jobben publicerades.',
      isTouch
        ? 'Tryck på ett kort för att öppna hela annonsen. Hjärtat sparar jobbet till senare.'
        : 'Klicka på ett kort för att öppna hela annonsen. Hjärtat sparar jobbet till senare.',
      isTouch
        ? 'Högst upp finns Swipe-läget: svep höger för att spara ett jobb och vänster för att hoppa över det.'
        : 'På mobil och surfplatta finns även ett Swipe-läge högst upp — svep höger för att spara, vänster för att hoppa över.',
      'I annonsen kan du trycka på företagsnamnet för att se företagsprofilen med info och recensioner från andra.',
      'När du trycker "Ansök" skickas din profil till arbetsgivaren: namn, kontaktuppgifter, bild, presentation, CV och video om du laddat upp det. Har arbetsgivaren egna frågor behöver du svara på dem för att kunna skicka in. Inget delas innan du själv ansöker.',
    ],
    cta: { label: 'Visa sparade jobb', path: '/saved-jobs' },
  },
  '/my-applications': {
    key: 'my-applications',
    icon: FileText,
    title: 'Här landar dina ansökningar',
    lines: () => [
      'Under granskning = arbetsgivaren har din ansökan. Du får en notis så fort något händer.',
      'Utgångna = annonsen har stängt. Ansökan finns kvar i din historik.',
      'Tomt just nu? Helt normalt — nästa steg är att söka ditt första jobb.',
    ],
    cta: { label: 'Sök ditt första jobb', path: '/search-jobs' },
  },
  '/saved-jobs': {
    key: 'saved-jobs',
    icon: Heart,
    title: 'Dina sparade jobb',
    lines: () => [
      'Allt du sparat samlas här tills annonsen stänger.',
      'Fliken Skippade visar jobb du svept förbi i Swipe-läget — ångrar du dig hittar du dem där.',
      'Öppna ett jobb när du har tid och skicka in ansökan i lugn och ro.',
    ],
    cta: { label: 'Tillbaka till Sök jobb', path: '/search-jobs' },
  },

  '/profile': {
    key: 'profile',
    icon: User,
    title: 'Din profil',
    lines: () => [
      'Bild, presentation, CV och video — allt kan ändras eller raderas när du vill.',
      'Profiler med bild och en kort presentation får betydligt fler svar.',
    ],
    cta: { label: 'Gå till Sök jobb', path: '/search-jobs' },
  },
  '/profile-preview': {
    key: 'profile-preview',
    icon: Eye,
    title: 'Så ser arbetsgivaren dig',
    lines: () => [
      'Det här är den vy arbetsgivaren möts av när du har sökt ett jobb.',
      'Växla mellan Mobilvy och Datorvy för att se båda varianterna.',
      'Saknas något? Gå till Min profil och komplettera bild, presentation, CV eller video.',
    ],
    cta: { label: 'Redigera Min profil', path: '/profile' },
  },
  '/messages': {
    key: 'messages',
    icon: MessageCircle,
    title: 'Dina chattar',
    lines: () => [
      'När en arbetsgivare svarar på din ansökan hamnar chatten här.',
      'Du får en notis direkt — inget viktigt försvinner.',
      'Tomt nu? Chattar kan startas av arbetsgivaren efter att du har sökt ett jobb.',
    ],
    cta: { label: 'Se dina ansökningar', path: '/my-applications' },
  },
  '/subscription': {
    key: 'subscription',
    icon: CreditCard,
    title: 'Din ekonomi',
    lines: () => [
      'Här ser du din plan och dina kvitton samlade på ett ställe.',
      'Att söka jobb är alltid gratis. Premium är frivilligt och kan avslutas när du vill.',
    ],
  },
  '/support': {
    key: 'support',
    icon: HelpCircle,
    title: 'Hjälp när du behöver den',
    lines: () => [
      'Här hittar du guider, vanliga frågor och kontakt med kundtjänst.',
      'Under Hjälp & tips kan du alltid starta om hela den här genomgången från början.',
    ],
  },
};

const PageIntroCoach = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const device = useDevice();
  const isTouch = device !== 'desktop';
  const [replayToken, setReplayToken] = useState(0);
  const [visible, setVisible] = useState(false);
  /** Vänta tills kontots status hämtats – annars kan fel person få guiden på delad dator. */
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const local = readLocalCoachState();
        const cloud = await loadCoachState();
        if (cancelled) return;
        // Slå ihop lokalt och moln — ett tips som setts på någon enhet visas aldrig igen.
        const merged: CoachState = {
          seen: { ...(local.seen ?? {}), ...(cloud?.seen ?? {}) },
          disabled: Boolean(local.disabled || cloud?.disabled),
        };
        writeLocalCoachState(merged);
        const cloudSeenCount = Object.keys(cloud?.seen ?? {}).length;
        const mergedSeenCount = Object.keys(merged.seen ?? {}).length;
        if (!cloud || cloudSeenCount !== mergedSeenCount || cloud.disabled !== merged.disabled) {
          void saveCoachState(merged);
        }

      } catch {
        /* offline – kör på lokal cache */
      } finally {
        if (!cancelled) {
          setHydrated(true);
          setReplayToken((t) => t + 1);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const config = useMemo(() => CONFIGS[location.pathname], [location.pathname]);
  const activeTourPath = useMemo(() => {
    try {
      return localStorage.getItem(ACTIVE_TOUR_KEY);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, replayToken]);
  const isGuidedTour = activeTourPath === location.pathname;

  const alreadySeen = useMemo(() => {
    if (!config) return true;
    if (!hydrated) return true;
    if (isCoachDisabled()) return true;
    try {
      return !isGuidedTour && localStorage.getItem(STORAGE_PREFIX + config.key) === '1';
    } catch {
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, replayToken, isGuidedTour, hydrated]);

  useEffect(() => {
    const onReplay = () => setReplayToken((t) => t + 1);
    window.addEventListener(PAGE_COACH_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(PAGE_COACH_REPLAY_EVENT, onReplay);
  }, []);


  useEffect(() => {
    if (!config || alreadySeen) {
      setVisible(false);
      return;
    }
    const id = window.setTimeout(() => setVisible(true), 400);
    return () => window.clearTimeout(id);
  }, [config, alreadySeen]);

  const dismiss = useCallback(
    (path?: string, continueTour = false) => {
      if (!config) return;
      try {
        localStorage.setItem(STORAGE_PREFIX + config.key, '1');
        syncCoachStateToCloud();

      } catch {
        /* ignorera */
      }
      if (continueTour && path) {
        try {
          localStorage.setItem(ACTIVE_TOUR_KEY, path);
        } catch {
          /* ignorera */
        }
      } else {
        // Sista steget eller fristående tips: stäng av allt tills guiden startas om.
        markAllPageCoachesSeen();
      }
      setVisible(false);
      window.setTimeout(() => {
        setReplayToken((t) => t + 1);
        if (path) navigate(path);
      }, 200);
    },
    [config, navigate]
  );

  /** Avsluta helt: inga tips dyker upp igen förrän man startar om via Support. */
  const endGuide = useCallback(() => {
    markAllPageCoachesSeen();
    setVisible(false);
    window.setTimeout(() => setReplayToken((t) => t + 1), 200);
  }, []);

  /** Sista steget: starta om hela guiden från första sidan. */
  const restartGuide = useCallback(() => {
    startPageCoachTour(TOUR_PATHS[0]);
    setVisible(false);
    window.setTimeout(() => {
      setReplayToken((t) => t + 1);
      navigate(TOUR_PATHS[0]);
    }, 200);
  }, [navigate]);


  /** Kryss: stäng tipset och gå tillbaka till översiktslistan. */
  const backToOverview = useCallback(() => {
    markAllPageCoachesSeen();
    setVisible(false);
    window.setTimeout(() => {
      setReplayToken((t) => t + 1);
      window.dispatchEvent(
        new CustomEvent(WELCOME_CARD_REPLAY_EVENT_NAME, { detail: { step: 1 } })
      );
    }, 200);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') endGuide();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, endGuide]);

  if (!config || alreadySeen) return null;

  const Icon = config.icon;
  const currentTourIndex = TOUR_PATHS.indexOf(location.pathname as (typeof TOUR_PATHS)[number]);
  const nextTourPath = currentTourIndex >= 0 ? TOUR_PATHS[currentTourIndex + 1] : undefined;
  const primaryPath = isGuidedTour ? nextTourPath : config.cta?.path;
  const primaryLabel = isGuidedTour
    ? nextTourPath
      ? `Nästa: ${CONFIGS[nextTourPath]?.title ?? 'Nästa steg'}`
      : 'Klart, stäng'
    : config.cta?.label;

  return createPortal(
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center p-4 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      role="dialog"
      aria-modal="false"
      aria-label={config.title}
    >
      {/* Diskret bakgrund — klick stänger */}
      <button
        type="button"
        aria-label="Stäng tipset"
        onClick={endGuide}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px] focus:outline-none"
      />

      <div
        style={{ WebkitOverflowScrolling: 'touch', transform: 'translateZ(0)', contain: 'paint' }}
        className={`relative w-full max-w-[420px] max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-3xl border border-white/15 bg-[hsl(var(--surface-blue))] shadow-2xl p-5 pt-6 sm:p-6 sm:pt-7 text-center transition-transform duration-300 ${
          visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-2'
        }`}
      >

        <button
          type="button"
          onClick={backToOverview}
          aria-label="Stäng tipset och visa översikten"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
            <Icon className="h-4 w-4 text-white" />
          </span>
          <h3 className="mt-3 px-6 text-[16px] font-semibold text-white leading-snug break-words">
            {config.title}
          </h3>

          <ul className="mt-3 w-full space-y-2">
            {config.lines(isTouch).map((line) => (
              <li
                key={line}
                className="grid w-full grid-cols-[18px_1fr] items-start gap-2 text-left"
              >
                <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-white" strokeWidth={2.5} />
                <span className="text-[13px] leading-snug text-white break-words">
                  {line}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-[12px] leading-snug text-white break-words">
            Vill du se tipsen igen? De ligger kvar under Support → Hjälp &amp; tips.
          </p>

          <div className="mt-4 flex w-full flex-col items-center justify-center gap-2.5">
            {isGuidedTour && !nextTourPath && (
              <button
                type="button"
                onClick={restartGuide}
                className="inline-flex min-w-36 max-w-full items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 py-2 text-[13px] font-medium text-white transition-colors hover:bg-white/[0.16] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                <span className="truncate">Börja om från början</span>
              </button>
            )}
            {primaryLabel && (
              <button
                type="button"
                onClick={() => dismiss(primaryPath, isGuidedTour && Boolean(primaryPath))}
                className="inline-flex min-w-36 max-w-full items-center justify-center gap-2 rounded-full bg-green-500 px-6 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-green-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                <span className="truncate">{primaryLabel}</span>
                {primaryPath && <ArrowRight className="h-4 w-4 shrink-0" />}
              </button>
            )}
            {primaryPath && (
              <button
                type="button"
                onClick={endGuide}
                className="rounded-full border border-white/20 bg-white/10 px-6 py-2 text-[13px] font-medium text-white transition-colors hover:bg-white/[0.16] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                Avsluta guiden
              </button>
            )}
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
};


export default PageIntroCoach;
