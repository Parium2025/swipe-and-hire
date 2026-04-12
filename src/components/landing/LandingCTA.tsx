import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';

const LandingCTA = () => {
  const navigate = useNavigate();

  const handleStart = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register' } });
  };

  return (
    <section className="relative py-24 sm:py-32 lg:py-40 px-5 sm:px-6 md:px-12 lg:px-24" aria-label="Kom igång med Parium rekryteringsplattform">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 max-w-lg h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <div className="max-w-4xl mx-auto text-center relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-secondary/[0.06] rounded-full blur-[150px] pointer-events-none" aria-hidden="true" />

        <motion.div
          className="relative z-10"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-[-0.03em] text-white mb-5 sm:mb-6">
            Redo att förändra
            <br />
            <span className="bg-gradient-to-r from-secondary via-[hsl(180_80%_65%)] to-secondary bg-clip-text text-transparent">
              hur du rekryterar?
            </span>
          </h2>
          <p className="text-white/40 text-[15px] sm:text-base md:text-lg max-w-lg mx-auto mb-8 sm:mb-10 leading-relaxed">
            Gå med tusentals företag och jobbsökare som redan upptäckt framtidens rekrytering.
            Helt gratis under lanseringsperioden.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleStart}
              className="group inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full
                bg-gradient-to-r from-secondary to-accent text-primary font-semibold text-base sm:text-lg
                hover:shadow-[0_0_50px_hsl(var(--secondary)/0.3)] active:scale-[0.97]
                transition-all duration-300 min-h-[52px] overflow-hidden relative"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative z-10 flex items-center gap-3">
                <Sparkles className="w-5 h-5" />
                Kom igång gratis
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform duration-200" />
              </span>
            </button>
          </div>

          <p className="text-white/25 text-xs mt-5">
            Ingen kreditkort krävs · Gratis under hela beta-perioden
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default LandingCTA;
