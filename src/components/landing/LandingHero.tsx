import { lazy, Suspense, useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const Globe = lazy(() => import('./Globe'));

const ease = [0.22, 1, 0.36, 1] as const;

const LandingHero = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const sectionRef = useRef<HTMLElement>(null);

  // Parallax: globe moves up slightly on scroll
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });
  const globeY = useTransform(scrollYProgress, [0, 1], [0, isMobile ? 40 : 80]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const goTo = (role: 'job_seeker' | 'employer') => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register', role } });
  };

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[100dvh] flex items-center overflow-hidden pt-20 sm:pt-0"
      aria-label="Parium – Skandinaviens smartaste rekryteringsplattform"
    >
      {/* Layered radial gradients for depth */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-20%,hsl(210_80%_18%/0.6),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_80%_at_80%_50%,hsl(200_90%_15%/0.4),transparent)]" />
      </div>
      {/* Bottom fade to next section */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-primary to-transparent pointer-events-none" />

      <motion.div
        className="max-w-7xl mx-auto px-5 sm:px-6 md:px-12 lg:px-24 w-full relative z-10"
        style={{ opacity: contentOpacity }}
      >
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-6 items-center">
          {/* Content */}
          <div className="space-y-5 sm:space-y-6 md:space-y-7 order-2 lg:order-1">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease }}
            >
              <span className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.07] text-[11px] sm:text-xs font-medium text-white/50 tracking-[0.08em] uppercase">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
                </span>
                Lansering 2026 — Early access öppen
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              className="text-[2.5rem] leading-[1.05] sm:text-[3.25rem] md:text-[3.75rem] lg:text-[4rem] xl:text-[4.5rem] font-bold tracking-[-0.035em] text-white"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.1, ease }}
            >
              Rekrytering
              <br />
              för den som
              <br />
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-secondary via-[hsl(180_80%_65%)] to-secondary bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer_4s_ease-in-out_infinite]">
                  vägrar vänta
                </span>
                {/* Underline accent */}
                <motion.span
                  className="absolute -bottom-1 left-0 right-0 h-[3px] bg-gradient-to-r from-secondary/80 via-accent/60 to-transparent rounded-full"
                  initial={{ scaleX: 0, originX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 1.2, delay: 0.8, ease }}
                />
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              className="text-[15px] sm:text-base md:text-[17px] text-white/45 max-w-[460px] leading-[1.7]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease }}
            >
              Parium kopplar ihop kandidater och arbetsgivare på{' '}
              <strong className="text-white/65 font-medium">sekunder</strong> — inte veckor.
              Swipea, matcha och anställ med Skandinaviens smartaste rekryteringsplattform.
            </motion.p>

            {/* CTAs */}
            <motion.div
              className="flex flex-col sm:flex-row gap-3 pt-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.45, ease }}
            >
              <button
                onClick={() => goTo('job_seeker')}
                className="group relative flex items-center justify-center gap-2.5 px-7 py-4 rounded-full bg-white text-primary font-semibold text-[15px] sm:text-base
                  hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] active:scale-[0.97]
                  transition-all duration-200 min-h-[52px] overflow-hidden"
              >
                {/* Hover shimmer */}
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <span className="relative z-10 flex items-center gap-2.5">
                  Hitta jobb nu
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                </span>
              </button>
              <button
                onClick={() => goTo('employer')}
                className="group flex items-center justify-center gap-2.5 px-7 py-4 rounded-full bg-white/[0.03] border border-white/[0.1] text-white font-semibold text-[15px] sm:text-base
                  hover:bg-white/[0.07] hover:border-white/[0.18] active:scale-[0.97]
                  transition-all duration-200 min-h-[52px]"
              >
                Hitta kandidater
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
              </button>
            </motion.div>

            {/* Social proof */}
            <motion.div
              className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 pt-5 sm:pt-7"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.8 }}
            >
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2.5">
                  {['from-secondary to-accent', 'from-accent to-primary-glow', 'from-primary-glow to-secondary', 'from-white/10 to-white/20'].map((grad, i) => (
                    <div key={i} className={`w-8 h-8 rounded-full bg-gradient-to-br ${grad} border-2 border-primary ring-1 ring-white/[0.04]`} />
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

          {/* Globe */}
          <motion.div
            className="relative flex justify-center lg:justify-end order-1 lg:order-2"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.6, delay: 0.15, ease }}
            style={{ y: globeY }}
          >
            <Suspense
              fallback={
                <div className="w-[300px] sm:w-[380px] md:w-[450px] lg:w-[520px] xl:w-[580px] aspect-square rounded-full bg-white/[0.02]" />
              }
            >
              <Globe className="w-[300px] sm:w-[380px] md:w-[450px] lg:w-[520px] xl:w-[580px]" />
            </Suspense>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};

export default LandingHero;
