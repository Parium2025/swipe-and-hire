import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { useRef, useEffect, useState, memo } from 'react';
import { Zap, Brain, Smartphone } from 'lucide-react';
import { StaggerReveal, StaggerItem } from './ScrollReveal';

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

  return <span ref={ref} className="tabular-nums">{display}{suffix}</span>;
});
AnimatedValue.displayName = 'AnimatedValue';

const features = [
  { metric: 10, suffix: 'x', title: 'Snabbare', description: 'Från ansökan till anställning på dagar — inte veckor.', icon: Zap },
  { metric: 94, suffix: '%', title: 'Matchning', description: 'Algoritmerna lär sig vad du letar efter. Varje swipe gör matchningen smartare.', icon: Brain },
  { metric: 100, suffix: '%', title: 'Mobilt', description: 'Byggt för mobilen först. Rekrytera var du än är.', icon: Smartphone },
];

const LandingFeatures = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] });

  const headerY = useTransform(scrollYProgress, [0, 0.3], [60, 0]);
  const headerOpacity = useTransform(scrollYProgress, [0, 0.2], [0, 1]);

  return (
    <section ref={sectionRef} id="funktioner" className="relative py-24 sm:py-32 lg:py-40 px-5 sm:px-6 md:px-12 lg:px-24" aria-labelledby="features-heading">
      <div className="max-w-[1400px] mx-auto">
        <motion.div className="mb-16 sm:mb-24" style={{ y: headerY, opacity: headerOpacity }}>
          <span className="inline-flex items-center gap-3 text-[10px] sm:text-[11px] font-semibold tracking-[0.3em] uppercase text-secondary/50">
            <span className="w-8 sm:w-12 h-px bg-gradient-to-r from-secondary to-transparent" />
            Varför Parium
          </span>
          <h2 id="features-heading" className="mt-4 text-3xl sm:text-5xl md:text-6xl font-black tracking-[-0.04em] text-white uppercase">
            Rekrytering,<span className="text-white/15"> reinvented.</span>
          </h2>
        </motion.div>

        <StaggerReveal className="grid md:grid-cols-3 gap-4 sm:gap-6">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <StaggerItem key={f.title}>
                <div className="group relative bg-white/[0.015] p-8 sm:p-10 rounded-2xl sm:rounded-3xl border border-white/[0.04] hover:border-secondary/20 hover:bg-white/[0.04] transition-all duration-500 overflow-hidden">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-8 border bg-secondary/[0.08] border-secondary/15">
                    <Icon className="w-5 h-5 text-secondary" strokeWidth={1.5} />
                  </div>
                  <div className="text-[4rem] sm:text-[5rem] font-black leading-none tracking-[-0.06em] bg-gradient-to-b from-white to-white/30 bg-clip-text text-transparent mb-4">
                    <AnimatedValue value={f.metric} suffix={f.suffix} />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-2 tracking-tight uppercase">{f.title}</h3>
                  <p className="text-white/35 text-sm leading-relaxed">{f.description}</p>
                  <div className="absolute -bottom-20 -right-20 w-40 h-40 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-secondary/[0.08]" />
                </div>
              </StaggerItem>
            );
          })}
        </StaggerReveal>
      </div>
    </section>
  );
};

export default LandingFeatures;
