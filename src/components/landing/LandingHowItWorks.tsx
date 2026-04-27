import { motion, useScroll, useTransform } from 'framer-motion';
import { MessageCircle, Search, Sparkles } from 'lucide-react';
import { useRef } from 'react';
import { StaggerReveal, StaggerItem } from './ScrollReveal';

const steps = [
  { icon: Search, num: '01', title: 'Skapa din profil', description: 'Lägg upp det viktigaste: erfarenhet, önskemål, roll och vad som gör matchningen relevant.' },
  { icon: Sparkles, num: '02', title: 'Få relevanta förslag', description: 'Parium sorterar fram jobb och kandidater som passar — utan att upplevelsen känns tung.' },
  { icon: MessageCircle, num: '03', title: 'Ta nästa steg', description: 'När båda sidor är intresserade kan ni prata direkt, boka intervju och komma vidare.' },
];

const LandingHowItWorks = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] });
  const headerY = useTransform(scrollYProgress, [0, 0.3], [56, 0]);
  const headerOpacity = useTransform(scrollYProgress, [0, 0.2], [0, 1]);

  return (
    <section ref={sectionRef} id="hur-det-fungerar" className="relative px-5 py-24 sm:px-6 sm:py-32 md:px-12 lg:px-24" aria-labelledby="how-heading">
      <div className="relative z-10 mx-auto max-w-[1400px]">
        <motion.div className="mb-14 sm:mb-20" style={{ y: headerY, opacity: headerOpacity }}>
          <span className="inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary/65">
            <span className="h-px w-12 bg-gradient-to-r from-secondary to-transparent" />
            Så fungerar det
          </span>
          <h2 id="how-heading" className="mt-5 max-w-4xl text-4xl font-black tracking-[-0.025em] text-white sm:text-5xl md:text-6xl">
            Från profil till dialog i tre enkla steg.
          </h2>
        </motion.div>

        <StaggerReveal className="grid gap-4 md:grid-cols-3 sm:gap-5">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <StaggerItem key={step.num}>
                <article className="group relative h-full overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.035] p-7 backdrop-blur-xl transition-colors duration-500 hover:bg-white/[0.055] sm:p-8">
                  <div className="mb-8 flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-secondary/20 bg-secondary/10">
                      <Icon className="h-5 w-5 text-secondary" strokeWidth={1.7} />
                    </div>
                    <span className="text-4xl font-black tracking-[-0.04em] text-white/[0.08]">{step.num}</span>
                  </div>
                  <h3 className="text-2xl font-black text-white">{step.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-white/48">{step.description}</p>
                  <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-secondary/45 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                </article>
              </StaggerItem>
            );
          })}
        </StaggerReveal>
      </div>
    </section>
  );
};

export default LandingHowItWorks;
