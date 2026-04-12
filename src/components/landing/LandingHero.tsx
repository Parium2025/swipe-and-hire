import { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Play } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const Globe = lazy(() => import('./Globe'));

const ease = [0.22, 1, 0.36, 1] as const;

const LandingHero = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const goTo = (role: 'job_seeker' | 'employer') => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register', role } });
  };

  return (
    <section
      className="relative min-h-[100dvh] flex items-center overflow-hidden pt-20 sm:pt-0"
      aria-label="Parium – Skandinaviens smartaste rekryteringsplattform"
    >
      {/* Radial gradient accents */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(210_80%_20%/0.5),transparent)] pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-5 sm:px-6 md:px-12 lg:px-24 w-full relative z-10">
        <div className="grid lg:grid-cols-[1fr_1fr] gap-12 lg:gap-8 items-center">
          {/* Left: Content */}
          <div className="space-y-5 sm:space-y-7 order-2 lg:order-1">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease }}
            >
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] sm:text-xs font-medium text-white/60 tracking-wide uppercase">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
                </span>
                Lansering 2026 — Early access öppen
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              className="text-[2.25rem] leading-[1.08] sm:text-5xl md:text-6xl lg:text-[3.75rem] xl:text-7xl font-bold tracking-[-0.03em] text-white"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease }}
            >
              Rekrytering{' '}
              <br className="hidden sm:block" />
              för den som{' '}
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-secondary via-[hsl(180_80%_65%)] to-secondary bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer_3s_ease-in-out_infinite]">
                  vägrar vänta
                </span>
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              className="text-[15px] sm:text-base md:text-lg text-white/50 max-w-[480px] leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25, ease }}
            >
              Parium kopplar ihop kandidater och arbetsgivare på{' '}
              <strong className="text-white/70 font-medium">sekunder</strong> — inte veckor.
              Swipea, matcha och anställ med Skandinaviens smartaste rekryteringsplattform.
            </motion.p>

            {/* CTAs */}
            <motion.div
              className="flex flex-col sm:flex-row gap-3 pt-1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4, ease }}
            >
              <button
                onClick={() => goTo('job_seeker')}
                className="group flex items-center justify-center gap-2.5 px-7 py-3.5 sm:py-4 rounded-full bg-white text-primary font-semibold text-[15px] sm:text-base
                  hover:shadow-[0_0_30px_rgba(255,255,255,0.15)] active:scale-[0.97]
                  transition-all duration-200 min-h-[48px]"
              >
                Hitta jobb nu
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
              </button>
              <button
                onClick={() => goTo('employer')}
                className="group flex items-center justify-center gap-2.5 px-7 py-3.5 sm:py-4 rounded-full bg-white/[0.04] border border-white/[0.12] text-white font-semibold text-[15px] sm:text-base
                  hover:bg-white/[0.08] hover:border-white/[0.2] active:scale-[0.97]
                  transition-all duration-200 min-h-[48px]"
              >
                Hitta kandidater
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
              </button>
            </motion.div>

            {/* Social proof */}
            <motion.div
              className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 pt-6 sm:pt-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.8 }}
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
          </div>

          {/* Right: Globe */}
          <motion.div
            className="relative flex justify-center lg:justify-end order-1 lg:order-2"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.4, delay: 0.2, ease }}
          >
            <Suspense
              fallback={
                <div className="w-[280px] sm:w-[360px] md:w-[420px] lg:w-[500px] xl:w-[560px] aspect-square rounded-full bg-white/[0.03] animate-pulse" />
              }
            >
              <Globe className="w-[280px] sm:w-[360px] md:w-[420px] lg:w-[500px] xl:w-[560px]" />
            </Suspense>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default LandingHero;
