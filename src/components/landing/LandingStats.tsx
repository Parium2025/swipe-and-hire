import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { useRef, useEffect, useState, memo } from 'react';

const ease = [0.22, 1, 0.36, 1] as const;

const AnimatedNumber = memo(({ value, suffix }: { value: number; suffix: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 1600;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, value]);

  return <span ref={ref} className="tabular-nums">{display}{suffix}</span>;
});
AnimatedNumber.displayName = 'AnimatedNumber';

const stats = [
  { value: 60, suffix: 's', label: 'att visa intresse' },
  { value: 2, suffix: 'x', label: 'tydligare urval' },
  { value: 24, suffix: '/7', label: 'tillgängligt flöde' },
  { value: 1, suffix: '', label: 'samlad process' },
];

const LandingStats = () => {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 0.4], [56, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.22], [0, 1]);

  return (
    <section ref={ref} className="relative px-5 py-20 sm:px-6 sm:py-28 md:px-12 lg:px-24" aria-label="Parium i siffror">
      <motion.div style={{ y, opacity }} className="mx-auto max-w-[1400px] overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-xl">
        <div className="grid gap-px bg-white/[0.05] sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="bg-primary/75 p-7 text-center sm:p-9"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.65, delay: i * 0.08, ease }}
            >
              <div className="mb-3 text-4xl font-black leading-none tracking-[-0.035em] text-white sm:text-5xl">
                <AnimatedNumber value={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
};

export default LandingStats;
