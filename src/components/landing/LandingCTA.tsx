import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useRef } from 'react';

const ease = [0.22, 1, 0.36, 1] as const;

const LandingCTA = () => {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] });

  const y = useTransform(scrollYProgress, [0, 0.4], [100, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.25], [0, 1]);
  const scale = useTransform(scrollYProgress, [0, 0.4], [0.85, 1]);
  const glowScale = useTransform(scrollYProgress, [0.2, 0.6], [0.5, 1.2]);
  const glowOpacity = useTransform(scrollYProgress, [0.2, 0.5], [0, 0.08]);

  const handleStart = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register' } });
  };

  return (
    <section ref={sectionRef} className="relative py-32 sm:py-40 lg:py-52 px-5 sm:px-6 md:px-12 lg:px-24 overflow-hidden" aria-label="Kom igång">
      {/* Animated background glow */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-secondary rounded-full pointer-events-none"
        style={{ scale: glowScale, opacity: glowOpacity, filter: 'blur(160px)' }}
        aria-hidden="true"
      />

      <div className="max-w-[1400px] mx-auto relative z-10">
        <motion.div style={{ y, opacity, scale }}>
          <div className="overflow-hidden mb-8">
            <motion.h2
              className="text-[2rem] sm:text-[3rem] md:text-[4.5rem] lg:text-[6rem] xl:text-[7.5rem] font-black tracking-[-0.05em] text-white uppercase leading-[0.9]"
              initial={{ y: '100%' }}
              whileInView={{ y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease }}
            >
              Redo att<br />
              <span className="bg-gradient-to-r from-secondary via-[hsl(190_100%_55%)] to-secondary bg-clip-text text-transparent">förändra</span><br />
              <span className="text-white/15">allt?</span>
            </motion.h2>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <button onClick={handleStart}
              className="group flex items-center gap-3 px-8 py-4 rounded-full bg-white text-primary font-bold text-base
                hover:shadow-[0_0_100px_rgba(255,255,255,0.12)] active:scale-[0.97] transition-all duration-300">
              Gå med i väntelistan
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
            </button>
            <span className="text-white/20 text-xs tracking-wide">Ingen kreditkort · Gratis under beta</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default LandingCTA;
