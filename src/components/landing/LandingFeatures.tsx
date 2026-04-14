import { motion, useInView } from 'framer-motion';
import { useRef, useEffect, useState, memo } from 'react';
import { Zap, Brain, Smartphone } from 'lucide-react';

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
    icon: Zap,
    accent: 'hsl(250 80% 70%)',
  },
  {
    metric: 94,
    suffix: '%',
    title: 'Matchning',
    description: 'Algoritmerna lär sig vad du letar efter. Varje swipe gör matchningen smartare.',
    icon: Brain,
    accent: 'hsl(200 90% 70%)',
  },
  {
    metric: 100,
    suffix: '%',
    title: 'Mobilt',
    description: 'Byggt för mobilen först. Rekrytera var du än är.',
    icon: Smartphone,
    accent: 'hsl(170 80% 60%)',
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

      <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <motion.div
              key={f.title}
              className="group relative bg-white/[0.015] p-8 sm:p-10 rounded-2xl sm:rounded-3xl border border-white/[0.04] hover:border-white/[0.10] hover:bg-white/[0.03] transition-all duration-500 overflow-hidden"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1, ease }}
            >
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-8 border"
                style={{
                  backgroundColor: `${f.accent.replace(')', ' / 0.08)')}`,
                  borderColor: `${f.accent.replace(')', ' / 0.15)')}`,
                }}
              >
                <Icon className="w-5 h-5" style={{ color: f.accent }} strokeWidth={1.5} />
              </div>

              {/* Metric */}
              <div className="text-[4rem] sm:text-[5rem] font-black leading-none tracking-[-0.06em] bg-gradient-to-b from-white to-white/20 bg-clip-text text-transparent mb-4">
                <AnimatedValue value={f.metric} suffix={f.suffix} />
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-white mb-2 tracking-tight uppercase">
                {f.title}
              </h3>
              <p className="text-white/25 text-sm leading-relaxed">{f.description}</p>

              {/* Hover glow */}
              <div
                className="absolute -bottom-20 -right-20 w-40 h-40 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                style={{ backgroundColor: `${f.accent.replace(')', ' / 0.08)')}` }}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  </section>
);

export default LandingFeatures;
