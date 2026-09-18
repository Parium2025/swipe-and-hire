import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MobileStickyCTAProps {
  /** Knapptext, default "Skapa min profil idag" (samma som appens landning). */
  label?: string;
  /** Vart användaren ska — default /auth */
  to?: string;
  /** Körs precis innan navigation (t.ex. för att parkera intent i sessionStorage). */
  onBeforeNavigate?: () => void;
}

/**
 * Sticky bottom-CTA på mobil/små skärmar.
 * Använder Pariums ljusblå pill-stil (secondary) — exakt samma som
 * hero-knappen på /jobbsokare så hela appen pratar samma språk.
 */
const MobileStickyCTA = ({
  label = 'Skapa min profil idag',
  to = '/auth',
  onBeforeNavigate,
}: MobileStickyCTAProps) => {
  const navigate = useNavigate();
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 md:hidden pointer-events-none"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
    >
      <div className="pointer-events-auto mx-3">
        <div className="rounded-2xl border border-white/10 bg-[hsl(215_100%_12%)]/85 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.45)] p-2">
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              try { onBeforeNavigate?.(); } catch {}
              navigate(to);
            }}

            onClick={(e) => e.preventDefault()}
            className="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-xl bg-secondary text-white px-6 text-[16px] font-semibold tracking-tight transition-colors active:bg-secondary/85"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {label}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileStickyCTA;
