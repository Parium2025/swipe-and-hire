import { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const Globe = lazy(() => import('./Globe'));

const LandingHero = () => {
  const navigate = useNavigate();

  const goTo = (role: 'job_seeker' | 'employer') => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register', role } });
  };

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Gradient bg */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.3),transparent)]" />

      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24 w-full relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-4 items-center">
          {/* Left: Content */}
          <div className="space-y-6 md:space-y-8 pt-24 lg:pt-0">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs sm:text-sm font-medium text-white/70 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                Lansering 2026 – Begränsat antal platser
              </span>
            </motion.div>

            <motion.h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight text-white"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              Rekrytering,{' '}
              <span className="bg-gradient-to-r from-secondary via-accent to-secondary bg-clip-text text-transparent">
                reinvented
              </span>
            </motion.h1>

            <motion.p
              className="text-base sm:text-lg md:text-xl text-white/60 max-w-lg leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25 }}
            >
              Parium matchar kandidater och arbetsgivare på sekunder – inte veckor. 
              Swipea, matcha och anställ med Skandinaviens smartaste rekryteringsplattform.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
            >
              <button
                onClick={() => goTo('job_seeker')}
                className="group flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-full bg-white text-primary font-semibold text-sm sm:text-base hover:bg-white/90 active:scale-[0.98] transition-all duration-200"
              >
                Jag söker jobb
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => goTo('employer')}
                className="group flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-full bg-white/5 border border-white/15 text-white font-semibold text-sm sm:text-base hover:bg-white/10 active:scale-[0.98] transition-all duration-200"
              >
                Jag söker personal
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>

            {/* Social proof line */}
            <motion.div
              className="flex items-center gap-3 pt-4 text-white/40 text-xs sm:text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <div className="flex -space-x-2">
                {[
                  'bg-secondary/60',
                  'bg-accent/60',
                  'bg-primary-glow/60',
                  'bg-white/20',
                ].map((bg, i) => (
                  <div
                    key={i}
                    className={`w-7 h-7 rounded-full ${bg} border-2 border-primary`}
                  />
                ))}
              </div>
              <span>Redan 500+ företag i kö för tidig tillgång</span>
            </motion.div>
          </div>

          {/* Right: Globe */}
          <motion.div
            className="relative flex justify-center lg:justify-end"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <Suspense
              fallback={
                <div className="w-[320px] sm:w-[400px] md:w-[480px] lg:w-[540px] aspect-square rounded-full bg-white/5 animate-pulse" />
              }
            >
              <Globe className="w-[320px] sm:w-[400px] md:w-[480px] lg:w-[540px]" />
            </Suspense>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default LandingHero;
