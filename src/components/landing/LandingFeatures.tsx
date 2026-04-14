import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { useRef, useEffect, useState, memo } from 'react';
import { Zap, Brain, Smartphone } from 'lucide-react';
import { StaggerReveal, StaggerItem } from './ScrollReveal';

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

  const headerY = useTransform(scrollYProgress, [0, 0.3], [80, 0]);
  const headerOpacity = useTransform(scrollYProgress, [0, 0.2], [0, 1]);

  return (
    <section ref={sectionRef} id="funktioner" className="relative py-28 sm:py-36 lg:py-48 px-5 sm:px-6 md:px-12 lg:px-24" aria-labelledby="features-heading">
      <div className="max-w-[1400px] mx-auto">
        <motion.div className="mb-20 sm:mb-28" style={{ y: headerY, opacity: headerOpacity }}>
          <span className="inline-flex items-center gap-3 text-[10px] sm:text-[11px] font-semibold tracking-[0.3em] uppercase text-secondary/50">
            <span className="w-10 sm:w-14 h-px bg-gradient-to-r from-secondary to-transparent" />
            Varför Parium
          </span>
          <h2 id="features-heading" className="mt-5 text-4xl sm:text-5xl md:text-7xl font-black tracking-[-0.04em] text-white uppercase">
            Rekrytering,<span className="text-white/10"> reinvented.</span>
          </h2>
        </motion.div>

        <StaggerReveal className="grid md:grid-cols-3 gap-5 sm:gap-8">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <StaggerItem key={f.title}>
                <div className="group relative bg-white/[0.015] p-8 sm:p-12 rounded-2xl sm:rounded-3xl border border-white/[0.04] hover:border-secondary/20 hover:bg-white/[0.04] transition-all duration-700 overflow-hidden">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-10 border bg-secondary/[0.08] border-secondary/15">
                    <Icon className="w-6 h-6 text-secondary" strokeWidth={1.5} />
                  </div>
                  <div className="text-[4.5rem] sm:text-[6rem] font-black leading-none tracking-[-0.06em] bg-gradient-to-b from-white to-white/25 bg-clip-text text-transparent mb-5">
                    <AnimatedValue value={f.metric} suffix={f.suffix} />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white mb-3 tracking-tight uppercase">{f.title}</h3>
                  <p className="text-white/30 text-sm leading-relaxed">{f.description}</p>
                  <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-secondary/[0.06]" />
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
