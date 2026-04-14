import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const ease = [0.22, 1, 0.36, 1] as const;

const LandingCTA = () => {
  const navigate = useNavigate();

  const handleStart = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register' } });
  };

  return (
    <section className="relative py-32 sm:py-40 lg:py-52 px-5 sm:px-6 md:px-12 lg:px-24 overflow-hidden" aria-label="Kom igång">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-[hsl(250_60%_40%/0.08)] rounded-full blur-[160px]" />
      </div>

      {/* Flowing SVG lines */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" aria-hidden="true">
        <svg className="w-full h-full" viewBox="0 0 800 400" fill="none" preserveAspectRatio="xMidYMid slice">
          <path d="M0,200 Q200,50 400,200 T800,200" stroke="hsl(250 80% 70%)" strokeWidth="0.6" />
          <circle cx="400" cy="200" r="150" stroke="hsl(200 90% 70%)" strokeWidth="0.4" />
        </svg>
      </div>

      <div className="max-w-[1400px] mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease }}
        >
          <div className="overflow-hidden mb-8">
            <motion.h2
              className="text-[2rem] sm:text-[3rem] md:text-[4.5rem] lg:text-[6rem] xl:text-[7.5rem] font-black tracking-[-0.05em] text-white uppercase leading-[0.9]"
              initial={{ y: '100%' }}
              whileInView={{ y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease }}
            >
              Redo att
              <br />
              <span className="bg-gradient-to-r from-[hsl(250_80%_70%)] via-[hsl(200_90%_70%)] to-[hsl(170_80%_60%)] bg-clip-text text-transparent">
                förändra
              </span>
              <br />
              <span className="text-white/15">allt?</span>
            </motion.h2>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <button
              onClick={handleStart}
              className="group flex items-center gap-3 px-8 py-4 rounded-full bg-white text-[hsl(220_40%_10%)] font-bold text-base
                hover:shadow-[0_0_100px_rgba(255,255,255,0.12)] active:scale-[0.97] transition-all duration-300"
            >
              Gå med i väntelistan
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
            </button>
            <span className="text-white/15 text-xs tracking-wide">
              Ingen kreditkort · Gratis under beta
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default LandingCTA;
