import { motion, useInView } from 'framer-motion';
import { useRef, useEffect, useState, memo } from 'react';

const stats = [
  { value: 60, suffix: 's', label: 'Genomsnittlig matchningstid' },
  { value: 500, suffix: '+', label: 'Företag i väntelistan' },
  { value: 94, suffix: '%', label: 'Nöjda beta-testare' },
  { value: 3, suffix: 'x', label: 'Snabbare än traditionellt' },
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
    <section className="relative px-5 py-16 sm:px-6 sm:py-20 md:px-12 lg:px-24 lg:py-24" aria-label="Statistik om Parium rekryteringsplattform">
      <div className="absolute inset-0 bg-white/[0.01]" />
      <div className="absolute left-1/2 top-0 h-px w-2/3 max-w-lg -translate-x-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="absolute bottom-0 left-1/2 h-px w-2/3 max-w-lg -translate-x-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="grid grid-cols-2 gap-6 sm:gap-10 lg:grid-cols-4 lg:gap-12">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="text-center"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <div className="mb-2 text-3xl font-bold leading-none tracking-tight text-white sm:text-4xl md:text-5xl lg:text-[3.5rem]">
                <AnimatedNumber value={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-white/74 sm:text-xs lg:text-sm">
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
