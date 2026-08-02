import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  X, Check, ArrowRight, Building, FileText, User, Heart, MessageCircle, Eye, Home,
} from 'lucide-react';
import { useDevice } from '@/hooks/use-device';

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

/** Event som öppnar tipset för nuvarande sida igen. */
export const PAGE_COACH_REPLAY_EVENT = 'parium:page-coach-replay';

export function resetPageCoachMarks() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(STORAGE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
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
  '/home': {
    key: 'home',
    icon: Home,
    title: 'Det här är din startsida',
    lines: () => [
      'Här ser du nyheter, din statistik, dina anteckningar och bokade intervjuer — en snabb överblick varje gång du loggar in.',
      'Menyn längst upp tar dig vidare: Jobb, Chattar, Ekonomi, Support och Min profil.',
      'Parium-loggan längst upp till vänster är en knapp — tryck på den när du vill tillbaka hit.',
    ],
    cta: { label: 'Gå till Sök jobb', path: '/search-jobs' },
  },
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
      'När du trycker "Ansök" fylls dina uppgifter i automatiskt. Vissa arbetsgivare har egna frågor i ansökan — svara på dem, de väger tungt.',
      'När du skickar ansökan delas din profil med arbetsgivaren: namn, kontaktuppgifter, bild, presentation, CV och video om du laddat upp det. Inget delas innan du själv ansöker.',
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
      'Öppna ett jobb när du har tid och skicka in ansökan i lugn och ro.',
    ],
    cta: { label: 'Tillbaka till Sök jobb', path: '/search-jobs' },
  },
  '/profile': {
    key: 'profile',
    icon: User,
    title: 'Det här ser arbetsgivaren',
    lines: () => [
      'Bild, presentation, CV och video — allt kan ändras eller raderas när du vill.',
      'Profiler med bild och en kort presentation får betydligt fler svar.',
      'Din profil delas med en arbetsgivare först när du själv skickar en ansökan — aldrig innan.',
    ],
    cta: { label: 'Gå till Sök jobb', path: '/search-jobs' },
  },
  '/profile-preview': {
    key: 'profile-preview',
    icon: Eye,
    title: 'Så ser arbetsgivaren dig',
    lines: () => [
      'Det här är exakt den vy arbetsgivaren möts av när du har sökt ett jobb.',
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
      'Tomt nu? Chattar startas av arbetsgivaren efter att du har sökt ett jobb.',
    ],
    cta: { label: 'Se dina ansökningar', path: '/my-applications' },
  },
};

const PageIntroCoach = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const device = useDevice();
  const isTouch = device !== 'desktop';
  const [replayToken, setReplayToken] = useState(0);
  const [visible, setVisible] = useState(false);

  const config = useMemo(() => CONFIGS[location.pathname], [location.pathname]);

  const alreadySeen = useMemo(() => {
    if (!config) return true;
    try {
      return localStorage.getItem(STORAGE_PREFIX + config.key) === '1';
    } catch {
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, replayToken]);

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
    (path?: string) => {
      if (!config) return;
      try {
        localStorage.setItem(STORAGE_PREFIX + config.key, '1');
      } catch {
        /* ignorera */
      }
      setVisible(false);
      window.setTimeout(() => {
        setReplayToken((t) => t + 1);
        if (path) navigate(path);
      }, 200);
    },
    [config, navigate]
  );

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, dismiss]);

  if (!config || alreadySeen) return null;

  const Icon = config.icon;

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
        onClick={() => dismiss()}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px] focus:outline-none"
      />

      <div
        className={`relative w-full max-w-[420px] rounded-3xl border border-white/15 bg-[hsl(var(--surface-blue))]/95 backdrop-blur-xl shadow-2xl p-5 sm:p-6 transition-transform duration-300 ${
          visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-2'
        }`}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
            <Icon className="h-[18px] w-[18px] text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[16px] font-semibold text-white leading-snug break-words">
                {config.title}
              </h3>
              <button
                type="button"
                onClick={() => dismiss()}
                aria-label="Stäng tipset"
                className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="mt-3 space-y-2">
              {config.lines(isTouch).map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-white" strokeWidth={2.5} />
                  <span className="text-[13px] leading-snug text-white break-words">{line}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12px] leading-snug text-white break-words">
              Vill du se tipsen igen? De ligger kvar under Support → Hjälp &amp; tips.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {config.cta && (
                <button
                  type="button"
                  onClick={() => dismiss(config.cta!.path)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-green-500 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-green-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                >
                  {config.cta.label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => dismiss()}
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-white/[0.16] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                Uppfattat, stäng
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PageIntroCoach;
