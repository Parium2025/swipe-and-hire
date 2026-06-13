import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const PENDING_PLAN_KEY = 'parium-pending-plan';
const CHECKOUT_ORIGIN_KEY = 'parium-checkout-origin';
// Origins: 'subscription' (från Ekonomi → Abonnemang), 'landing' (icke-inloggad CTA),
// 'signup' (kom hit direkt efter konto-skapande). Default → 'home'.

const PLAN_DETAILS: Record<string, { name: string; price: string; tagline: string; perks: string[] }> = {
  premium: {
    name: 'Premium',
    price: '29 kr/mån',
    tagline: 'Full tillgång till alla Parium-funktioner.',
    perks: [
      'Visa intresse för obegränsat antal jobb',
      'Spara obegränsat antal jobb',
      'Se vilka företag som tittat på din profil',
      'Direktkontakt till arbetsgivare via mejl',
      'Statistik över profilvisningar senaste 30 dagarna',
    ],
  },
};

export default function Checkout() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);

  const planId = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(PENDING_PLAN_KEY);
  }, []);

  const plan = planId ? PLAN_DETAILS[planId] : null;

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth', { replace: true, state: { mode: 'register', plan: planId ?? 'premium' } });
    }
  }, [loading, user, navigate, planId]);

  if (loading || !user) {
    return <div className="min-h-dvh bg-[hsl(215_100%_12%)]" />;
  }

  if (!plan) {
    return <Navigate to="/home" replace />;
  }

  const handleCheckout = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      toast({
        title: 'Stripe kommer snart',
        description: 'Betalningsflödet kopplas på i nästa steg. Du landar då direkt här efter betalning.',
      });
    }, 600);
  };

  const displayName = (profile as any)?.first_name || (profile as any)?.full_name || user.email;

  return (
    <div
      className="relative min-h-dvh w-full overflow-hidden px-5 py-12 sm:px-8 md:py-20"
      style={{
        backgroundColor: 'hsl(215 100% 12%)',
        backgroundImage:
          'radial-gradient(1200px 700px at 12% -10%, hsl(215 85% 28% / 0.55), transparent 60%), radial-gradient(900px 600px at 100% 110%, hsl(215 85% 22% / 0.45), transparent 65%), linear-gradient(135deg, hsl(215 100% 12%) 0%, hsl(215 85% 22%) 50%, hsl(215 100% 12%) 100%)',
      }}
    >
      <div className="mx-auto flex w-full max-w-[560px] flex-col">
        <motion.button
          type="button"
          onClick={() => {
            // Rensa pending-plan så att /auth inte skickar tillbaka hit i en loop
            try { sessionStorage.removeItem(PENDING_PLAN_KEY); } catch {}
            let origin: string | null = null;
            try { origin = sessionStorage.getItem(CHECKOUT_ORIGIN_KEY); } catch {}
            try { sessionStorage.removeItem(CHECKOUT_ORIGIN_KEY); } catch {}

            if (!user) {
              navigate('/', { replace: true });
              return;
            }
            // Inloggad: route baserat på var man kom ifrån
            if (origin === 'subscription') {
              navigate('/subscription', { replace: true });
            } else {
              // 'signup', 'landing', eller okänt → home (WelcomeTunnel fångar nya konton)
              navigate('/home', { replace: true });
            }
          }}
          className="mb-8 inline-flex h-10 items-center gap-2 self-start rounded-full border border-white/20 bg-white/5 px-5 text-sm font-medium text-white backdrop-blur-[2px] transition-colors hover:bg-white/10 active:scale-[0.97]"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <span aria-hidden>←</span> Tillbaka
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-3xl border border-white/15 bg-white/5 p-8 backdrop-blur-xl shadow-[0_42px_110px_-52px_hsl(var(--secondary)/0.6)]"
        >
          <span className="inline-flex rounded-full bg-secondary/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
            Slutför prenumeration
          </span>

          <h1 className="mt-5 text-3xl font-black text-white sm:text-4xl">
            Bli {plan.name}
          </h1>
          <p className="mt-2 text-sm text-white">
            Hej {displayName} — ett steg kvar.
          </p>

          <div className="mt-7 flex items-baseline gap-2">
            <span className="text-5xl font-black text-white">{plan.price.split('/')[0]}</span>
            <span className="text-sm font-medium text-white">/{plan.price.split('/')[1]}</span>
          </div>
          <p className="mt-3 text-sm leading-7 text-white">{plan.tagline}</p>

          <div className="mt-7 border-t border-white/10 pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white">
              Det här ingår
            </p>
            <ul className="mt-4 space-y-3">
              {plan.perks.map((perk) => (
                <li key={perk} className="flex items-start gap-3 text-sm leading-6 text-white">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-secondary"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="4 10 8.5 14.5 16 6.5" />
                  </svg>
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            disabled={processing}
            onClick={handleCheckout}
            className="mt-8 flex w-full min-h-[54px] items-center justify-center rounded-2xl bg-secondary px-6 text-sm font-bold tracking-wide text-white shadow-[0_18px_45px_-18px_hsl(var(--secondary)/0.45)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-secondary/90 active:scale-[0.98] disabled:opacity-70"
          >
            {processing ? 'Förbereder betalning…' : 'Betala med kort'}
          </button>

          <p className="mt-4 text-center text-xs text-white">
            Säker betalning via Stripe. Avsluta när du vill.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
