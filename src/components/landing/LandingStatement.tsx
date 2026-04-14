import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

const LandingStatement = () => {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 0.5, 1], [100, 0, -50]);
  const opacity = useTransform(scrollYProgress, [0, 0.25, 0.75, 1], [0, 1, 1, 0.2]);
  const scale = useTransform(scrollYProgress, [0, 0.4, 1], [0.88, 1, 0.96]);
  const rotateX = useTransform(scrollYProgress, [0, 0.35], [10, 0]);

  // SVG ring scale
  const ringScale = useTransform(scrollYProgress, [0, 0.5, 1], [0.4, 1, 1.4]);
  const ringOpacity = useTransform(scrollYProgress, [0, 0.3, 0.8], [0, 0.06, 0]);

  return (
    <section ref={ref} className="relative py-28 sm:py-40 lg:py-56 px-5 sm:px-6 md:px-12 lg:px-24 overflow-hidden">
      {/* Animated SVG rings */}
      <motion.div
        className="absolute inset-0 pointer-events-none flex items-center justify-center"
        aria-hidden="true"
        style={{ scale: ringScale, opacity: ringOpacity }}
      >
        <svg className="w-[900px] h-[900px]" viewBox="0 0 900 900" fill="none">
          <circle cx="450" cy="450" r="400" stroke="hsl(var(--secondary))" strokeWidth="0.5" />
          <circle cx="450" cy="450" r="300" stroke="hsl(var(--secondary))" strokeWidth="0.3" />
          <circle cx="450" cy="450" r="200" stroke="hsl(var(--secondary))" strokeWidth="0.2" />
        </svg>
      </motion.div>

      <div className="max-w-[1400px] mx-auto relative z-10" style={{ perspective: '1200px' }}>
        <motion.div className="text-center" style={{ y, opacity, scale, rotateX }}>
          <motion.p
            className="text-[1.8rem] sm:text-[2.8rem] md:text-[4rem] lg:text-[5rem] font-black leading-[1.05] tracking-[-0.04em] uppercase"
          >
            <span className="text-white/20 italic line-through decoration-secondary/30 decoration-2">Traditionell</span>{' '}
            <span className="text-white">rekrytering</span>
            <br />
            <span className="text-white/80">är </span>
            <span className="bg-gradient-to-r from-secondary to-[hsl(190_100%_55%)] bg-clip-text text-transparent italic">död</span>
            <span className="text-white/80">.</span>
            <br />
            <span className="text-white/15 text-[0.6em]">Välkommen till framtiden.</span>
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
};

export default LandingStatement;
