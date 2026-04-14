import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useRef } from 'react';

const ease = [0.22, 1, 0.36, 1] as const;

const LandingCTA = () => {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] });

  const y = useTransform(scrollYProgress, [0, 0.4], [120, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.25], [0, 1]);
  const scale = useTransform(scrollYProgress, [0, 0.4], [0.82, 1]);
  const glowScale = useTransform(scrollYProgress, [0.15, 0.6], [0.3, 1.3]);
  const glowOpacity = useTransform(scrollYProgress, [0.15, 0.5], [0, 0.1]);

  const handleStart = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register' } });
  };

  return (
    <section ref={sectionRef} className="relative py-36 sm:py-48 lg:py-64 px-5 sm:px-6 md:px-12 lg:px-24 overflow-hidden" aria-label="Kom igång">
      {/* Background glow */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px] bg-secondary rounded-full pointer-events-none"
        style={{ scale: glowScale, opacity: glowOpacity, filter: 'blur(180px)' }}
        aria-hidden="true"
      />

      <div className="max-w-[1400px] mx-auto relative z-10">
        <motion.div style={{ y, opacity, scale }}>
          <div className="overflow-hidden mb-10">
            <motion.h2
              className="text-[2.2rem] sm:text-[3.5rem] md:text-[5rem] lg:text-[7rem] xl:text-[8.5rem] font-black tracking-[-0.05em] text-white uppercase leading-[0.88]"
              initial={{ y: '110%' }}
              whileInView={{ y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease }}
            >
              Redo att<br />
              <span className="bg-gradient-to-r from-secondary via-[hsl(190_100%_55%)] to-secondary bg-clip-text text-transparent">förändra</span><br />
              <span className="text-white/10">allt?</span>
            </motion.h2>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <button onClick={handleStart}
              className="group relative flex items-center gap-3 px-9 py-4.5 rounded-full bg-white text-primary font-bold text-base
                hover:shadow-[0_0_120px_rgba(255,255,255,0.1)] active:scale-[0.97] transition-all duration-300">
              <span className="absolute inset-0 rounded-full bg-white/20 animate-landing-cta-pulse" />
              <span className="relative z-10 flex items-center gap-3">
                Gå med i väntelistan
                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
              </span>
            </button>
            <span className="text-white/18 text-xs tracking-wider">Ingen kreditkort · Gratis under beta</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default LandingCTA;
