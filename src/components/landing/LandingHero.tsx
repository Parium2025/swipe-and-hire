import { type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, BriefcaseBusiness, CheckCircle2, MapPin, Sparkles, Users } from 'lucide-react';

type LandingHeroProps = {
  scrollContainerRef: RefObject<HTMLDivElement>;
};

const ease = [0.22, 1, 0.36, 1] as const;

const MatchPreview = () => (
  <motion.div
    className="relative mx-auto w-full max-w-[21rem] sm:max-w-[24rem]"
    initial={{ opacity: 0, y: 28, scale: 0.96 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.85, ease, delay: 0.15 }}
  >
    <div className="relative rounded-[2rem] border border-white/10 bg-primary/80 p-3 shadow-[0_30px_100px_hsl(var(--primary)/0.65)] backdrop-blur-2xl">
      <div className="rounded-[1.45rem] border border-white/10 bg-white/[0.035] p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">Matchning</p>
            <h2 className="mt-1 text-xl font-black text-white">Produktdesigner</h2>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-secondary/20 bg-secondary/10">
            <Sparkles className="h-5 w-5 text-secondary" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary/15 text-sm font-black text-white">A</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">Astra Studio</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-white/45"><MapPin className="h-3.5 w-3.5" /> Stockholm · Hybrid</p>
              </div>
              <span className="rounded-full bg-secondary/15 px-2.5 py-1 text-xs font-bold text-secondary">94%</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {['UI/UX', 'Fast roll', '52–62k'].map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/60">{item}</span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <Users className="mb-3 h-4 w-4 text-secondary" />
              <p className="text-lg font-black text-white">12</p>
              <p className="text-xs text-white/40">nya kandidater</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <BriefcaseBusiness className="mb-3 h-4 w-4 text-secondary" />
              <p className="text-lg font-black text-white">8</p>
              <p className="text-xs text-white/40">jobb som passar</p>
            </div>
          </div>

          <div className="rounded-2xl border border-secondary/20 bg-secondary/10 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-white"><CheckCircle2 className="h-4 w-4 text-secondary" /> Ni matchar</p>
            <p className="mt-1 text-xs leading-relaxed text-white/45">Starta konversationen direkt och boka nästa steg när det passar.</p>
          </div>
        </div>
      </div>
    </div>
  </motion.div>
);

const LandingHero = ({ scrollContainerRef: _scrollContainerRef }: LandingHeroProps) => {
  const navigate = useNavigate();

  const handleStart = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register' } });
  };

  return (
    <section className="relative min-h-[100svh] overflow-hidden px-5 pb-16 pt-28 sm:px-6 md:px-12 lg:px-24" aria-labelledby="landing-hero-heading">
      <div className="relative z-10 mx-auto grid min-h-[calc(100svh-11rem)] max-w-[1400px] items-center gap-12 lg:grid-cols-[1.08fr_0.92fr]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease }}
          className="max-w-4xl"
        >
          <span className="inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary/70">
            <span className="h-px w-10 bg-gradient-to-r from-secondary to-transparent" />
            Rekrytering som känns enkel
          </span>
          <h1 id="landing-hero-heading" className="mt-6 text-[3.25rem] font-black leading-[0.95] tracking-[-0.03em] text-white sm:text-[4.8rem] md:text-[6.4rem] lg:text-[7.2rem]">
            Hitta rätt jobb. Rätt kandidat.
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-8 text-white/60 sm:text-lg">
            Parium samlar jobbsökare och arbetsgivare i ett modernt flöde där matchningar, dialog och nästa steg sker utan krångel.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <motion.button
              type="button"
              onPointerDown={handleStart}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group inline-flex min-h-touch items-center justify-center gap-3 rounded-full bg-secondary px-7 py-3.5 text-sm font-bold text-secondary-foreground shadow-[0_18px_55px_hsl(var(--secondary)/0.28)] transition-shadow hover:shadow-[0_22px_70px_hsl(var(--secondary)/0.36)]"
            >
              Kom igång gratis
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </motion.button>
            <a href="#hur-det-fungerar" className="inline-flex min-h-touch items-center justify-center rounded-full border border-white/10 bg-white/[0.035] px-7 py-3.5 text-sm font-bold text-white/80 transition-colors hover:bg-white/[0.065]">
              Se hur det fungerar
            </a>
          </div>
        </motion.div>
        <MatchPreview />
      </div>
    </section>
  );
};

export default LandingHero;
