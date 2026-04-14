import { motion, useInView } from 'framer-motion';
import { useRef, useEffect, useState, memo } from 'react';

const stats = [
  { value: 200, suffix: '+', label: 'Användare i väntelistan' },
  { value: 50, suffix: '+', label: 'Företag onboardar nu' },
  { value: 60, suffix: 's', label: 'Genomsnittlig matchningstid' },
  { value: 94, suffix: '%', label: 'Nöjda beta-testare' },
];

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

  return (
    <span ref={ref} className="tabular-nums">
      {display}{suffix}
    </span>
  );
});
AnimatedNumber.displayName = 'AnimatedNumber';

const LandingStats = () => {
  return (
    <section className="relative py-20 sm:py-24 px-5 sm:px-6 md:px-12 lg:px-24" aria-label="Social proof">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 max-w-lg h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-[hsl(250_80%_70%)] text-[11px] sm:text-xs font-semibold tracking-[0.2em] uppercase mb-4 block">
            Socialt bevis
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-white">
            Redan på allas läppar.
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-10">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="text-center p-6 rounded-2xl border border-white/[0.04] bg-white/[0.015]"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight mb-2 leading-none">
                <AnimatedNumber value={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-white/30 text-[11px] sm:text-xs font-medium tracking-wide uppercase">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LandingStats;
