import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Building, User, FileText, Heart, ArrowRight, Check, MessageCircle,
  CreditCard, HelpCircle, Briefcase, ChevronLeft, Eye,
} from 'lucide-react';
import { startPageCoachTour, markAllPageCoachesSeen } from '@/components/onboarding/PageIntroCoach';

interface AppOnboardingTourProps {
  onComplete: () => void;
  /** Förnamn för en personlig hälsning (valfritt) */
  firstName?: string;
  /** 0 = översikt, 1 = "Var vill du börja?" */
  initialStep?: 0 | 1;
}

interface Shortcut {
  icon: typeof Building;
  title: string;
  description: string;
  path: string;
}

const shortcuts: Shortcut[] = [
  {
    icon: Building,
    title: 'Sök jobb',
    description: 'Sök på yrke, företag eller ort — och filtrera fram rätt jobb.',
    path: '/search-jobs',
  },
  {
    icon: Heart,
    title: 'Sparade jobb',
    description: 'Jobb du sparat med hjärtat ligger kvar här tills annonsen stänger.',
    path: '/saved-jobs',
  },
  {
    icon: FileText,
    title: 'Mina ansökningar',
    description: 'Följ status på allt du sökt, samlat på ett ställe.',
    path: '/my-applications',
  },
  {
    icon: MessageCircle,
    title: 'Chattar',
    description: 'Arbetsgivaren startar chatten här efter din ansökan — du får en notis.',
    path: '/messages',
  },
  {
    icon: User,
    title: 'Min profil',
    description: 'Uppdatera CV, bild, video och dina uppgifter när du vill.',
    path: '/profile',
  },
  {
    icon: Eye,
    title: 'Förhandsgranska profil',
    description: 'Se exakt hur arbetsgivaren möts av din profil.',
    path: '/profile-preview',
  },
  {
    icon: CreditCard,
    title: 'Ekonomi',
    description: 'Din plan och dina kvitton. Att söka jobb är alltid gratis.',
    path: '/subscription',
  },
  {
    icon: HelpCircle,
    title: 'Support',
    description: 'Guider, vanliga frågor och kontakt med oss — svar på svenska.',
    path: '/support',
  },
];

/** Event som öppnar hela välkomstkortet igen (Support → Hjälp & tips). */
export const WELCOME_CARD_REPLAY_EVENT = 'parium:welcome-card-replay';

/** Visa hela välkomstkortet igen, precis som första gången. */
export function replayWelcomeCard(step: 0 | 1 = 0) {
  window.dispatchEvent(new CustomEvent(WELCOME_CARD_REPLAY_EVENT, { detail: { step } }));
}


/**
 * Välkomstkort i två steg som visas en gång efter att profilen är klar.
 *
 * Steg 1 – Överblick: vad appen innehåller (Jobb, Chattar, Ekonomi, Support,
 *          Min profil) + hur man navigerar beroende på enhet (swipe på mobil,
 *          klick/tangentbord på dator).
 * Steg 2 – Genvägar: tre klickbara vägar in i appen.
 *
 * Ingen tvingande rundtur: användaren kan stänga när som helst.
 */
const AppOnboardingTour = ({ onComplete, firstName, initialStep = 0 }: AppOnboardingTourProps) => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<0 | 1>(initialStep);

  useEffect(() => {
    setStep(initialStep);
  }, [initialStep]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Ingen tyst omladdning får avbryta guiden — den skulle annars visas på nytt
  // direkt efter välkomsttunneln.
  useEffect(() => {
    let release: (() => void) | undefined;
    let cancelled = false;
    import('@/lib/appReloader').then(({ suppressAppReload }) => {
      if (cancelled) return;
      release = suppressAppReload();
    });
    return () => {
      cancelled = true;
      release?.();
    };
  }, []);


  // Lås bakgrundsscroll medan kortet visas
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const close = (path?: string) => {
    // Stänger man utan att välja en guide ska inga sidtips dyka upp senare.
    if (!path) markAllPageCoachesSeen();
    setVisible(false);
    window.setTimeout(() => {
      onComplete();
      if (path) navigate(path);
    }, 180);
  };

  const startGuide = (path: string) => {
    startPageCoachTour(path);
    close(path);
  };

  // Escape stänger
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const areas = useMemo(
    () => [
      {
        icon: Briefcase,
        title: 'Jobb',
        description:
          'Sök jobb, spara favoriter och se dina ansökningar. Allt jobbrelaterat ligger här.',
      },
      {
        icon: MessageCircle,
        title: 'Chattar',
        description:
          'När en arbetsgivare hör av sig hamnar samtalet här — du får en notis direkt.',
      },
      {
        icon: CreditCard,
        title: 'Ekonomi',
        description:
          'Din plan och dina kvitton. Att söka jobb är gratis — Premium är helt frivilligt.',
      },
      {
        icon: HelpCircle,
        title: 'Support',
        description:
          'Frågor, guider och kontakt med oss. Vi svarar på svenska, alla vardagar.',
      },
      {
        icon: User,
        title: 'Min profil',
        description:
          'CV, bild, video och uppgifter. Det är detta arbetsgivaren ser när du söker.',
      },
    ],
    []
  );

  return createPortal(
    <div
      className={`fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6 transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Välkommen till Parium"
    >
      {/* Bakgrund */}
      <button
        type="button"
        aria-label="Stäng"
        onClick={() => close()}
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px] focus:outline-none"
      />

      {/* Kort */}
      <div
        className={`relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/15 bg-[hsl(var(--surface-blue))]/95 shadow-2xl transition-all duration-300 ${
          visible ? 'translate-y-0 scale-100' : 'translate-y-6 sm:translate-y-0 sm:scale-95'
        }`}
      >
        <div className="p-6 sm:p-8">
          {step === 0 ? (
            <>
              {/* Header */}
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/15 ring-1 ring-green-400/40">
                  <Check className="h-6 w-6 text-green-400" strokeWidth={2.5} />
                </div>
                <h2 className="text-2xl sm:text-[26px] font-bold text-white leading-tight">
                  {firstName ? `Välkommen, ${firstName}!` : 'Välkommen till Parium!'}
                </h2>
                <p className="mt-2 text-sm sm:text-base text-white leading-relaxed max-w-md">
                  Din profil är klar. Här är hela appen i olika steg — välj själv var du vill
                  börja.
                </p>
              </div>

              {/* Områden */}
              <div className="mt-6 space-y-2.5">
                {areas.map((area) => {
                  const Icon = area.icon;
                  return (
                    <div
                      key={area.title}
                      className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/[0.05] p-3.5"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                        <Icon className="h-[18px] w-[18px] text-white" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-white">
                          {area.title}
                        </span>
                        <span className="block text-[13px] leading-snug text-white break-words">
                          {area.description}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
                <p className="text-[13px] leading-snug text-white break-words text-center">
                  <span className="font-semibold">Tips:</span> Parium-loggan längst upp till vänster är
                  din hem-knapp. På mobil och surfplatta öppnar du hela menyn med ikonen bredvid
                  loggan — där finns Sök jobb, Sparade jobb, Ansökningar, Chattar, Ekonomi,
                  Support och Min profil. På dator ligger samma menyer i raden längst upp.
                </p>
              </div>



              <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => close()}
                  className="w-full sm:w-auto rounded-full border border-white/20 bg-white/10 px-6 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-white/[0.16] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                >
                  Jag utforskar själv
                </button>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-green-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-green-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                >
                  Visa mig var jag börjar
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center text-center">
                <h2 className="text-2xl sm:text-[26px] font-bold text-white leading-tight">
                  Var vill du börja?
                </h2>
                <p className="mt-2 text-sm sm:text-base text-white leading-relaxed max-w-md">
                  Gå igenom dem i ordning, ett steg i taget — eller hoppa direkt till det du är
                  nyfiken på. Du kan alltid byta via menyn längst upp.
                </p>
              </div>

              {/* Genvägar i ordning */}
              <div className="mt-6 space-y-3">
                {shortcuts.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => startGuide(item.path)}
                      className="group flex w-full items-center gap-3.5 rounded-2xl border border-white/12 bg-white/[0.06] p-4 text-left transition-colors duration-150 hover:bg-white/[0.12] active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                    >
                      <span className="w-5 shrink-0 text-[13px] font-semibold tabular-nums text-white">
                        {index + 1}
                      </span>
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10">
                        <Icon className="h-5 w-5 text-white" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-white">{item.title}</span>
                        <span className="block text-[13px] leading-snug text-white break-words">
                          {item.description}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-white/70 transition-transform duration-150 group-hover:translate-x-0.5" />
                    </button>
                  );
                })}
              </div>

              {/* Trygghetsrad */}
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
                <p className="text-[13px] leading-snug text-white break-words">
                  <span className="font-semibold">Tips:</span> Först när du själv skickar en ansökan
                  delas din profil med arbetsgivaren — namn, kontaktuppgifter, bild, presentation,
                  CV och video om du laddat upp det. Vissa arbetsgivare har egna frågor i ansökan;
                  svara på dem, de väger tungt. Du kan ändra eller radera allt när som helst under
                  Min profil.
                </p>
              </div>

              <div className="mt-6 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-white/[0.16] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Tillbaka
                </button>
              </div>

            </>
          )}

          {/* Stegprickar */}
          <div className="mt-5 flex items-center justify-center gap-1.5">
            {[0, 1].map((i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  step === i ? 'w-5 bg-white' : 'w-1.5 bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AppOnboardingTour;
