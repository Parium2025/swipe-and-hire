import { motion } from 'framer-motion';
import { Hand, Sparkles, MessageCircle } from 'lucide-react';

const steps = [
  {
    icon: Hand,
    num: '01',
    title: 'Swipe',
    description: 'Bläddra igenom relevanta jobb eller kandidater. Swipea höger på det som matchar.',
  },
  {
    icon: Sparkles,
    num: '02',
    title: 'Matcha',
    description: 'AI:n hittar de bästa matchningarna automatiskt. Inga fler timmar av manuell screening.',
  },
  {
    icon: MessageCircle,
    num: '03',
    title: 'Anställ',
    description: 'Starta en konversation direkt. Boka intervju och anställ — allt i appen.',
  },
];

const ease = [0.22, 1, 0.36, 1] as const;

const LandingHowItWorks = () => (
  <section
    id="hur-det-fungerar"
    className="relative py-24 sm:py-32 lg:py-40 px-5 sm:px-6 md:px-12 lg:px-24"
    aria-labelledby="how-heading"
  >
    <div className="max-w-[1400px] mx-auto relative z-10">
      <motion.div
        className="mb-16 sm:mb-24"
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease }}
      >
        <span className="inline-flex items-center gap-3 text-[10px] sm:text-[11px] font-semibold tracking-[0.3em] uppercase text-secondary/50">
          <span className="w-8 sm:w-12 h-px bg-gradient-to-r from-secondary to-transparent" />
          Så fungerar det
        </span>
        <h2
          id="how-heading"
          className="mt-4 text-3xl sm:text-5xl md:text-6xl font-black tracking-[-0.04em] text-white uppercase"
        >
          Tre steg.
          <span className="text-white/15"> Det är allt.</span>
        </h2>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <motion.article
              key={step.num}
              className="group relative p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.04] hover:border-secondary/20 transition-all duration-500 overflow-hidden"
              style={{ marginTop: i === 1 ? '2rem' : i === 2 ? '4rem' : 0 }}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.15, ease }}
            >
              {/* Number background */}
              <div className="text-[6rem] sm:text-[8rem] font-black leading-none tracking-[-0.06em] text-white/[0.02] select-none absolute top-2 right-4">
                {step.num}
              </div>

              {/* Icon */}
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 border bg-secondary/[0.08] border-secondary/15">
                <Icon className="w-5 h-5 text-secondary" strokeWidth={1.5} />
              </div>

              <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-3 uppercase">
                {step.title}
              </h3>
              <p className="text-white/40 text-sm leading-relaxed">
                {step.description}
              </p>

              {/* Bottom accent line on hover */}
              <div className="absolute bottom-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-secondary to-transparent" />
            </motion.article>
          );
        })}
      </div>
    </div>
  </section>
);

export default LandingHowItWorks;
