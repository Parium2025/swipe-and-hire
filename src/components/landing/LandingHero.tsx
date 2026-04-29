import { type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { SplineScene } from '@/components/ui/spline-scene';

type LandingHeroProps = {
  scrollContainerRef: RefObject<HTMLDivElement>;
};

const ease = [0.22, 1, 0.36, 1] as const;
const splineScene = 'https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode';

const MatchPreview = () => (
  <motion.div
    className="relative mx-auto h-[34rem] w-full max-w-[40rem] overflow-visible sm:h-[38rem] lg:h-[42rem]"
    initial={{ opacity: 0, y: 28, scale: 0.96 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.85, ease, delay: 0.15 }}
  >
    <div
      className="pointer-events-auto absolute -inset-x-28 -inset-y-20 z-0 opacity-100 sm:-inset-x-36 sm:-inset-y-24 lg:-inset-x-48 lg:-inset-y-28"
      style={{
        WebkitMaskImage: 'radial-gradient(ellipse at 55% 50%, black 0%, black 46%, transparent 74%)',
        maskImage: 'radial-gradient(ellipse at 55% 50%, black 0%, black 46%, transparent 74%)',
      }}
    >
      <SplineScene scene={splineScene} className="h-full w-full" />
    </div>
    <div className="pointer-events-none absolute -inset-24 z-[1] bg-[radial-gradient(ellipse_at_56%_50%,transparent_0%,transparent_54%,hsl(var(--primary)/0.45)_84%,hsl(var(--primary)/0.78)_100%)]" />
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
