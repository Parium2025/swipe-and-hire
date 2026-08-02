import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  X, Check, ArrowRight, Building, FileText, User, Heart, MessageCircle,
} from 'lucide-react';
import { useDevice } from '@/hooks/use-device';

/**
 * 🎓 PAGE INTRO COACH
 *
 * Diskret, premium "första gången här"-kort som förklarar vad sidan gör och
 * vad nästa naturliga steg är. Visas en gång per sida (sparas lokalt), kan
 * alltid stängas, blockerar aldrig klick i appen.
 *
 * Texten anpassas efter enhet (touch/swipe på mobil, klick på dator).
 */

const STORAGE_PREFIX = 'parium_page_coach_v1_';

export function resetPageCoachMarks() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(STORAGE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignorera */
  }
}

interface CoachConfig {
  key: string;
  icon: typeof Search;
  title: string;
  lines: (isTouch: boolean) => string[];
  cta?: { label: string; path: string };
}

const CONFIGS: Record<string, CoachConfig> = {
  '/search-jobs': {
    key: 'search-jobs',
    icon: Search,
    title: 'Så hittar du rätt jobb',
    lines: (isTouch) => [
      'Sök på yrke, företag eller ort — eller använd filtren för arbetstid och avstånd.',
      isTouch
        ? 'Swipa åt höger för att spara ett jobb, åt vänster för att hoppa vidare.'
        : 'Klicka på ett kort för att öppna hela annonsen. Hjärtat sparar jobbet till senare.',
      'Hittar du något? Tryck "Ansök" — dina uppgifter fylls i automatiskt.',
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
    cta: { label: 'Tillbaka till sök', path: '/search-jobs' },
  },
  '/profile': {
    key: 'profile',
    icon: User,
    title: 'Det här ser arbetsgivaren',
    lines: () => [
      'Bild, presentation, CV och video — allt kan ändras eller raderas när du vill.',
      'Profiler med bild och en kort presentation får betydligt fler svar.',
      'Inget delas förrän du själv skickar en ansökan.',
    ],
    cta: { label: 'Sök jobb nu', path: '/search-jobs' },
  },
  '/messages': {
    key: 'messages',
    icon: MessageCircle,
    title: 'Dina samtal',
    lines: () => [
      'När en arbetsgivare svarar på din ansökan hamnar chatten här.',
      'Du får en notis direkt — inget viktigt försvinner.',
    ],
    cta: { label: 'Se dina ansökningar', path: '/my-applications' },
  },
};

const PageIntroCoach = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const device = useDevice();
  const isTouch = device !== 'desktop';
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const config = useMemo(() => CONFIGS[location.pathname], [location.pathname]);

  const alreadySeen = useMemo(() => {
    if (!config) return true;
    try {
      return localStorage.getItem(STORAGE_PREFIX + config.key) === '1';
    } catch {
      return false;
    }
  }, [config, dismissedKey]);

  useEffect(() => {
    if (!config || alreadySeen) {
      setVisible(false);
      return;
    }
    const id = window.setTimeout(() => setVisible(true), 450);
    return () => window.clearTimeout(id);
  }, [config, alreadySeen]);

  if (!config || alreadySeen) return null;

  const dismiss = (path?: string) => {
    try {
      localStorage.setItem(STORAGE_PREFIX + config.key, '1');
    } catch {
      /* ignorera */
    }
    setVisible(false);
    window.setTimeout(() => {
      setDismissedKey(config.key);
      if (path) navigate(path);
    }, 200);
  };

  const Icon = config.icon;

  return createPortal(
    <div
      className={`fixed z-[60] left-3 right-3 bottom-3 sm:left-auto sm:right-6 sm:bottom-6 sm:w-[380px] transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
      role="status"
      aria-live="polite"
    >
      <div className="rounded-3xl border border-white/15 bg-[hsl(var(--surface-blue))]/95 backdrop-blur-xl shadow-2xl p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/15 ring-1 ring-green-400/30">
            <Icon className="h-[18px] w-[18px] text-green-400" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[15px] font-semibold text-white leading-snug break-words">
                {config.title}
              </h3>
              <button
                type="button"
                onClick={() => dismiss()}
                aria-label="Stäng tipset"
                className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="mt-2 space-y-1.5">
              {config.lines(isTouch).map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Sparkles className="mt-[3px] h-3.5 w-3.5 shrink-0 text-green-400" />
                  <span className="text-[13px] leading-snug text-white break-words">{line}</span>
                </li>
              ))}
            </ul>
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
                Uppfattat
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
