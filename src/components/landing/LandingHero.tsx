import { lazy, Suspense, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

const Globe = lazy(() => import('./Globe'));

const LandingHero = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });

  const contentOpacity = useTransform(scrollYProgress, [0, 0.45], [1, 0.72]);
  const contentScale = useTransform(scrollYProgress, [0, 0.45], [1, 0.985]);
  const globeY = useTransform(scrollYProgress, [0, 1], [0, isMobile ? 30 : 70]);

  const goTo = (role: 'job_seeker' | 'employer') => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register', role } });
  };

  const heroPills = ['AI-screening', 'Swipe-matchning', 'Direktmeddelanden'];

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[100dvh] flex items-center overflow-hidden"
      aria-label="Parium – AI-driven rekryteringsplattform för kandidater och arbetsgivare i Norden"
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(220_100%_11%)_0%,hsl(214_100%_14%)_46%,hsl(205_100%_16%)_100%)]" />
        <div className="absolute left-[-10%] top-[18%] h-[42vh] w-[36vw] rounded-full bg-accent/5 blur-[120px]" />
        <div className="absolute right-[-6%] top-1/2 h-[72vh] w-[52vw] -translate-y-1/2 rounded-full bg-secondary/10 blur-[140px]" />
        <div className="absolute top-[8%] right-[6%] h-[68vw] w-[68vw] max-h-[1100px] max-w-[1100px] rounded-full border border-white/[0.04]" />
        <div className="absolute top-[15%] right-[13%] h-[54vw] w-[54vw] max-h-[880px] max-w-[880px] rounded-full border border-white/[0.03]" />
      </div>

      <motion.div
        className="absolute inset-y-0 right-0 left-[38%] sm:left-[44%] lg:left-auto lg:w-[min(68vw,1080px)] pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, delay: 0.2 }}
        style={{ y: globeY }}
        aria-hidden="true"
      >
        <div className="absolute inset-y-1/2 right-0 h-[125vw] w-[125vw] max-h-[1180px] max-w-[1180px] -translate-y-1/2 sm:h-[100vw] sm:w-[100vw] lg:h-[1060px] lg:w-[1060px] xl:h-[1120px] xl:w-[1120px]">
          <Suspense fallback={<div className="h-full w-full rounded-full bg-white/[0.03]" />}>
            <Globe className="h-full w-full" />
          </Suspense>
        </div>
      </motion.div>

      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-primary via-primary/85 to-transparent pointer-events-none z-[1]" />

      <motion.div
        className="relative z-10 max-w-7xl mx-auto w-full px-5 sm:px-6 md:px-12 lg:px-24 pt-28 sm:pt-32"
        style={{ opacity: contentOpacity, scale: contentScale }}
      >
        <div className="max-w-[580px]">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.2 }}>
            <span className="inline-flex items-center gap-2.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-white/80 sm:text-xs">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-secondary" />
              </span>
              Lansering 2026 — Early access öppen
            </span>
          </motion.div>

          <motion.h1
            className="mt-7 text-[2.7rem] font-bold leading-[0.98] tracking-[-0.05em] text-white sm:text-[3.8rem] md:text-[4.5rem] lg:text-[5.35rem]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.35 }}
          >
            Rekrytering
            <br />
            för bolag som
            <br />
            <span className="bg-gradient-to-r from-white via-secondary to-white bg-clip-text text-transparent bg-[length:220%_auto] animate-[shimmer_5s_linear_infinite]">
              vägrar vänta.
            </span>
          </motion.h1>

          <motion.p
            className="mt-6 max-w-[540px] text-[15px] leading-[1.75] text-white/82 sm:text-base md:text-[17px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            Parium är en AI-driven rekryteringsplattform för företag och kandidater i Sverige och Norden.
            Swipea, matcha, chatta och anställ snabbare med video-profiler, smart screening och direkt kontakt i ett flöde.
          </motion.p>

          <motion.div
            className="mt-6 flex flex-wrap gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.62 }}
          >
            {heroPills.map((pill) => (
              <span
                key={pill}
                className="inline-flex min-h-[36px] items-center rounded-full border border-white/[0.1] bg-white/[0.04] px-3.5 text-[12px] font-medium text-white/88"
              >
                {pill}
              </span>
            ))}
          </motion.div>

          <motion.div
            className="mt-9 flex flex-col gap-3 sm:flex-row"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.74 }}
          >
            <Button
              variant="glass"
              onClick={() => goTo('job_seeker')}
              className="group min-h-[54px] rounded-full border-white/[0.18] bg-white/[0.12] px-7 py-4 text-base font-semibold text-white shadow-[0_0_80px_hsl(var(--secondary)/0.10)]"
            >
              <Sparkles className="h-4 w-4" />
              Hitta jobb nu
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Button>
            <Button
              variant="glass"
              onClick={() => goTo('employer')}
              className="group min-h-[54px] rounded-full px-7 py-4 text-base font-semibold text-white"
            >
              Hitta kandidater
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Button>
          </motion.div>

          <motion.div
            className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.9 }}
          >
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2.5">
                {['bg-white', 'bg-white/90', 'bg-secondary', 'bg-white/20'].map((item, i) => (
                  <div key={i} className={`h-8 w-8 rounded-full border-2 border-primary ${item}`} />
                ))}
              </div>
              <span className="text-[13px] text-white/76">
                <span className="font-semibold text-white">500+</span> företag i väntelistan
              </span>
            </div>
            <div className="hidden h-5 w-px bg-white/[0.12] sm:block" />
            <div className="flex items-center gap-1.5 text-white/84">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg key={star} className="h-3.5 w-3.5 fill-white text-white" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
              <span className="ml-1 text-[13px] text-white/76">4.9/5 från tidiga användare</span>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};

export default LandingHero;
