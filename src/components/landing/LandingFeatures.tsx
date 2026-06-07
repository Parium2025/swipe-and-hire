import { motion, useScroll, useTransform } from 'framer-motion';
import { Brain, ShieldCheck, Smartphone, Zap } from 'lucide-react';
import { useRef } from 'react';
import { StaggerReveal, StaggerItem } from './ScrollReveal';

const features = [
  { title: 'Matchning som känns relevant', description: 'Rekommendationer baserade på roll, plats, erfarenhet och vad båda sidor faktiskt söker.', icon: Brain },
  { title: 'Mobil upplevelse först', description: 'Sök, granska och svara snabbt i ett flöde som är gjort för vardagen — inte för långa formulär.', icon: Smartphone },
  { title: 'Snabbare kontakt', description: 'När intresset är ömsesidigt öppnas dialogen direkt så att processen fortsätter naturligt.', icon: Zap },
  { title: 'Trygg hantering', description: 'Strukturerad profilinformation, tydliga val och säkrare flöden för både kandidat och arbetsgivare.', icon: ShieldCheck },
];

const LandingFeatures = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] });
  const headerY = useTransform(scrollYProgress, [0, 0.3], [56, 0]);
  const headerOpacity = useTransform(scrollYProgress, [0, 0.2], [0, 1]);

  return (
    <section ref={sectionRef} id="funktioner" className="relative px-5 py-24 sm:px-6 sm:py-32 md:px-12 lg:px-24" aria-labelledby="features-heading">
      <div className="mx-auto max-w-[1400px]">
        <motion.div className="mb-14 grid gap-6 md:mb-20 md:grid-cols-[0.9fr_1.1fr] md:items-end" style={{ y: headerY, opacity: headerOpacity }}>
          <div>
            <span className="inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary/65">
              <span className="h-px w-12 bg-gradient-to-r from-secondary to-transparent" />
              Funktioner
            </span>
            <h2 id="features-heading" className="mt-5 text-4xl font-black tracking-[-0.025em] text-white sm:text-5xl md:text-6xl">
              Allt hänger ihop.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-8 text-white/50">
            En landningssida ska kännas som produkten: tydlig, snabb och modern. Därför är varje sektion byggd runt samma visuella språk.
          </p>
        </motion.div>

        <StaggerReveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-5">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <StaggerItem key={f.title}>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.032] p-6 backdrop-blur-xl transition-colors duration-500 hover:bg-white/[0.055]">
                  <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl border border-secondary/20 bg-secondary/10">
                    <Icon className="h-5 w-5 text-secondary" strokeWidth={1.7} />
                  </div>
                  <h3 className="text-xl font-black leading-tight text-white">{f.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-white/45">{f.description}</p>
                  <div className="absolute -right-16 -top-16 h-36 w-36 rounded-full bg-secondary/0 blur-[60px] transition-colors duration-500 group-hover:bg-secondary/10" />
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
