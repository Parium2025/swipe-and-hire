import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { useRef, useEffect, useState, memo } from 'react';

const ease = [0.22, 1, 0.36, 1] as const;

const AnimatedNumber = memo(({ value, suffix }: { value: number; suffix: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 2000;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 5);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, value]);

  return <span ref={ref} className="tabular-nums">{display}{suffix}</span>;
});
AnimatedNumber.displayName = 'AnimatedNumber';

const stats = [
  { value: 200, suffix: '+', label: 'Användare i väntelistan' },
  { value: 50, suffix: '+', label: 'Företag onboardar' },
  { value: 60, suffix: 's', label: 'Snitt matchningstid' },
  { value: 94, suffix: '%', label: 'Nöjda beta-testare' },
];

const LandingStats = () => {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });

  const y = useTransform(scrollYProgress, [0, 0.4], [60, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.25], [0, 1]);
  const scale = useTransform(scrollYProgress, [0, 0.4], [0.9, 1]);

  return (
    <section ref={ref} className="relative py-20 sm:py-28 px-5 sm:px-6 md:px-12 lg:px-24" aria-label="Statistik">
      <div className="max-w-[1400px] mx-auto">
        <motion.div
          style={{ y, opacity, scale }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.03] rounded-2xl sm:rounded-3xl overflow-hidden border border-white/[0.04]"
        >
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="bg-primary p-6 sm:p-10 text-center hover:bg-white/[0.02] transition-colors duration-500"
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1, ease }}
            >
              <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-[-0.04em] mb-2 leading-none">
                <AnimatedNumber value={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-white/30 text-[10px] sm:text-xs font-semibold tracking-[0.15em] uppercase">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default LandingStats;
