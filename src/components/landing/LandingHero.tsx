import { type PointerEvent, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useScroll, useSpring, useTransform } from 'framer-motion';
import { ArrowRight, BriefcaseBusiness, CheckCircle2, MapPin, Users } from 'lucide-react';
import iphoneFrame from '@/assets/parium-iphone-frame.png';

type LandingHeroProps = {
  scrollContainerRef: RefObject<HTMLDivElement>;
};

const ease = [0.22, 1, 0.36, 1] as const;

const PhoneShowcase = ({ scrollContainerRef }: { scrollContainerRef: RefObject<HTMLDivElement> }) => {
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const { scrollYProgress } = useScroll({ container: scrollContainerRef });
  const smoothX = useSpring(pointerX, { stiffness: 110, damping: 18, mass: 0.35 });
  const smoothY = useSpring(pointerY, { stiffness: 110, damping: 18, mass: 0.35 });
  const pointerRotateY = useTransform(smoothX, [-1, 1], [-14, 14]);
  const pointerRotateX = useTransform(smoothY, [-1, 1], [9, -9]);
  const scrollRotateY = useTransform(scrollYProgress, [0, 0.22], [-8, 5]);
  const scrollRotateX = useTransform(scrollYProgress, [0, 0.22], [7, -3]);
  const rotateY = useTransform([pointerRotateY, scrollRotateY], ([pointer, scroll]) => Number(pointer) + Number(scroll));
  const rotateX = useTransform([pointerRotateX, scrollRotateX], ([pointer, scroll]) => Number(pointer) + Number(scroll));
  const phoneY = useTransform(scrollYProgress, [0, 0.24], [0, -54]);
  const glassY = useTransform(scrollYProgress, [0, 0.24], [0, 36]);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set(((event.clientX - rect.left) / rect.width - 0.5) * 2);
    pointerY.set(((event.clientY - rect.top) / rect.height - 0.5) * 2);
  };

  const resetPointer = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  return (
    <motion.div
      className="relative mx-auto flex w-full max-w-[25rem] justify-center sm:max-w-[29rem] lg:max-w-[34rem]"
      initial={{ opacity: 0, y: 34 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease, delay: 0.08 }}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      style={{ perspective: 1400 }}
    >
      <motion.div className="absolute inset-x-4 top-8 h-72 rounded-full bg-secondary/20 blur-[95px]" style={{ y: glassY }} />
      <motion.div className="absolute bottom-2 left-1/2 h-28 w-64 -translate-x-1/2 rounded-full bg-primary/70 blur-[42px]" style={{ y: phoneY }} />
      <motion.div className="absolute left-8 top-12 h-24 w-44 rounded-[2rem] border border-white/10 bg-white/[0.035] shadow-[0_24px_90px_hsl(var(--primary)/0.22)] backdrop-blur-2xl" style={{ y: glassY, rotateY: -18, rotateX: 8, transformStyle: 'preserve-3d' }} />
      <motion.div className="absolute bottom-24 right-4 h-28 w-48 rounded-[2rem] border border-secondary/15 bg-secondary/[0.055] shadow-[0_24px_90px_hsl(var(--secondary)/0.16)] backdrop-blur-2xl" style={{ y: phoneY, rotateY: 22, rotateX: -8, transformStyle: 'preserve-3d' }} />

      <motion.div
        className="relative w-[18rem] max-w-[72vw] transform-gpu sm:w-[21.5rem] lg:w-[23rem]"
        style={{ rotateX, rotateY, y: phoneY, transformStyle: 'preserve-3d' }}
      >
        <div className="absolute left-[8.7%] top-[2.3%] h-[94.4%] w-[82.4%] overflow-hidden rounded-[2.25rem] bg-gradient-parium sm:rounded-[2.9rem]">
          <div className="absolute inset-0 opacity-80">
            <div className="absolute left-6 top-14 h-24 w-24 rounded-full bg-secondary/20 blur-3xl" />
            <div className="absolute bottom-12 right-4 h-28 w-28 rounded-full bg-primary-glow/25 blur-3xl" />
          </div>
          <div className="relative flex h-full flex-col px-5 pb-6 pt-16 text-white sm:px-6 sm:pt-20">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-secondary/75">Parium</span>
              <span className="rounded-full bg-secondary/15 px-3 py-1 text-[10px] font-bold text-secondary">Live match</span>
            </div>
            <h2 className="text-3xl font-black leading-[0.96] tracking-[-0.02em] sm:text-4xl">Rätt match. Mindre brus.</h2>
            <p className="mt-3 text-sm leading-6 text-white/58">En upplevelse byggd för både kandidater och arbetsgivare.</p>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-3 backdrop-blur-xl">
                <Users className="mb-3 h-4 w-4 text-secondary" />
                <p className="text-lg font-black">Jobbsökare</p>
                <p className="mt-1 text-[11px] leading-4 text-white/45">Hitta roller som faktiskt passar.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-3 backdrop-blur-xl">
                <BriefcaseBusiness className="mb-3 h-4 w-4 text-secondary" />
                <p className="text-lg font-black">Arbetsgivare</p>
                <p className="mt-1 text-[11px] leading-4 text-white/45">Se kandidater med hög relevans.</p>
              </div>
            </div>

            <div className="mt-auto space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-xl">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary/15 text-sm font-black">P</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">Produktdesigner</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-white/45"><MapPin className="h-3.5 w-3.5" /> Stockholm · Hybrid</p>
                  </div>
                  <span className="rounded-full bg-secondary/15 px-2.5 py-1 text-xs font-bold text-secondary">96%</span>
                </div>
              </div>
              <div className="rounded-2xl border border-secondary/20 bg-secondary/10 p-4 backdrop-blur-xl">
                <p className="flex items-center gap-2 text-sm font-bold"><CheckCircle2 className="h-4 w-4 text-secondary" /> Matchning redo</p>
              </div>
            </div>
          </div>
        </div>
        <img src={iphoneFrame} alt="Parium iPhone-förhandsvisning" className="relative z-10 block h-auto w-full select-none drop-shadow-[0_34px_90px_hsl(var(--primary)/0.75)]" draggable={false} />
        <div className="pointer-events-none absolute inset-[3%] z-20 rounded-[2.7rem] bg-gradient-to-br from-white/18 via-transparent to-white/5 opacity-60" />
        <div className="pointer-events-none absolute -right-8 top-16 z-0 h-[72%] w-10 rounded-full bg-white/10 blur-xl" style={{ transform: 'translateZ(-70px)' }} />
      </motion.div>
    </motion.div>
  );
};

const LandingHero = ({ scrollContainerRef }: LandingHeroProps) => {
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
        <PhoneShowcase scrollContainerRef={scrollContainerRef} />
      </div>
    </section>
  );
};

export default LandingHero;
