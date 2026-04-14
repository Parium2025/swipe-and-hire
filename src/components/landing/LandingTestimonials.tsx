import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { StaggerReveal, StaggerItem } from './ScrollReveal';

const ease = [0.22, 1, 0.36, 1] as const;

const testimonials = [
  { quote: 'Vi hittade tre perfekta kandidater på mindre än en vecka. Parium förändrade helt hur vi rekryterar.', name: 'Emma Lindström', role: 'HR-chef, TechCo AB', initials: 'EL' },
  { quote: 'Swipe-funktionen gör det genuint roligt att söka jobb. Jag fick mitt drömjobb på 3 dagar.', name: 'Marcus Eriksson', role: 'Utvecklare', initials: 'ME' },
  { quote: 'AI-screeningen sparar oss 15 timmar per vecka. Det är som att ha en extra rekryterare i teamet.', name: 'Sara Bergqvist', role: 'VD, StartupHub', initials: 'SB' },
];

const LandingTestimonials = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] });

  const headerY = useTransform(scrollYProgress, [0, 0.3], [60, 0]);
  const headerOpacity = useTransform(scrollYProgress, [0, 0.2], [0, 1]);

  return (
    <section ref={sectionRef} className="relative py-24 sm:py-32 lg:py-40 px-5 sm:px-6 md:px-12 lg:px-24" aria-labelledby="testimonials-heading">
      <div className="max-w-[1400px] mx-auto">
        <motion.div className="mb-16 sm:mb-24" style={{ y: headerY, opacity: headerOpacity }}>
          <span className="inline-flex items-center gap-3 text-[10px] sm:text-[11px] font-semibold tracking-[0.3em] uppercase text-secondary/50">
            <span className="w-8 sm:w-12 h-px bg-gradient-to-r from-secondary to-transparent" />
            Vad folk säger
          </span>
          <h2 id="testimonials-heading" className="mt-4 text-3xl sm:text-5xl md:text-6xl font-black tracking-[-0.04em] text-white uppercase">
            Älskad<span className="text-white/15"> av alla.</span>
          </h2>
        </motion.div>

        <StaggerReveal className="grid md:grid-cols-2 gap-4 sm:gap-6">
          <StaggerItem>
            <blockquote className="relative p-8 sm:p-10 rounded-2xl sm:rounded-3xl border border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.03] hover:border-secondary/15 transition-all duration-500 h-full flex flex-col justify-between">
              <div>
                <div className="text-[6rem] font-black leading-none text-secondary/[0.08] select-none -mt-4 mb-2">"</div>
                <p className="text-white/60 text-lg sm:text-xl md:text-2xl leading-relaxed mb-8 font-medium italic">{testimonials[0].quote}</p>
              </div>
              <footer className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-secondary/30 to-primary-glow/30 border border-white/[0.06] flex items-center justify-center text-white text-sm font-bold">{testimonials[0].initials}</div>
                <div>
                  <div className="text-white text-sm font-semibold">{testimonials[0].name}</div>
                  <div className="text-white/30 text-xs">{testimonials[0].role}</div>
                </div>
              </footer>
            </blockquote>
          </StaggerItem>

          <div className="flex flex-col gap-4 sm:gap-6">
            {testimonials.slice(1).map((t) => (
              <StaggerItem key={t.name}>
                <blockquote className="relative p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.03] hover:border-secondary/15 transition-all duration-500">
                  <p className="text-white/50 text-sm sm:text-base leading-relaxed mb-6 font-medium italic">"{t.quote}"</p>
                  <footer className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-secondary/25 to-primary-glow/25 border border-white/[0.06] flex items-center justify-center text-white text-xs font-bold">{t.initials}</div>
                    <div>
                      <div className="text-white text-sm font-semibold">{t.name}</div>
                      <div className="text-white/30 text-xs">{t.role}</div>
                    </div>
                  </footer>
                </blockquote>
              </StaggerItem>
            ))}
          </div>
        </StaggerReveal>
      </div>
    </section>
  );
};

export default LandingTestimonials;
