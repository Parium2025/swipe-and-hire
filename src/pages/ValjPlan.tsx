import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useHasActivePlan, type PlanTier } from '@/hooks/useHasActivePlan';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PaymentPlaceholderDialog } from '@/components/PaymentPlaceholderDialog';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { PariumLogoButton } from '@/components/PariumLogoButton';
import { toast } from 'sonner';

type BillingPeriod = 'monthly' | 'one_time';

interface Plan {
  id: string;
  tier: PlanTier;
  name: string;
  description: string | null;
  price_sek: number;
  billing_period: BillingPeriod;
  max_active_jobs: number | null;
  max_users: number | null;
  features: string[];
  sort_order: number;
}

const ease = [0.16, 1, 0.3, 1] as const;

function formatPrice(sek: number) {
  return sek.toLocaleString('sv-SE');
}

/** Kollapsbar feature-lista — samma stuk som pricing på landningen. */
function PlanFeatures({
  features,
  isActive,
  open,
  onToggle,
}: {
  features: string[];
  isActive: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mt-6 border-t border-white/10 pt-5">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full min-h-[44px] cursor-pointer items-center justify-between text-sm font-semibold text-white"
      >
        <span>Se alla funktioner</span>
        <motion.span
          className="ml-4 text-secondary"
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.35, ease }}
        >
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.45, ease },
              opacity: { duration: 0.3, ease, delay: open ? 0.08 : 0 },
            }}
            className="overflow-hidden"
          >
            <ul className="mt-4 space-y-3">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm leading-6 text-white">
                  <Check className={`mt-0.5 h-4 w-4 flex-shrink-0 ${isActive ? 'text-secondary' : 'text-white/70'}`} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Speglar EXAKT samma punktlistor som visas på audience-landningen
 * (se `AudienceLanding.tsx` → `employerPlans` + engångskortet).
 * Ändras något där ska det ändras här också.
 */
const COMMON_EMPLOYER_FEATURES = [
  'Skapa annons på minuter',
  'Kandidatpresentation med bild, video och egna ord — där kandidaten själv väljer vad som visas',
  'Överblick över alla sökande — flytta kandidater mellan steg: ny, intressant, intervju, erbjudande m.m.',
  'Chatt direkt med kandidater i plattformen',
  'Automatiska svar till alla sökande — ingen lämnas utan besked',
  'Fungerar lika bra i mobilen som på datorn',
];

const FEATURES_BY_TIER: Record<PlanTier, string[]> = {
  one_time: [
    '1 annons live i 14 dagar',
    'Ingen bindningstid',
    ...COMMON_EMPLOYER_FEATURES,
  ],
  start: [
    '1 användare',
    'Upp till 40 aktiva annonser per månad',
    ...COMMON_EMPLOYER_FEATURES,
  ],
  vaxa: [
    '2 användare',
    'Obegränsat antal annonser',
    ...COMMON_EMPLOYER_FEATURES,
  ],
  pro: [
    'Obegränsat antal användare',
    'Obegränsat antal annonser',
    'Roller och behörigheter för hela teamet',
    'Dedikerad kontaktperson',
    ...COMMON_EMPLOYER_FEATURES,
  ],
  jobseeker_premium: [],
};

export default function ValjPlan() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, userRole } = useAuth();
  const { plan: activePlan } = useHasActivePlan();
  const isEmployer = userRole?.role === 'employer';

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const from = searchParams.get('from');
  const cancelled = searchParams.get('cancelled') === 'true';
  const welcome = searchParams.get('welcome') === 'true';

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (!mounted) return;
      if (error) {
        toast.error('Kunde inte ladda planer', { description: error.message });
      } else {
        setPlans((data as unknown as Plan[]) ?? []);
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (cancelled) {
      toast('Betalningen avbröts', { description: 'Du kan välja plan igen när du är redo.' });
    }
  }, [cancelled]);

  // Företagsplaner (visas i huvudgriden) vs jobbsökar-premium (eget kort)
  const companyPlans = useMemo(
    () => plans.filter(p => p.tier !== 'jobseeker_premium'),
    [plans]
  );
  const seekerPlan = useMemo(
    () => plans.find(p => p.tier === 'jobseeker_premium') ?? null,
    [plans]
  );

  const handleSelect = (plan: Plan) => {
    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent('/valj-plan')}`);
      return;
    }
    setSelectedPlan(plan);
    setDialogOpen(true);
  };

  const headline = welcome
    ? 'Välkommen! Välj plan för att köra igång'
    : from === 'publish'
    ? 'Välj plan för att publicera din annons'
    : 'Välj plan som passar er rekrytering';

  const subline = welcome
    ? 'Ni har allt uppsatt — nu återstår bara att välja hur ni vill jobba.'
    : from === 'publish'
    ? 'Ditt utkast är sparat. Välj plan så publicerar vi direkt efteråt.'
    : 'Ingen bindningstid. Månadsvis debitering. Byt eller säg upp när du vill.';

  // Populärast-kortet: alltid Pro, men dölj märket om användaren redan har Pro.
  const userHasPro = activePlan?.tier === 'pro';

  return (
    <div
      data-valj-plan-scroll-root
      className="fixed inset-0 z-0 overflow-y-auto overflow-x-hidden bg-primary text-primary-foreground"
      style={{
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        scrollBehavior: 'smooth',
        backgroundImage:
          'linear-gradient(180deg, hsl(215 80% 22%) 0%, hsl(var(--primary)) 65svh, hsl(var(--primary)) 100%)',
      }}
    >
      {/* Dekorativa bubblor + glow — samma som resten av appen */}
      <AnimatedBackground />

      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-white/5 bg-primary/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 text-sm font-medium text-white transition-colors hover:bg-white/[0.12]"
          >
            <ArrowLeft className="h-4 w-4" />
            Tillbaka
          </button>
          <PariumLogoButton
            onClick={() => navigate('/')}
            ariaLabel="Gå till startsidan"
          />
        </div>
      </div>


      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-10 sm:pt-16">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="mx-auto max-w-3xl text-center"
        >
          <Badge className="mb-4 border-white/10 bg-white/[0.06] text-white/80">
            <Sparkles className="mr-1.5 h-3 w-3" /> Ingen bindningstid
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            {headline}
          </h1>
          <p className="mt-4 text-base text-white sm:text-lg">
            {subline}
          </p>
        </motion.div>

        {/* Trust row */}
        <div className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white">
          <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Trygg betalning</span>
          <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> Direkt access efter köp</span>
          <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Full kandidatbank i alla planer</span>
        </div>

        {/* Company plans grid */}
        <div className="mt-12 grid grid-cols-1 gap-4 sm:mt-16 md:grid-cols-2 xl:grid-cols-4">
          {loading && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[520px] animate-pulse rounded-3xl border border-white/5 bg-white/[0.03]" />
          ))}
          {!loading && companyPlans.map((plan, idx) => {
            // Populärast sitter alltid på Pro, men göms om användaren redan har Pro.
            const isRecommended = plan.tier === 'pro' && !userHasPro;
            const isCurrent = activePlan?.tier === plan.tier;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease, delay: idx * 0.06 }}
                className={`relative flex flex-col rounded-3xl border p-6 ${
                  isRecommended
                    ? 'border-secondary/40 bg-gradient-to-b from-secondary/[0.08] to-white/[0.02] shadow-[0_0_60px_-20px_rgba(233,69,96,0.3)]'
                    : 'border-white/10 bg-white/[0.03]'
                }`}
              >
                {isRecommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="border-0 bg-secondary text-white shadow-lg">Populärast</Badge>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 right-4">
                    <Badge className="border-0 bg-emerald-500/90 text-white">Din plan</Badge>
                  </div>
                )}

                <div className="mb-5">
                  <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                  <p className="mt-1 text-sm text-white">{plan.description}</p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-semibold text-white">{formatPrice(plan.price_sek)}</span>
                    <span className="text-sm text-white/60">kr</span>
                  </div>
                  <p className="mt-1 text-xs text-white">
                    {plan.billing_period === 'monthly' ? 'per månad · ex. moms' : 'engångsköp · ex. moms'}
                  </p>
                </div>

                <ul className="mb-6 flex-1 space-y-2.5">
                  {(FEATURES_BY_TIER[plan.tier] ?? plan.features).map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-white">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleSelect(plan)}
                  disabled={isCurrent}
                  className={`mt-auto inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl px-6 text-sm font-bold tracking-wide transition-all duration-300 active:scale-[0.98] disabled:opacity-60 ${
                    isRecommended
                      ? 'bg-secondary text-white shadow-[0_18px_45px_-18px_hsl(var(--secondary)/0.9)] hover:-translate-y-0.5 hover:bg-secondary hover:shadow-[0_22px_55px_-18px_hsl(var(--secondary))]'
                      : 'border border-white/20 bg-white/10 text-white hover:border-white/30 hover:bg-white/15'
                  }`}
                >
                  {isCurrent ? 'Nuvarande plan' : 'Fortsätt till betalning'}
                </Button>
              </motion.div>
            );
          })}
        </div>

        {/* Jobseeker premium card */}
        {seekerPlan && !isEmployer && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease, delay: 0.3 }}
            className="mt-8 flex flex-col items-start justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:flex-row sm:items-center"
          >
            <div>
              <Badge className="mb-2 border-white/10 bg-white/[0.06] text-white/80">För jobbsökare</Badge>
              <h3 className="text-lg font-semibold text-white">{seekerPlan.name}</h3>
              <p className="mt-1 text-sm text-white">
                {seekerPlan.description} · {formatPrice(seekerPlan.price_sek)} kr/mån
              </p>
            </div>
            <Button
              onClick={() => handleSelect(seekerPlan)}
              className="inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-6 text-sm font-bold tracking-wide text-white transition-all duration-300 hover:border-white/30 hover:bg-white/15 active:scale-[0.98] sm:w-auto"
            >
              Aktivera Premium
            </Button>
          </motion.div>
        )}

        {/* FAQ mini */}
        <div className="mx-auto mt-16 grid max-w-3xl gap-6 sm:grid-cols-2">
          {[
            { q: 'Finns bindningstid?', a: 'Nej. Alla planer är månadsvis. Säg upp eller byt när du vill.' },
            { q: 'Vad händer om jag inte förnyar?', a: 'Allt sparas — kandidatbank, chattar, gamla annonser. Bara "publicera ny annons" pausas.' },
            { q: 'Kan jag byta plan?', a: 'Ja, du kan uppgradera eller nedgradera när som helst från Inställningar → Plan.' },
            { q: 'Ingår moms?', a: 'Priserna är exklusive moms (25%). Företag drar av momsen.' },
          ].map((item, i) => (
            <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <h4 className="mb-1.5 text-sm font-semibold text-white">{item.q}</h4>
              <p className="text-sm text-white">{item.a}</p>
            </div>
          ))}
        </div>
      </div>

      <PaymentPlaceholderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        planName={selectedPlan?.name}
        priceSek={selectedPlan?.price_sek}
        billingPeriod={selectedPlan?.billing_period}
      />
    </div>
  );
}
