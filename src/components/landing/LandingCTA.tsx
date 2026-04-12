import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LandingCTA = () => {
  const navigate = useNavigate();

  const handleStart = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register' } });
  };

  return (
    <section id="kontakt" className="relative py-24 sm:py-32 lg:py-40 px-5 sm:px-6 md:px-12 lg:px-24" aria-label="Kom igång med Parium rekryteringsplattform">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 max-w-lg h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-4xl mx-auto text-center relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-secondary/[0.04] rounded-full blur-[120px] pointer-events-none" aria-hidden="true" />

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
          <p className="text-white/35 text-[15px] sm:text-base md:text-lg max-w-lg mx-auto mb-8 sm:mb-10 leading-relaxed">
            Gå med tusentals företag och jobbsökare som redan upptäckt framtidens rekrytering.
            Helt gratis under lanseringsperioden.
          </p>

          <Button
            variant="secondary"
            onClick={handleStart}
            className="group rounded-full px-8 py-4 h-auto text-base sm:text-lg font-semibold min-h-[52px] gap-3"
          >
            <Sparkles className="w-5 h-5" />
            Kom igång gratis
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform duration-200" />
          </Button>

          <p className="text-white/20 text-xs mt-5">
            Ingen kreditkort krävs · Gratis under hela beta-perioden
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default LandingCTA;
