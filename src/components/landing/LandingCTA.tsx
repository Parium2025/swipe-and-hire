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
    <section id="kontakt" className="relative px-5 py-24 sm:px-6 sm:py-32 md:px-12 lg:px-24 lg:py-40" aria-label="Kom igång med Parium rekryteringsplattform">
      <div className="absolute left-1/2 top-0 h-px w-2/3 max-w-lg -translate-x-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="relative mx-auto max-w-4xl text-center">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary/6 blur-[120px]" aria-hidden="true" />

        <motion.div
          className="relative z-10"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="mb-5 text-3xl font-bold tracking-[-0.03em] text-white sm:mb-6 sm:text-4xl md:text-5xl lg:text-6xl">
            Redo att förändra
            <br />
            hur du rekryterar?
          </h2>
          <p className="mx-auto mb-8 max-w-lg text-[15px] leading-relaxed text-white/82 sm:mb-10 sm:text-base md:text-lg">
            Gå med företag och kandidater som vill korta tiden från första kontakt till rätt match.
          </p>

          <Button
            variant="glass"
            onClick={handleStart}
            className="group min-h-[54px] rounded-full border-white/[0.18] bg-white/[0.12] px-8 py-4 text-base font-semibold text-white sm:text-lg"
          >
            <Sparkles className="h-5 w-5" />
            Kom igång gratis
            <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1.5" />
          </Button>

          <p className="mt-5 text-xs text-white/68">
            Ingen kreditkort krävs · Gratis under beta-perioden
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default LandingCTA;
