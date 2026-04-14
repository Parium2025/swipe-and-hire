import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

const ease = [0.22, 1, 0.36, 1] as const;

const LandingStatement = () => {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 0.5, 1], [120, 0, -40]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0.3]);
  const scale = useTransform(scrollYProgress, [0, 0.4, 1], [0.85, 1, 0.95]);
  const rotateX = useTransform(scrollYProgress, [0, 0.4], [8, 0]);

  // Decorative circle scale on scroll
  const circleScale = useTransform(scrollYProgress, [0, 0.5, 1], [0.5, 1, 1.3]);
  const circleOpacity = useTransform(scrollYProgress, [0, 0.3, 0.8], [0, 0.04, 0]);

  return (
    <section ref={ref} className="relative py-24 sm:py-36 lg:py-48 px-5 sm:px-6 md:px-12 lg:px-24 overflow-hidden">
      {/* Animated SVG decoration */}
      <motion.div
        className="absolute inset-0 pointer-events-none flex items-center justify-center"
        aria-hidden="true"
        style={{ scale: circleScale, opacity: circleOpacity }}
      >
        <svg className="w-[800px] h-[800px]" viewBox="0 0 800 800" fill="none">
          <circle cx="400" cy="400" r="350" stroke="hsl(var(--secondary))" strokeWidth="0.5" />
          <circle cx="400" cy="400" r="250" stroke="hsl(var(--secondary))" strokeWidth="0.4" />
          <circle cx="400" cy="400" r="150" stroke="hsl(var(--secondary))" strokeWidth="0.3" />
        </svg>
      </motion.div>

      <div className="max-w-[1400px] mx-auto relative z-10" style={{ perspective: '1000px' }}>
        <motion.div className="text-center" style={{ y, opacity, scale, rotateX }}>
          <motion.p
            className="text-[1.6rem] sm:text-[2.5rem] md:text-[3.5rem] lg:text-[4.5rem] font-black leading-[1.1] tracking-[-0.03em] text-white/90 uppercase"
          >
            <span className="italic text-white/25 line-through decoration-secondary/40 decoration-2">Omdefiniera</span>{' '}
            <span className="text-white">rekrytering,</span>
            <br />
            <span className="text-white/90">kämpa för </span>
            <span className="bg-gradient-to-r from-secondary to-[hsl(190_100%_55%)] bg-clip-text text-transparent italic">matchningar</span>,
            <br />
            <span className="text-white/90">bygga en </span>
            <span className="bg-gradient-to-r from-[hsl(190_100%_55%)] to-secondary bg-clip-text text-transparent italic">framtid</span>
            <br />
            <span className="text-white/30">i rekrytering — on &amp; off screen.</span>
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
};

export default LandingStatement;
