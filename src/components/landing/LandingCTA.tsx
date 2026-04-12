import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const LandingCTA = () => {
  const navigate = useNavigate();

  const handleStart = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register' } });
  };

  return (
    <section className="relative py-24 sm:py-32 px-6 md:px-12 lg:px-24">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="max-w-4xl mx-auto text-center">
        {/* Glow behind */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[500px] h-[300px] bg-secondary/10 rounded-full blur-[120px]" />
        </div>

        <motion.div
          className="relative z-10"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-6">
            Redo att förändra hur du{' '}
            <span className="bg-gradient-to-r from-secondary via-accent to-secondary bg-clip-text text-transparent">
              rekryterar?
            </span>
          </h2>
          <p className="text-white/50 text-base sm:text-lg max-w-xl mx-auto mb-10">
            Gå med i de 500+ företag som redan väntar på att uppleva framtidens rekrytering. 
            Helt gratis under lanseringsperioden.
          </p>

          <button
            onClick={handleStart}
            className="group inline-flex items-center gap-3 px-8 py-4 rounded-full bg-white text-primary font-semibold text-base sm:text-lg hover:bg-white/90 active:scale-[0.98] transition-all duration-200 shadow-2xl shadow-white/10"
          >
            Kom igång gratis
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </div>
    </section>
  );
};

export default LandingCTA;
