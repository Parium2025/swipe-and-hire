import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, User, FileText, Heart, ArrowRight, Check } from 'lucide-react';

interface AppOnboardingTourProps {
  onComplete: () => void;
  /** Förnamn för en personlig hälsning (valfritt) */
  firstName?: string;
}

interface Shortcut {
  icon: typeof Search;
  title: string;
  description: string;
  path: string;
}

const shortcuts: Shortcut[] = [
  {
    icon: Search,
    title: 'Sök jobb',
    description: 'Filtrera på yrke, ort och arbetstid — eller swipa dig igenom.',
    path: '/search-jobs',
  },
  {
    icon: User,
    title: 'Min profil',
    description: 'Uppdatera CV, bild, video och dina uppgifter när du vill.',
    path: '/profile',
  },
  {
    icon: FileText,
    title: 'Mina ansökningar',
    description: 'Följ status på allt du sökt, samlat på ett ställe.',
    path: '/my-applications',
  },
];

/**
 * Välkomstkort som visas en gång efter att profilen är klar.
 * Ingen tvingande rundtur: användaren väljer själv vart hen vill,
 * eller stänger kortet och utforskar fritt.
 */
const AppOnboardingTour = ({ onComplete, firstName }: AppOnboardingTourProps) => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
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
    setVisible(false);
    window.setTimeout(() => {
      onComplete();
      if (path) navigate(path);
    }, 180);
  };

  // Escape stänger
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
          {/* Header */}
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/15 ring-1 ring-green-400/40">
              <Check className="h-6 w-6 text-green-400" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl sm:text-[26px] font-bold text-white leading-tight">
              {firstName ? `Välkommen, ${firstName}!` : 'Välkommen till Parium!'}
            </h2>
            <p className="mt-2 text-sm sm:text-base text-white leading-relaxed max-w-md">
              Din profil är klar. Här är de tre ställen du kommer använda mest — välj var du vill börja.
            </p>
          </div>

          {/* Genvägar */}
          <div className="mt-6 space-y-3">
            {shortcuts.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => close(item.path)}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-white/12 bg-white/[0.06] p-4 text-left transition-colors duration-150 hover:bg-white/[0.12] active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <Icon className="h-5 w-5 text-white" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-white">{item.title}</span>
                    <span className="block text-[13px] leading-snug text-white/90 break-words">
                      {item.description}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-white/70 transition-transform duration-150 group-hover:translate-x-0.5" />
                </button>
              );
            })}
          </div>

          {/* Trygghetsrad */}
          <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
            <Heart className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
            <p className="text-[13px] leading-snug text-white">
              Dina uppgifter visas för en arbetsgivare först när du själv söker ett jobb. Du kan ändra
              eller radera allt när som helst under Min profil.
            </p>
          </div>

          {/* Stäng */}
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => close()}
              className="rounded-full border border-white/20 bg-white/10 px-6 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-white/[0.16] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              Jag utforskar själv
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AppOnboardingTour;
