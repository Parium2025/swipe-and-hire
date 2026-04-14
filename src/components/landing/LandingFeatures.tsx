import { motion, useInView } from 'framer-motion';
import { useRef, useEffect, useState, memo } from 'react';

const ease = [0.22, 1, 0.36, 1] as const;

const AnimatedValue = memo(({ value, suffix }: { value: number; suffix: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 2200;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, value]);

  return (
    <span ref={ref} className="tabular-nums">
      {display}
      {suffix}
    </span>
  );
});
AnimatedValue.displayName = 'AnimatedValue';

const features = [
  {
    metric: 10,
    suffix: 'x',
    title: 'Snabbare',
    description: 'Från ansökan till anställning på dagar — inte veckor.',
  },
  {
    metric: 94,
    suffix: '%',
    title: 'Matchning',
    description: 'Algoritmerna lär sig vad du letar efter. Varje swipe gör matchningen smartare.',
  },
  {
    metric: 100,
    suffix: '%',
    title: 'Mobilt',
    description: 'Byggt för mobilen först. Rekrytera var du än är.',
  },
];

const LandingFeatures = () => (
  <section
    id="funktioner"
    className="relative py-24 sm:py-32 lg:py-40 px-5 sm:px-6 md:px-12 lg:px-24"
    aria-labelledby="features-heading"
  >
    <div className="max-w-[1400px] mx-auto">
      <motion.div
        className="mb-16 sm:mb-24"
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease }}
      >
        <span className="inline-flex items-center gap-3 text-[10px] sm:text-[11px] font-semibold tracking-[0.3em] uppercase text-white/30">
          <span className="w-8 sm:w-12 h-px bg-gradient-to-r from-[hsl(250_80%_70%)] to-transparent" />
          Varför Parium
        </span>
        <h2
          id="features-heading"
          className="mt-4 text-3xl sm:text-5xl md:text-6xl font-black tracking-[-0.04em] text-white uppercase"
        >
          Rekrytering,
          <span className="text-white/15"> reinvented.</span>
        </h2>
      </motion.div>

      {/* Feature blocks — full width rows */}
      <div className="grid md:grid-cols-3 gap-px bg-white/[0.03] rounded-3xl overflow-hidden border border-white/[0.04]">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            className="bg-[hsl(220_20%_4%)] p-8 sm:p-12 flex flex-col justify-between min-h-[260px] sm:min-h-[320px] group hover:bg-white/[0.02] transition-colors duration-500"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: i * 0.1, ease }}
          >
            <div className="text-[3.5rem] sm:text-[5rem] md:text-[6rem] font-black leading-none tracking-[-0.06em] bg-gradient-to-b from-white to-white/20 bg-clip-text text-transparent">
              <AnimatedValue value={f.metric} suffix={f.suffix} />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2 tracking-tight uppercase">
                {f.title}
              </h3>
              <p className="text-white/25 text-sm leading-relaxed">{f.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default LandingFeatures;
