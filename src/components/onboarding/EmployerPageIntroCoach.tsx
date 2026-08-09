import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  X, Check, Briefcase, Users, UserCheck, MessageCircle, Building2,
  BarChart3, CreditCard, Settings, HelpCircle, ArrowRight,
} from 'lucide-react';
import { useDevice } from '@/hooks/use-device';
import { useAuth } from '@/hooks/useAuth';
import { loadEmployerCoachState, saveEmployerCoachState, type CoachState } from '@/lib/onboardingState';

/**
 * 🎓 EMPLOYER PAGE INTRO COACH
 *
 * Exakt samma upplägg som jobbsökarens PageIntroCoach, men med
 * arbetsgivarinnehåll och helt egen lagring — de två guiderna kan
 * aldrig stänga av varandra.
 */

const STORAGE_PREFIX = 'parium_emp_page_coach_v1_';
const ACTIVE_TOUR_KEY = 'parium_emp_page_coach_active';
const COACH_DISABLED_KEY = 'parium_emp_page_coach_disabled';
const COACH_OWNER_KEY = 'parium_emp_page_coach_owner';
/** Tidsstämpel för senaste lokala nollställning — vinner över äldre molnstatus. */
const COACH_RESET_AT_KEY = 'parium_emp_page_coach_reset_at';

function readLocalResetAt(): number {
  try {
    return Number(localStorage.getItem(COACH_RESET_AT_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}


/** Speglar EMPLOYER_WELCOME_CARD_REPLAY_EVENT (undviker cirkulär import). */
const EMPLOYER_WELCOME_CARD_REPLAY_EVENT_NAME = 'parium:employer-welcome-card-replay';

const TOUR_PATHS = [
  '/my-jobs',
  '/candidates',
  '/my-candidates',
  '/messages',
  '/company-profile',
  '/reports',
  '/billing',
  '/settings',
  '/support',
] as const;

export const EMPLOYER_PAGE_COACH_REPLAY_EVENT = 'parium:employer-page-coach-replay';

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

function syncCoachStateToCloud() {
  void saveEmployerCoachState(readLocalCoachState());
}

export function resetEmployerPageCoachMarks() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(STORAGE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem(COACH_DISABLED_KEY);
    localStorage.setItem(COACH_RESET_AT_KEY, String(Date.now()));
  } catch {
    /* ignorera */
  }
  syncCoachStateToCloud();
}

function isCoachDisabled(): boolean {
  try {
    return localStorage.getItem(COACH_DISABLED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Markera samtliga sidtips som sedda — används när guiden avslutas. */
export function markAllEmployerPageCoachesSeen() {
  try {
    Object.values(CONFIGS).forEach((c) => localStorage.setItem(STORAGE_PREFIX + c.key, '1'));
    localStorage.setItem(COACH_DISABLED_KEY, '1');
    localStorage.removeItem(ACTIVE_TOUR_KEY);
    localStorage.removeItem(COACH_RESET_AT_KEY);
  } catch {
    /* ignorera */
  }
  syncCoachStateToCloud();
}

/** Starta den sammanhängande guiden från den valda sidan. */
export function startEmployerPageCoachTour(path: string) {
  resetEmployerPageCoachMarks();
  try {
    localStorage.setItem(ACTIVE_TOUR_KEY, path);
  } catch {
    /* ignorera */
  }
  // Se till att tipset dyker upp även när man redan står på sidan
  // (då sker ingen ruttändring som kan trigga omvärderingen).
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent(EMPLOYER_PAGE_COACH_REPLAY_EVENT));
  }, 260);
}


/** Nollställ och visa tipset för sidan man står på just nu. */
export function replayEmployerPageCoach() {
  resetEmployerPageCoachMarks();
  window.dispatchEvent(new CustomEvent(EMPLOYER_PAGE_COACH_REPLAY_EVENT));
}

interface CoachConfig {
  key: string;
  icon: typeof Briefcase;
  title: string;
  lines: (isTouch: boolean) => string[];
  cta?: { label: string; path: string };
}

const CONFIGS: Record<string, CoachConfig> = {
  '/my-jobs': {
    key: 'emp-my-jobs',
    icon: Briefcase,
    title: 'Era annonser',
    lines: (isTouch) => [
      'Här ligger alla era annonser samlade — utkast, aktiva och utgångna.',
      isTouch
        ? 'Tryck på "Skapa ny annons" för att starta annonsguiden. Ni kan spara som utkast och fortsätta senare.'
        : 'Klicka på "Skapa ny annons" för att starta annonsguiden. Ni kan spara som utkast och fortsätta när ni vill.',
      'En publicerad annons ligger uppe i 14 dagar. Utgångna annonser kan återpubliceras med ett klick — all kandidathistorik följer med.',
      'Öppna en annons för att se ansökningar, redigera texten eller pausa den.',
    ],
    cta: { label: 'Visa alla kandidater', path: '/candidates' },
  },
  '/candidates': {
    key: 'emp-candidates',
    icon: Users,
    title: 'Alla kandidater',
    lines: () => [
      'Alla som sökt era annonser hamnar här, med nyaste ansökan först.',
      'Öppna en kandidat för att se profil, presentation, CV och video — och svaren på era egna frågor.',
      'Ni ser bara kandidater som själva valt att söka något av era jobb.',
    ],
    cta: { label: 'Gå till Mina kandidater', path: '/my-candidates' },
  },
  '/my-candidates': {
    key: 'emp-my-candidates',
    icon: UserCheck,
    title: 'Er rekryteringstavla',
    lines: (isTouch) => [
      'Här flyttar ni kandidater genom processen: Ny, Granskas, Intervju, Erbjudande och Avslutad.',
      isTouch
        ? 'Håll in ett kort och dra det till rätt kolumn — statusen sparas direkt.'
        : 'Dra och släpp korten mellan kolumnerna — statusen sparas direkt.',
      'Anteckningar, betyg och statusflytt är helt interna — kandidaten märker inget förrän ni själva hör av er.',
    ],
    cta: { label: 'Öppna meddelanden', path: '/messages' },
  },
  '/messages': {
    key: 'emp-messages',
    icon: MessageCircle,
    title: 'Kontakt med kandidater',
    lines: () => [
      'Det är ni som startar samtalet — kandidaten kan svara så fort ni hört av er.',
      'Kandidaten får en notis direkt, så inget viktigt hinner försvinna.',
      'Intervjuinbjudan skickas från kandidatkortet under Mina kandidater — här sköter ni den löpande dialogen.',
    ],
    cta: { label: 'Fyll i företagsprofilen', path: '/company-profile' },
  },
  '/company-profile': {
    key: 'emp-company-profile',
    icon: Building2,
    title: 'Er företagsprofil',
    lines: () => [
      'Logga, beskrivning, bilder och sociala kanaler — det här är det kandidaten möts av i era annonser.',
      'Komplett profil med logga och beskrivning ger märkbart fler ansökningar.',
      'Här ställer ni också in hur ni håller intervjuer: på plats, video eller telefon.',
    ],
    cta: { label: 'Se er statistik', path: '/reports' },
  },
  '/reports': {
    key: 'emp-reports',
    icon: BarChart3,
    title: 'Statistik',
    lines: () => [
      'Visningar, sparningar och ansökningar per annons — så ni ser vad som faktiskt fungerar.',
      'Få ansökningar? Testa tydligare titel, lönespann och en kortare annonstext.',
    ],
    cta: { label: 'Gå till Fakturering', path: '/billing' },
  },
  '/billing': {
    key: 'emp-billing',
    icon: CreditCard,
    title: 'Plan och fakturering',
    lines: () => [
      'Här ser ni er plan, era kvitton och hur många annonser som ingår.',
      'Ingen bindningstid — ni byter plan eller säger upp när ni vill.',
      'Behöver ni bara rekrytera en gång finns Enkelannons som engångsköp.',
    ],
    cta: { label: 'Öppna Support', path: '/support' },
  },
  '/support': {
    key: 'emp-support',
    icon: HelpCircle,
    title: 'Hjälp när ni behöver den',
    lines: () => [
      'Guider, vanliga frågor och direktkontakt med oss — vi svarar så fort vi bara kan.',
      'Under Hjälp & tips kan ni alltid starta om hela den här genomgången från början.',
    ],
  },
  '/settings': {
    key: 'emp-settings',
    icon: Settings,
    title: 'Inställningar',
    lines: () => [
      'Notiser, e-postutskick och kontoinställningar för er organisation.',
      'Här bjuder ni också in kollegor och styr vad de får se och göra.',
    ],
  },
};

const EmployerPageIntroCoach = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const device = useDevice();
  const { user, loading: authLoading } = useAuth();
  const isTouch = device !== 'desktop';
  const [replayToken, setReplayToken] = useState(0);
  const [visible, setVisible] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setHydrated(false);
      return;
    }

    let cancelled = false;
    setHydrated(false);
    (async () => {
      try {
        let owner: string | null = null;
        try {
          owner = localStorage.getItem(COACH_OWNER_KEY);
        } catch { /* ignorera */ }
        if (owner !== user.id) {
          writeLocalCoachState({ seen: {}, disabled: false });
          try {
            localStorage.removeItem(ACTIVE_TOUR_KEY);
            localStorage.setItem(COACH_OWNER_KEY, user.id);
          } catch { /* ignorera */ }
        }

        const local = owner === user.id ? readLocalCoachState() : { seen: {}, disabled: false };
        const cloud = await loadEmployerCoachState();
        if (cancelled) return;

        // Har guiden nyss startats om lokalt vinner den alltid över äldre molnstatus,
        // annars kan en gammal "allt sett"-status slå tillbaka och blockera tipsen.
        const resetAt = readLocalResetAt();
        const cloudIsStale = resetAt > 0 && (cloud?.savedAt ?? 0) < resetAt;

        const merged: CoachState = cloudIsStale
          ? { seen: { ...(local.seen ?? {}) }, disabled: Boolean(local.disabled) }
          : {
              seen: { ...(local.seen ?? {}), ...(cloud?.seen ?? {}) },
              disabled: Boolean(local.disabled || cloud?.disabled),
            };
        writeLocalCoachState(merged);
        const cloudSeenCount = Object.keys(cloud?.seen ?? {}).length;
        const mergedSeenCount = Object.keys(merged.seen ?? {}).length;
        if (cloudIsStale || !cloud || cloudSeenCount !== mergedSeenCount || cloud.disabled !== merged.disabled) {
          void saveEmployerCoachState(merged);
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
  }, [user?.id, authLoading]);

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
    if (isCoachDisabled() && !isGuidedTour) return true;
    try {
      return !isGuidedTour && localStorage.getItem(STORAGE_PREFIX + config.key) === '1';
    } catch {
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, replayToken, isGuidedTour, hydrated]);

  useEffect(() => {
    const onReplay = () => setReplayToken((t) => t + 1);
    window.addEventListener(EMPLOYER_PAGE_COACH_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(EMPLOYER_PAGE_COACH_REPLAY_EVENT, onReplay);
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
        markAllEmployerPageCoachesSeen();
      }
      setVisible(false);
      window.setTimeout(() => {
        setReplayToken((t) => t + 1);
        if (path) navigate(path);
      }, 200);
    },
    [config, navigate]
  );

  const endGuide = useCallback(() => {
    markAllEmployerPageCoachesSeen();
    setVisible(false);
    window.setTimeout(() => setReplayToken((t) => t + 1), 200);
  }, []);

  const restartGuide = useCallback(() => {
    startEmployerPageCoachTour(TOUR_PATHS[0]);
    setVisible(false);
    window.setTimeout(() => {
      setReplayToken((t) => t + 1);
      navigate(TOUR_PATHS[0]);
    }, 200);
  }, [navigate]);

  const backToOverview = useCallback(() => {
    markAllEmployerPageCoachesSeen();
    setVisible(false);
    window.setTimeout(() => {
      setReplayToken((t) => t + 1);
      window.dispatchEvent(
        new CustomEvent(EMPLOYER_WELCOME_CARD_REPLAY_EVENT_NAME, { detail: { step: 1 } })
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
                <span className="text-[13px] leading-snug text-white break-words">{line}</span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-[12px] leading-snug text-white break-words">
            Vill ni se tipsen igen? De ligger kvar under Support → Hjälp &amp; tips.
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

export default EmployerPageIntroCoach;
