import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const Globe = lazy(() => import('./Globe'));

const ease = [0.22, 1, 0.36, 1] as const;

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.16, delayChildren: 0.55 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 40, filter: 'blur(12px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 1.2, ease } },
};

const scaleReveal = {
  hidden: { opacity: 0, scale: 0.9, filter: 'blur(16px)' },
  show: { opacity: 1, scale: 1, filter: 'blur(0px)', transition: { duration: 1.6, ease } },
};

const headlines = [
  { main: 'Rekrytering', pre: 'för den som', accent: 'vägrar vänta' },
  { main: 'Matcha talang', pre: 'med AI —', accent: 'på sekunder' },
  { main: 'Framtidens', pre: 'rekrytering', accent: 'börjar här' },
];

const LandingHero = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [headlineIdx, setHeadlineIdx] = useState(0);

  useEffect(() => {
    if (isMobile) return;

    const timer = setInterval(() => {
      setHeadlineIdx((i) => (i + 1) % headlines.length);
    }, 4500);

    return () => clearInterval(timer);
  }, [isMobile]);

  const goTo = (role: 'job_seeker' | 'employer') => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register', role } });
  };

  const h = headlines[isMobile ? 0 : headlineIdx];

  return (
    <section
      className="relative h-[100dvh] flex items-center justify-center overflow-hidden"
      aria-label="Parium – Skandinaviens smartaste rekryteringsplattform"
    >
      {/* Globe: NASA Earth at Night with CSS pan */}
      <motion.div
        className="absolute inset-0 pointer-events-none will-change-transform overflow-hidden flex items-start justify-center"
        style={{ paddingTop: '4vh' }}
        variants={isMobile ? undefined : scaleReveal}
        initial={isMobile ? undefined : 'hidden'}
        animate={isMobile ? undefined : 'show'}
      >
        <Suspense fallback={null}>
          <Globe className="w-full h-full absolute inset-0" />
        </Suspense>
      </motion.div>

      {/* Cinematic vignette */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_68%_62%_at_50%_54%,transparent_46%,hsl(220_55%_10%/0.16)_100%)]" />
        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-primary/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-primary/28 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-5 sm:px-6 md:px-12 w-full text-center">
        <motion.div
          className="space-y-6 sm:space-y-8"
          variants={isMobile ? undefined : stagger}
          initial={isMobile ? undefined : 'hidden'}
          animate={isMobile ? undefined : 'show'}
        >
          {/* Badge */}
          <motion.div variants={isMobile ? undefined : fadeUp}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.08] border border-white/[0.12] text-[11px] sm:text-xs font-medium text-white/60 tracking-widest uppercase shadow-[0_12px_40px_rgba(0,0,0,0.24)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
              </span>
              Lansering 2026 — Early access öppen
            </span>
          </motion.div>

          {/* Rotating headline */}
          <motion.div variants={isMobile ? undefined : fadeUp} className="min-h-[130px] sm:min-h-[170px] md:min-h-[200px] flex items-center justify-center">
            {isMobile ? (
              <h1 className="text-[2.75rem] leading-[1.02] sm:text-6xl md:text-7xl lg:text-8xl xl:text-[6.5rem] font-bold tracking-[-0.04em] text-white [text-shadow:0_4px_40px_rgba(0,0,0,0.8),0_0_80px_rgba(0,0,0,0.4)]">
                {h.main}
                <br />
                <span className="text-white/50 font-medium">{h.pre} </span>
                <span className="bg-gradient-to-r from-secondary via-[hsl(180_80%_65%)] to-secondary bg-clip-text text-transparent">
                  {h.accent}
                </span>
              </h1>
            ) : (
              <AnimatePresence mode="wait">
                <motion.h1
                  key={headlineIdx}
                  className="text-[2.5rem] leading-[1.05] sm:text-6xl md:text-7xl lg:text-8xl xl:text-[6.5rem] font-bold tracking-[-0.04em] text-white [text-shadow:0_4px_40px_rgba(0,0,0,0.8),0_0_80px_rgba(0,0,0,0.4)]"
                  initial={{ opacity: 0, y: 30, scale: 0.97, filter: 'blur(16px)' }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: { duration: 0.9, ease } }}
                  exit={{ opacity: 0, y: -24, scale: 1.02, filter: 'blur(10px)', transition: { duration: 0.45, ease } }}
                >
                  {h.main}
                  <br />
                  <span className="text-white/50 font-medium">{h.pre} </span>
                  <span className="bg-gradient-to-r from-secondary via-[hsl(180_80%_65%)] to-secondary bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer_3s_ease-in-out_infinite]">
                    {h.accent}
                  </span>
                </motion.h1>
              </AnimatePresence>
            )}
          </motion.div>

          {/* Subheadline */}
          <motion.p
            className="text-[15px] sm:text-lg md:text-xl text-white/45 max-w-[560px] mx-auto leading-relaxed [text-shadow:0_2px_20px_rgba(0,0,0,0.7)]"
            variants={isMobile ? undefined : fadeUp}
          >
            Parium kopplar ihop kandidater och arbetsgivare på{' '}
            <strong className="text-white/75 font-medium">sekunder</strong> — inte veckor.
            Swipea, matcha och anställ med Skandinaviens smartaste plattform.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="flex flex-col sm:flex-row gap-3 justify-center pt-2"
            variants={isMobile ? undefined : fadeUp}
          >
            <button
              onClick={() => goTo('job_seeker')}
              className="group flex items-center justify-center gap-2.5 px-8 py-4 rounded-full bg-white text-primary font-semibold text-[15px] sm:text-base
                shadow-[0_0_60px_rgba(255,255,255,0.15)] hover:shadow-[0_0_80px_rgba(255,255,255,0.3)] active:scale-[0.97]
                transition-all duration-300 min-h-[48px]"
            >
              Hitta jobb nu
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-300" />
            </button>
            <button
              onClick={() => goTo('employer')}
              className="group flex items-center justify-center gap-2.5 px-8 py-4 rounded-full bg-white/[0.06] border border-white/[0.15] text-white font-semibold text-[15px] sm:text-base
                hover:bg-white/[0.12] hover:border-white/[0.25] active:scale-[0.97]
                shadow-[0_12px_40px_rgba(0,0,0,0.22)] transition-all duration-300 min-h-[48px]"
            >
              Hitta kandidater
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-300" />
            </button>
          </motion.div>

          {/* Social proof */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 pt-4"
            variants={isMobile ? undefined : fadeUp}
          >
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2.5">
                {['bg-gradient-to-br from-secondary to-accent', 'bg-gradient-to-br from-accent to-primary-glow', 'bg-gradient-to-br from-primary-glow to-secondary', 'bg-white/15'].map((bg, i) => (
                  <div key={i} className={`w-8 h-8 rounded-full ${bg} border-2 border-primary ring-1 ring-white/5`} />
                ))}
              </div>
              <div className="text-white/40 text-[13px] leading-snug">
                <span className="text-white/70 font-medium">500+</span> företag i kön
              </div>
            </div>
            <div className="hidden sm:block w-px h-6 bg-white/10" />
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg key={star} className="w-3.5 h-3.5 text-secondary fill-secondary" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
              <span className="text-white/40 text-[13px] ml-1">4.9/5 betyg</span>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      {!isMobile && (
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3, duration: 1.5 }}
        >
          <motion.div
            className="w-6 h-10 rounded-full border-2 border-white/20 flex justify-center pt-2"
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="w-1 h-2 rounded-full bg-white/40" />
          </motion.div>
        </motion.div>
      )}
    </section>
  );
};

export default LandingHero;
