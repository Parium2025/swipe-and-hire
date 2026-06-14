import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MobileStickyCTAProps {
  /** Knapptext, t.ex. "Skapa profil gratis" */
  label?: string;
  /** Vart användaren ska — default /auth */
  to?: string;
}

/**
 * Sticky bottom-CTA som endast visas på mobil/små skärmar.
 * Följer landningssidans mörkblå tema, använder kritvit (chalk) knapp
 * och respekterar iOS safe-area så den aldrig krockar med hemknapps-baren.
 * Branschstandard på job-/SaaS-landning – konverterar ~30–50% bättre än
 * enbart hero-CTA eftersom action alltid är inom räckhåll.
 */
const MobileStickyCTA = ({
  label = 'Skapa en profil gratis',
  to = '/auth',
}: MobileStickyCTAProps) => {
  const navigate = useNavigate();
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 md:hidden pointer-events-none"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      aria-hidden={false}
    >
      <div className="pointer-events-auto mx-3">
        <div className="rounded-2xl border border-white/10 bg-[hsl(215_100%_12%)]/85 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.45)] p-2">
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              navigate(to);
            }}
            onClick={(e) => e.preventDefault()}
            className="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-xl bg-chalk text-[hsl(215_100%_12%)] px-6 text-[16px] font-semibold tracking-tight transition-colors active:bg-chalk/85"
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
