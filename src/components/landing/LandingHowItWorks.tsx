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
    title: 'Chatta',
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
    <div className="max-w-[1400px] mx-auto">
      {/* Section label */}
      <motion.div
        className="mb-16 sm:mb-24"
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease }}
      >
        <span className="inline-flex items-center gap-3 text-[10px] sm:text-[11px] font-semibold tracking-[0.3em] uppercase text-white/30">
          <span className="w-8 sm:w-12 h-px bg-gradient-to-r from-[hsl(250_80%_70%)] to-transparent" />
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

      {/* Steps — large editorial cards */}
      <div className="space-y-4 sm:space-y-6">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <motion.article
              key={step.num}
              className="group relative flex flex-col sm:flex-row items-start gap-6 sm:gap-10 p-6 sm:p-10 rounded-2xl sm:rounded-3xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.08] transition-all duration-500"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1, ease }}
            >
              {/* Number */}
              <div className="text-[4rem] sm:text-[6rem] md:text-[8rem] font-black leading-none tracking-[-0.06em] text-white/[0.03] select-none flex-shrink-0">
                {step.num}
              </div>

              {/* Content */}
              <div className="flex-1 sm:pt-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[hsl(250_60%_50%/0.1)] border border-[hsl(250_60%_50%/0.2)] flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[hsl(250_80%_70%)]" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight">
                    {step.title}
                  </h3>
                </div>
                <p className="text-white/30 text-sm sm:text-base leading-relaxed max-w-lg">
                  {step.description}
                </p>
              </div>

              {/* Arrow indicator on hover */}
              <div className="hidden sm:flex items-center justify-center w-12 h-12 rounded-full border border-white/[0.05] self-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="text-white/30 text-lg">→</span>
              </div>
            </motion.article>
          );
        })}
      </div>
    </div>
  </section>
);

export default LandingHowItWorks;
