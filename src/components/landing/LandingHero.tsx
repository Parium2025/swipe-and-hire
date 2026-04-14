import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const ease = [0.22, 1, 0.36, 1] as const;

const LandingHero = () => {
  const navigate = useNavigate();

  const goTo = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register' } });
  };

  return (
    <section className="relative min-h-[100dvh] flex flex-col justify-center overflow-hidden pt-20 pb-8">
      {/* Background gradient orbs */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-[-30%] left-[-15%] w-[700px] h-[700px] bg-[hsl(250_70%_40%/0.12)] rounded-full blur-[160px]" />
        <div className="absolute bottom-[-20%] right-[-15%] w-[600px] h-[600px] bg-[hsl(200_80%_45%/0.08)] rounded-full blur-[140px]" />
        <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] bg-[hsl(170_70%_50%/0.05)] rounded-full blur-[100px]" />
      </div>

      {/* Horizontal lines decoration */}
      <div className="absolute top-0 left-0 right-0 h-full pointer-events-none overflow-hidden" aria-hidden="true">
        {[20, 40, 60, 80].map((pct) => (
          <div key={pct} className="absolute left-0 right-0 h-px bg-white/[0.02]" style={{ top: `${pct}%` }} />
        ))}
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-5 sm:px-6 md:px-12 w-full">
        {/* Oversized headline — editorial style */}
        <motion.div
          className="space-y-4 sm:space-y-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, ease }}
        >
          {/* Top label */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease }}
          >
            <span className="inline-flex items-center gap-3 text-[10px] sm:text-[11px] font-semibold tracking-[0.3em] uppercase text-white/30">
              <span className="w-8 sm:w-12 h-px bg-gradient-to-r from-[hsl(250_80%_70%)] to-transparent" />
              Framtidens rekrytering
            </span>
          </motion.div>

          {/* Giant headline */}
          <div className="overflow-hidden">
            <motion.h1
              className="text-[3.2rem] leading-[0.9] sm:text-[5rem] md:text-[7rem] lg:text-[9rem] xl:text-[11rem] font-black tracking-[-0.05em] text-white uppercase"
              initial={{ y: '110%' }}
              animate={{ y: 0 }}
              transition={{ duration: 1.2, ease, delay: 0.3 }}
            >
              Rekry
              <span className="bg-gradient-to-r from-[hsl(250_80%_70%)] via-[hsl(200_90%_70%)] to-[hsl(170_80%_60%)] bg-clip-text text-transparent">
                tering
              </span>
            </motion.h1>
          </div>

          <div className="overflow-hidden">
            <motion.div
              className="flex items-center gap-4 sm:gap-8"
              initial={{ y: '110%' }}
              animate={{ y: 0 }}
              transition={{ duration: 1.2, ease, delay: 0.45 }}
            >
              <h2 className="text-[2rem] leading-[0.9] sm:text-[3rem] md:text-[4.5rem] lg:text-[6rem] font-black tracking-[-0.04em] text-white/15 uppercase">
                På 60 sek
              </h2>
              {/* Accent dot */}
              <motion.div
                className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-[hsl(250_80%_70%)] flex-shrink-0"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: 1.2, ease }}
              />
            </motion.div>
          </div>
        </motion.div>

        {/* Bottom row: subline + CTA */}
        <motion.div
          className="mt-8 sm:mt-12 md:mt-16 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 sm:gap-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8, ease }}
        >
          <div className="max-w-md">
            <p className="text-white/30 text-sm sm:text-base leading-relaxed font-medium">
              Swipe. Matcha. Anställ.
              <br />
              <span className="text-white/15">
                Rekrytering som känns lika enkelt som att scrolla sociala medier.
              </span>
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <button
              onClick={goTo}
              className="group flex items-center gap-3 px-7 py-3.5 rounded-full bg-white text-[hsl(220_40%_10%)] font-semibold text-sm
                hover:shadow-[0_0_80px_rgba(255,255,255,0.1)] active:scale-[0.97] transition-all duration-300"
            >
              Kom igång gratis
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <span className="text-white/15 text-[10px] sm:text-xs tracking-wide">
              Ingen kreditkort · Gratis under beta
            </span>
          </div>
        </motion.div>
      </div>

      {/* Bottom edge line */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.5, delay: 1.2, ease }}
      />
    </section>
  );
};

export default LandingHero;
