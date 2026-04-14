import { motion, useScroll, useTransform } from 'framer-motion';
import { Hand, Sparkles, MessageCircle } from 'lucide-react';
import { useRef } from 'react';
import { StaggerReveal, StaggerItem } from './ScrollReveal';

const steps = [
  { icon: Hand, num: '01', title: 'Swipe', description: 'Bläddra igenom relevanta jobb eller kandidater. Swipea höger på det som matchar.' },
  { icon: Sparkles, num: '02', title: 'Matcha', description: 'AI:n hittar de bästa matchningarna automatiskt. Inga fler timmar av manuell screening.' },
  { icon: MessageCircle, num: '03', title: 'Anställ', description: 'Starta en konversation direkt. Boka intervju och anställ — allt i appen.' },
];

const LandingHowItWorks = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  const headerY = useTransform(scrollYProgress, [0, 0.3], [80, 0]);
  const headerOpacity = useTransform(scrollYProgress, [0, 0.2], [0, 1]);
  const lineHeight = useTransform(scrollYProgress, [0.1, 0.7], ['0%', '100%']);

  return (
    <section
      ref={sectionRef}
      id="hur-det-fungerar"
      className="relative py-28 sm:py-36 lg:py-48 px-5 sm:px-6 md:px-12 lg:px-24"
      aria-labelledby="how-heading"
    >
      <div className="max-w-[1400px] mx-auto relative z-10">
        <motion.div className="mb-20 sm:mb-28" style={{ y: headerY, opacity: headerOpacity }}>
          <span className="inline-flex items-center gap-3 text-[10px] sm:text-[11px] font-semibold tracking-[0.3em] uppercase text-secondary/50">
            <span className="w-10 sm:w-14 h-px bg-gradient-to-r from-secondary to-transparent" />
            Så fungerar det
          </span>
          <h2 id="how-heading" className="mt-5 text-4xl sm:text-5xl md:text-7xl font-black tracking-[-0.04em] text-white uppercase">
            Tre steg.<span className="text-white/10"> Det är allt.</span>
          </h2>
        </motion.div>

        <div className="relative">
          {/* Vertical progress line */}
          <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-white/[0.03]">
            <motion.div
              className="w-full bg-gradient-to-b from-secondary via-secondary to-transparent"
              style={{ height: lineHeight }}
            />
          </div>

          <StaggerReveal className="grid md:grid-cols-3 gap-5 sm:gap-8">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <StaggerItem key={step.num}>
                  <article
                    className="group relative p-7 sm:p-10 rounded-2xl sm:rounded-3xl border border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.04] hover:border-secondary/20 transition-all duration-700 overflow-hidden"
                    style={{ marginTop: i === 1 ? '2.5rem' : i === 2 ? '5rem' : 0 }}
                  >
                    {/* Big background number */}
                    <div className="text-[7rem] sm:text-[9rem] font-black leading-none tracking-[-0.06em] text-white/[0.015] select-none absolute top-0 right-3">
                      {step.num}
                    </div>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-7 border bg-secondary/[0.08] border-secondary/15">
                      <Icon className="w-6 h-6 text-secondary" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-3 uppercase">{step.title}</h3>
                    <p className="text-white/35 text-sm leading-relaxed">{step.description}</p>
                    {/* Bottom glow line */}
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-r from-transparent via-secondary to-transparent" />
                    {/* Corner glow */}
                    <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-secondary/[0.06]" />
                  </article>
                </StaggerItem>
              );
            })}
          </StaggerReveal>
        </div>
      </div>
    </section>
  );
};

export default LandingHowItWorks;
