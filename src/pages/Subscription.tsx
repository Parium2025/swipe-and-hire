import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Star } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PremiumUpgradeDialog } from '@/components/PremiumUpgradeDialog';
import { useIsMobile } from '@/hooks/use-mobile';

const ease = [0.16, 1, 0.3, 1] as const;

function PlanFeatures({ features, isActive }: { features: string[]; isActive: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-6 border-t border-white/10 pt-5">
      <button
        type="button"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
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
            <motion.ul
              className="mt-4 space-y-3"
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.045, delayChildren: 0.08 } },
              }}
            >
              {features.map((feature) => (
                <motion.li
                  key={feature}
                  variants={{
                    hidden: { opacity: 0, y: -6 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease } },
                  }}
                  className="flex items-start gap-3 text-sm leading-6 text-white"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className={`mt-0.5 h-4 w-4 flex-shrink-0 ${isActive ? 'text-secondary' : 'text-white/70'}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="4 10 8.5 14.5 16 6.5" />
                  </svg>
                  <span>{feature}</span>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const Subscription = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [currentPlan] = useState<'basic' | 'premium'>('basic');
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'premium'>('premium');
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  const plans = [
    {
      id: 'basic' as const,
      name: 'Start',
      price: '0',
      tagline: 'Allt du behöver för att börja söka jobb.',
      features: [
        'Skapa profil med CV och videopresentation',
        'Bläddra bland alla jobb',
        'Sökfilter på plats, roll och erfarenhet',
        'Visa intresse för upp till 3 jobb i veckan',
        'Spara upp till 3 jobb samtidigt',
        'Chatta med arbetsgivare',
      ],
      icon: Star,
    },
    {
      id: 'premium' as const,
      name: 'Premium',
      price: '29',
      tagline: 'För dig som menar allvar med jobbsökandet.',
      features: [
        'Skapa profil med CV och videopresentation',
        'Bläddra bland alla jobb',
        'Sökfilter på plats, roll och erfarenhet',
        'Visa intresse för hur många jobb du vill',
        'Spara obegränsat antal jobb',
        'Chatta med arbetsgivare',
        'Se vilka företag som tittat på din profil',
        'Direktkontakt till arbetsgivaren via mejl',
        'Statistik över profilvisningar senaste 30 dagarna',
      ],
      icon: Crown,
    },
  ];

  return (
    <div className="responsive-container-wide space-y-8 animate-fade-in [padding-bottom:calc(env(safe-area-inset-bottom,0px)+50px)]">
      <div className="text-center mb-2">
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Abonnemang</h1>
        <p className="text-sm text-white/70 mt-1">
          Hantera ditt abonnemang och uppgradera din plan
        </p>
      </div>

      {/* Current Plan Status */}
      <div className="rounded-3xl border border-white/15 bg-white/5 backdrop-blur-xl p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {currentPlan === 'premium' ? (
              <Crown className="h-5 w-5 text-white shrink-0" />
            ) : (
              <Star className="h-5 w-5 text-white shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-semibold text-white truncate">
                {plans.find((p) => p.id === currentPlan)?.name} Plan
              </p>
              <p className="text-xs text-white/70 truncate">
                {user?.created_at
                  ? `Aktiv sedan ${new Date(user.created_at).toLocaleDateString('sv-SE', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}`
                  : 'Aktiv plan'}
              </p>
            </div>
          </div>
          <span className="inline-flex rounded-full bg-secondary/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
            Aktiv
          </span>
        </div>
      </div>

      {/* Plans header */}
      <div>
        <h2 className="text-lg font-semibold text-white">Tillgängliga abonnemang</h2>
      </div>

      {/* Plans grid — matchar landningssidan */}
      <div className="relative grid gap-5 md:grid-cols-2">
        {plans.map((plan) => {
          const isActive = selectedPlan === plan.id;
          const isCurrent = plan.id === currentPlan;
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease }}
              onPointerDownCapture={() => setSelectedPlan(plan.id)}
              onFocusCapture={() => setSelectedPlan(plan.id)}
              onClick={() => setSelectedPlan(plan.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedPlan(plan.id);
                }
              }}
              className={`relative isolate cursor-pointer rounded-3xl border p-6 sm:p-8 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 ${
                isActive
                  ? 'border-secondary bg-white/5'
                  : 'border-white/15 bg-white/5 hover:border-secondary/25'
              }`}
            >
              {plan.id === 'premium' && (
                <span className="absolute right-6 top-6 rounded-full bg-secondary/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                  Populär
                </span>
              )}


              <h3 className="text-xl font-bold text-white">{plan.name}</h3>
              <p className="mt-2 text-4xl font-black text-white">
                {plan.price} kr<span className="text-sm font-medium text-white">/mån</span>
              </p>
              <p className="mt-4 text-sm leading-7 text-white">{plan.tagline}</p>

              <PlanFeatures features={plan.features} isActive={isActive} />

              <button
                type="button"
                disabled={isCurrent}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (plan.id === 'premium' && !isCurrent) {
                    try { sessionStorage.setItem('parium-pending-plan', 'premium'); } catch {}
                    try { sessionStorage.setItem('parium-checkout-origin', 'subscription'); } catch {}
                    navigate('/checkout');
                  }
                }}
                className={`mt-7 flex w-full min-h-[52px] items-center justify-center rounded-2xl px-6 text-sm font-bold tracking-wide transition-all duration-300 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${
                  isCurrent
                    ? 'bg-white/10 text-white border border-white/20'
                    : plan.id === 'premium'
                    ? 'bg-secondary text-white shadow-[0_18px_45px_-18px_hsl(var(--secondary)/0.9)] hover:shadow-[0_22px_55px_-18px_hsl(var(--secondary))] hover:-translate-y-0.5'
                    : 'bg-white/10 text-white border border-white/20 hover:bg-white/15 hover:border-white/30'
                }`}
              >
                {isCurrent ? 'Nuvarande plan' : plan.id === 'premium' ? 'Bli Premium' : 'Kom igång gratis'}
              </button>
            </motion.div>
          );
        })}
      </div>

      <PremiumUpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        isAppOverride={isMobile}
      />
    </div>
  );
};

export default Subscription;
