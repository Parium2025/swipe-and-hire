import { motion } from 'framer-motion';
import { Hand, Sparkles, MessageCircle } from 'lucide-react';

const steps = [
  {
    icon: Hand,
    step: '01',
    title: 'Swipe',
    description: 'Bläddra igenom relevanta jobb eller kandidater. Swipea höger på det som matchar.',
  },
  {
    icon: Sparkles,
    step: '02',
    title: 'Matcha',
    description: 'AI:n hittar de bästa matchningarna automatiskt. Inga fler timmar av manuell screening.',
  },
  {
    icon: MessageCircle,
    step: '03',
    title: 'Chatta',
    description: 'Starta en konversation direkt. Boka intervju och anställ — allt i appen.',
  },
];

const ease = [0.22, 1, 0.36, 1] as const;

const LandingHowItWorks = () => {
  return (
    <section
      id="hur-det-fungerar"
      className="relative py-24 sm:py-32 lg:py-40 px-5 sm:px-6 md:px-12 lg:px-24"
      aria-labelledby="how-heading"
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 max-w-lg h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-5xl mx-auto">
        <motion.header
          className="text-center mb-16 sm:mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease }}
        >
          <span className="text-[hsl(250_80%_70%)] text-[11px] sm:text-xs font-semibold tracking-[0.2em] uppercase mb-4 block">
            Så fungerar det
          </span>
          <h2 id="how-heading" className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-[-0.03em] text-white">
            Tre steg. Det är allt.
          </h2>
        </motion.header>

        <div className="grid md:grid-cols-3 gap-8 sm:gap-12 relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-14 left-[16%] right-[16%] h-px" aria-hidden="true">
            <div className="w-full h-full bg-gradient-to-r from-white/5 via-[hsl(250_60%_50%/0.2)] to-white/5" />
          </div>

          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.article
                key={step.step}
                className="relative text-center group"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.12, ease }}
              >
                <div className="relative z-10 mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-6 sm:mb-8 group-hover:border-white/[0.15] transition-colors duration-300">
                  <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-[hsl(250_80%_70%)]" strokeWidth={1.5} />
                  <span className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full bg-[hsl(250_60%_55%)] text-white text-[11px] font-bold flex items-center justify-center shadow-lg">
                    {step.step}
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 tracking-tight">
                  {step.title}
                </h3>
                <p className="text-white/40 text-sm leading-relaxed max-w-[280px] mx-auto">
                  {step.description}
                </p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default LandingHowItWorks;
