import { lazy, Suspense, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const Globe = lazy(() => import('./Globe'));

const ease = [0.22, 1, 0.36, 1] as const;

const LandingHero = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });
  const globeY = useTransform(scrollYProgress, [0, 1], [0, isMobile ? 60 : 120]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.4], [1, 0]);

  const goTo = (role: 'job_seeker' | 'employer') => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register', role } });
  };

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[100dvh] flex items-center overflow-hidden"
      aria-label="Parium – Skandinaviens smartaste rekryteringsplattform för snabb jobbmatchning"
    >
      {/* Globe as massive background element */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center lg:justify-end pointer-events-none"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, delay: 0.1, ease }}
        style={{ y: globeY }}
        aria-hidden="true"
      >
        <div className="relative w-[90vw] h-[90vw] sm:w-[75vw] sm:h-[75vw] md:w-[65vw] md:h-[65vw] lg:w-[55vw] lg:h-[55vw] xl:w-[50vw] xl:h-[50vw] max-w-[800px] max-h-[800px] lg:translate-x-[10%] xl:translate-x-[15%]">
          <Suspense
            fallback={
              <div className="w-full h-full rounded-full bg-white/[0.02] animate-pulse" />
            }
          >
            <Globe className="w-full h-full pointer-events-auto" />
          </Suspense>
        </div>
      </motion.div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-primary via-primary/80 to-transparent pointer-events-none z-[1]" />

      {/* Content overlay */}
      <motion.div
        className="relative z-10 max-w-7xl mx-auto px-5 sm:px-6 md:px-12 lg:px-24 w-full pt-28 sm:pt-32 lg:pt-0"
        style={{ opacity: contentOpacity }}
      >
        <div className="max-w-2xl">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease }}
          >
            <span className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] sm:text-xs font-medium text-white/50 tracking-[0.08em] uppercase backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
              </span>
              Lansering 2026 — Early access öppen
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            className="mt-6 sm:mt-8 text-[2.5rem] leading-[1.05] sm:text-[3.5rem] md:text-[4rem] lg:text-[4.5rem] xl:text-[5rem] font-bold tracking-[-0.04em] text-white"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.5, ease }}
          >
            Rekrytering
            <br />
            för den som
            <br />
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-secondary via-[hsl(180_80%_65%)] to-secondary bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer_4s_ease-in-out_infinite]">
                vägrar vänta
              </span>
              <motion.span
                className="absolute -bottom-1.5 left-0 right-0 h-[3px] bg-gradient-to-r from-secondary/80 via-accent/60 to-transparent rounded-full"
                initial={{ scaleX: 0, originX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1.2, delay: 1.2, ease }}
              />
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            className="mt-5 sm:mt-7 text-[15px] sm:text-base md:text-[17px] text-white/45 max-w-[480px] leading-[1.7]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7, ease }}
          >
            Parium kopplar ihop kandidater och arbetsgivare på{' '}
            <strong className="text-white/65 font-medium">sekunder</strong> — inte veckor.
            Swipea, matcha och anställ med Skandinaviens smartaste rekryteringsplattform.
          </motion.p>

          {/* CTAs - dark premium style, no white buttons */}
          <motion.div
            className="flex flex-col sm:flex-row gap-3 mt-8 sm:mt-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.9, ease }}
          >
            <button
              onClick={() => goTo('job_seeker')}
              className="group relative flex items-center justify-center gap-2.5 px-7 py-4 rounded-full
                bg-gradient-to-r from-secondary to-accent text-primary font-semibold text-[15px] sm:text-base
                hover:shadow-[0_0_50px_hsl(var(--secondary)/0.3)] active:scale-[0.97]
                transition-all duration-300 min-h-[52px] overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative z-10 flex items-center gap-2.5">
                <Sparkles className="w-4 h-4" />
                Hitta jobb nu
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
              </span>
            </button>
            <button
              onClick={() => goTo('employer')}
              className="group flex items-center justify-center gap-2.5 px-7 py-4 rounded-full
                bg-white/[0.05] border border-white/[0.12] text-white font-semibold text-[15px] sm:text-base
                hover:bg-white/[0.1] hover:border-white/[0.2] active:scale-[0.97]
                transition-all duration-300 min-h-[52px] backdrop-blur-sm"
            >
              Hitta kandidater
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
            </button>
          </motion.div>

          {/* Social proof */}
          <motion.div
            className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mt-10 sm:mt-14"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.3, duration: 0.8 }}
          >
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2.5">
                {['from-secondary to-accent', 'from-accent to-primary-glow', 'from-primary-glow to-secondary', 'from-white/10 to-white/20'].map((grad, i) => (
                  <div key={i} className={`w-8 h-8 rounded-full bg-gradient-to-br ${grad} border-2 border-primary ring-1 ring-white/[0.06]`} />
                ))}
              </div>
              <div className="text-white/35 text-[13px]">
                <span className="text-white/60 font-medium">500+</span> företag i kön
              </div>
            </div>
            <div className="hidden sm:block w-px h-5 bg-white/[0.08]" />
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg key={star} className="w-3.5 h-3.5 text-secondary fill-secondary" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
              <span className="text-white/35 text-[13px] ml-1">4.9/5 betyg</span>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};

export default LandingHero;
