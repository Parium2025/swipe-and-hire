import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { StaggerReveal, StaggerItem } from './ScrollReveal';

const testimonials = [
  { quote: 'Det känns modernt, tydligt och mycket närmare hur människor faktiskt söker jobb idag.', name: 'Arbetsgivare', role: 'Team som rekryterar löpande', initials: 'AG' },
  { quote: 'Jag vill snabbt förstå vilka jobb som passar mig och kunna visa intresse utan friktion.', name: 'Jobbsökare', role: 'Kandidat i aktiv process', initials: 'JS' },
  { quote: 'När urval, matchning och dialog sitter ihop blir hela processen lättare att driva framåt.', name: 'Rekryteringsteam', role: 'Operativt HR-flöde', initials: 'RT' },
];

const LandingTestimonials = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] });
  const headerY = useTransform(scrollYProgress, [0, 0.3], [56, 0]);
  const headerOpacity = useTransform(scrollYProgress, [0, 0.2], [0, 1]);

  return (
    <section ref={sectionRef} className="relative px-5 py-24 sm:px-6 sm:py-32 md:px-12 lg:px-24" aria-labelledby="testimonials-heading">
      <div className="mx-auto max-w-[1400px]">
        <motion.div className="mb-14 sm:mb-20" style={{ y: headerY, opacity: headerOpacity }}>
          <span className="inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary/65">
            <span className="h-px w-12 bg-gradient-to-r from-secondary to-transparent" />
            Upplevelsen
          </span>
          <h2 id="testimonials-heading" className="mt-5 max-w-4xl text-4xl font-black tracking-[-0.025em] text-white sm:text-5xl md:text-6xl">
            Skapat för att kännas lätt att använda.
          </h2>
        </motion.div>

        <StaggerReveal className="grid gap-4 md:grid-cols-3 sm:gap-5">
          {testimonials.map((t) => (
            <StaggerItem key={t.name}>
              <blockquote className="flex h-full flex-col justify-between rounded-2xl border border-white/[0.07] bg-white/[0.032] p-7 backdrop-blur-xl transition-colors duration-500 hover:bg-white/[0.055]">
                <p className="text-lg font-semibold leading-8 text-white/68">“{t.quote}”</p>
                <footer className="mt-10 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-secondary/20 bg-secondary/10 text-xs font-black text-white">{t.initials}</div>
                  <div>
                    <div className="text-sm font-bold text-white">{t.name}</div>
                    <div className="text-xs text-white/35">{t.role}</div>
                  </div>
                </footer>
              </blockquote>
            </StaggerItem>
          ))}
        </StaggerReveal>
      </div>
    </section>
  );
};

export default LandingTestimonials;
