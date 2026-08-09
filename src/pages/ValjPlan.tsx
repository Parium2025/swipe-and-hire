import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useHasActivePlan, type PlanTier } from '@/hooks/useHasActivePlan';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PaymentPlaceholderDialog } from '@/components/PaymentPlaceholderDialog';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { isOwnerEmail } from '@/lib/ownerAccess';
import FaqAccordion from '@/components/seo/FaqAccordion';

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
  const [allFeaturesOpen, setAllFeaturesOpen] = useState(false);
  const [activeTier, setActiveTier] = useState<PlanTier | null>(null);

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

  // Har användaren redan en aktiv plan? Då ska sidan inte vara nåbar.
  // Ägare (admin) får alltid access för att kunna granska sidan.
  const isOwner = isOwnerEmail(user?.email);
  useEffect(() => {
    if (activePlan && !cancelled && !isOwner) {
      navigate('/', { replace: true });
    }
  }, [activePlan, cancelled, navigate, isOwner]);

  // Prenumerationsplaner (huvudgrid) — engångsköp visas separat under
  const subscriptionPlans = useMemo(
    () => plans.filter(p => p.tier !== 'jobseeker_premium' && p.billing_period !== 'one_time'),
    [plans]
  );
  const oneTimePlan = useMemo(
    () => plans.find(p => p.billing_period === 'one_time' && p.tier !== 'jobseeker_premium') ?? null,
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

  // Ägare ser sidan som en helt ny kund — dölj "Nuvarande plan"-tillstånd
  // så vi kan verifiera exakt hur nya besökare upplever sidan.
  const displayActivePlan = isOwner ? null : activePlan;

  // Populärast-kortet: alltid Pro, men dölj märket om användaren redan har Pro.
  const userHasPro = displayActivePlan?.tier === 'pro';

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

      {/* Minimal header — endast kryss (går tillbaka till annonsen/föregående sida) */}
      <div className="sticky top-0 z-20 bg-transparent">
        <div className="mx-auto flex max-w-6xl items-center justify-end px-4 py-4">
          <button
            type="button"
            onClick={() => {
              // Kom du från publiceringsflödet? Gå tillbaka till annonsen (utkastet är sparat).
              if (from === 'publish') {
                navigate(-1);
              } else {
                navigate(user ? '/home' : '/', { replace: true });
              }
            }}
            aria-label="Stäng"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white transition-colors hover:bg-white/[0.12]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-4 sm:pt-8">
        {/* Kompakt intro — centrerad, större & grövre rubrik */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="mx-auto max-w-3xl text-center"
        >
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl md:text-6xl">
            {headline}
          </h1>
          <p className="mt-4 text-base leading-7 text-white sm:text-lg">
            {subline}
          </p>
        </motion.div>

        {/* Prenumerationsplaner — speglar exakt landningens pricing-grid */}
        <div className="relative mt-10 grid gap-5 sm:mt-12 md:grid-cols-3">
          {loading && Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[420px] animate-pulse rounded-3xl border border-white/5 bg-white/[0.03]" />
          ))}
          {!loading && subscriptionPlans.map((plan, i) => {
            const isRecommended = plan.tier === 'pro' && !userHasPro;
            const isActive = activeTier === plan.tier || (activeTier === null && isRecommended);
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.85, ease, delay: 0.1 + i * 0.08 }}
                onPointerDownCapture={() => setActiveTier(plan.tier)}
                onFocusCapture={() => setActiveTier(plan.tier)}
                onClick={() => setActiveTier(plan.tier)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTier(plan.tier); } }}
                className={`landing-feature-card relative isolate cursor-pointer overflow-hidden rounded-3xl border p-8 transition-all duration-300 hover:scale-[1.02] hover:border-secondary/40 [@media_(hover:hover)]:backdrop-blur-xl ${
                  isActive ? 'border-secondary bg-white/5' : 'border-white/15 bg-white/5'
                }`}
              >
                {isRecommended && (
                  <span className="absolute right-6 top-6 z-10 rounded-full bg-secondary/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                    Populär
                  </span>
                )}
                <motion.div
                  animate={{ y: isActive ? -12 : 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                  className={isActive ? 'drop-shadow-[0_24px_40px_rgba(0,0,0,0.25)]' : ''}
                >
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  <p className="mt-2 text-4xl font-black text-white">
                    {formatPrice(plan.price_sek)} kr<span className="text-sm font-medium text-white">/mån</span>
                  </p>
                  <p className="mt-1 text-xs font-medium text-white">exkl. moms</p>
                  <p className="mt-4 text-sm leading-7 text-white">{plan.description}</p>
                  <PlanFeatures
                    features={FEATURES_BY_TIER[plan.tier] ?? plan.features}
                    isActive={isActive}
                    open={allFeaturesOpen}
                    onToggle={() => setAllFeaturesOpen(v => !v)}
                  />
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        {/* Universell 14-dagars-rad */}
        {!loading && subscriptionPlans.length > 0 && (
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.1 }}
            className="mt-6 text-center text-sm text-white"
          >
            Alla annonser är aktiva i 14 dagar. Inga bindningstider — säg upp när ni vill.
          </motion.p>
        )}

        {/* Gemensam CTA som följer det valda paketet */}
        {!loading && subscriptionPlans.length > 0 && (() => {
          const fallback = subscriptionPlans.find(p => p.tier === 'pro') ?? subscriptionPlans[subscriptionPlans.length - 1];
          const selected = subscriptionPlans.find(p => p.tier === activeTier) ?? fallback;
          const isCurrent = displayActivePlan?.tier === selected.tier;
          return (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease, delay: 0.2 }}
              whileHover={{ scale: isCurrent ? 1 : 1.03 }}
              whileTap={{ scale: isCurrent ? 1 : 0.98 }}
              onClick={() => { if (!isCurrent) handleSelect(selected); }}
              disabled={isCurrent}
              className="mx-auto mt-8 flex w-full max-w-sm min-h-[56px] items-center justify-center rounded-2xl bg-secondary px-8 text-sm font-bold text-white shadow-[0_18px_45px_-18px_hsl(var(--secondary)/0.9)] transition-all duration-300 hover:shadow-[0_22px_55px_-18px_hsl(var(--secondary))] disabled:opacity-60"
            >
              {isCurrent ? 'Nuvarande plan' : `Välj ${selected.name}`}
            </motion.button>
          );
        })()}

        {/* Engångspaket — separat block, identiskt med landningen */}
        {!loading && oneTimePlan && (
          <motion.div
            initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.85, ease, delay: 0.1 }}
            className="mt-14"
          >
            <div className="mx-auto max-w-3xl rounded-3xl border border-white/15 bg-white/5 p-8 md:flex md:items-center md:justify-between md:gap-8 [@media_(hover:hover)]:backdrop-blur-xl">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-secondary/85">
                  Behöver ni bara rekrytera en gång?
                </span>
                <h3 className="mt-3 text-2xl font-bold text-white">{oneTimePlan.name}</h3>
                <p className="mt-3 max-w-md text-sm leading-7 text-white">
                  {oneTimePlan.description ?? 'Publicera en enskild annons som ligger uppe i 14 dagar. Perfekt när ni bara söker en person och inte behöver ett löpande abonnemang.'}
                </p>
                <p className="mt-4 text-3xl font-black text-white">
                  {formatPrice(oneTimePlan.price_sek)} kr<span className="ml-1 text-sm font-medium text-white">/annons</span>
                </p>
                <p className="mt-1 text-xs font-medium text-white">exkl. moms</p>
              </div>
              <button
                type="button"
                onClick={() => handleSelect(oneTimePlan)}
                className="mt-6 w-full min-h-[56px] rounded-2xl bg-secondary px-8 text-sm font-bold text-white shadow-[0_18px_45px_-18px_hsl(var(--secondary)/0.9)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_55px_-18px_hsl(var(--secondary))] active:scale-[0.98] md:mt-0 md:w-auto md:min-w-[220px]"
              >
                Publicera annons
              </button>
            </div>
          </motion.div>
        )}

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

        {/* Vanliga frågor — samma accordion-stuk som på landningen */}
        <section className="mx-auto mt-20 max-w-[1180px]">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-[0.32em] text-secondary/85">Vanliga frågor</span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl">
              Frågor & svar
            </h2>
          </div>
          <div className="mt-10 grid gap-3 md:grid-cols-2">
            {[
              {
                q: 'Finns det någon bindningstid?',
                a: 'Nej. Alla månadspaket löper månadsvis utan bindningstid — ni kan byta plan eller säga upp när ni vill. Enkelannonsen är ett engångsköp helt utan abonnemang.',
              },
              {
                q: 'Vad händer om jag inte förnyar?',
                a: 'Allt sparas — kandidatbank, chattar och gamla annonser ligger kvar. Det enda som pausas är möjligheten att publicera nya annonser tills ni aktiverar en plan igen.',
              },
              {
                q: 'Kan jag byta plan?',
                a: 'Ja, ni kan uppgradera eller nedgradera när som helst från Inställningar → Plan. Ändringen träder i kraft omedelbart och vi justerar debiteringen proportionerligt.',
              },
              {
                q: 'Ingår moms?',
                a: 'Priserna är exklusive moms. 25 % moms läggs på i checkouten och specificeras på fakturan. Momsregistrerade företag drar av den som ingående moms som vanligt.',
              },
              {
                q: 'Hur betalar vi?',
                a: 'Med kort direkt i checkouten. Månadspaket dras automatiskt varje månad från kortet ni registrerar, enkelannonsen betalas en gång. För större volymer eller längre avtal kan vi ordna fakturabetalning — hör av er till hej@parium.se.',
              },
              {
                q: 'När kan vi publicera efter att planen aktiverats?',
                a: 'Direkt. Så fort betalningen är godkänd låses publicering upp och ni kan lägga ut er första annons på några minuter. Annonsen ligger sedan live i 14 dagar.',
              },

            ].map(({ q, a }, i) => (
              <motion.div
                key={q}
                initial={{ opacity: 0, x: 60 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.7, ease, delay: 0.12 + i * 0.06 }}
                className="landing-faq-card"
              >
                <FaqAccordion q={q} a={a} />
              </motion.div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-white">
            Fler frågor om Parium?{' '}
            <Link to="/arbetsgivare#faq" className="font-semibold text-secondary underline-offset-4 hover:underline">
              Se alla vanliga frågor för arbetsgivare
            </Link>
          </p>
        </section>
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
