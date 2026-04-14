import { motion } from 'framer-motion';
import { Hand, Sparkles, MessageCircle } from 'lucide-react';

const steps = [
  {
    icon: Hand,
    num: '01',
    title: 'Swipe',
    description: 'Bläddra igenom relevanta jobb eller kandidater. Swipea höger på det som matchar.',
    accent: 'hsl(250 80% 70%)',
  },
  {
    icon: Sparkles,
    num: '02',
    title: 'Matcha',
    description: 'AI:n hittar de bästa matchningarna automatiskt. Inga fler timmar av manuell screening.',
    accent: 'hsl(200 90% 70%)',
  },
  {
    icon: MessageCircle,
    num: '03',
    title: 'Anställ',
    description: 'Starta en konversation direkt. Boka intervju och anställ — allt i appen.',
    accent: 'hsl(170 80% 60%)',
  },
];

const ease = [0.22, 1, 0.36, 1] as const;

const LandingHowItWorks = () => (
  <section
    id="hur-det-fungerar"
    className="relative py-24 sm:py-32 lg:py-40 px-5 sm:px-6 md:px-12 lg:px-24"
    aria-labelledby="how-heading"
  >
    {/* Background SVG lines */}
    <div className="absolute inset-0 pointer-events-none opacity-[0.02]" aria-hidden="true">
      <svg className="w-full h-full" viewBox="0 0 1000 800" fill="none" preserveAspectRatio="xMidYMid slice">
        <path d="M0,400 Q250,100 500,400 T1000,400" stroke="white" strokeWidth="1" />
        <path d="M0,500 Q250,200 500,500 T1000,500" stroke="white" strokeWidth="0.5" />
      </svg>
    </div>

    <div className="max-w-[1400px] mx-auto relative z-10">
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

      {/* Asymmetric step layout */}
      <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <motion.article
              key={step.num}
              className="group relative p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.10] transition-all duration-500 overflow-hidden"
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
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 border"
                style={{
                  backgroundColor: `${step.accent.replace(')', ' / 0.08)')}`,
                  borderColor: `${step.accent.replace(')', ' / 0.15)')}`,
                }}
              >
                <Icon className="w-5 h-5" style={{ color: step.accent }} strokeWidth={1.5} />
              </div>

              <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-3 uppercase">
                {step.title}
              </h3>
              <p className="text-white/30 text-sm leading-relaxed">
                {step.description}
              </p>

              {/* Bottom accent line on hover */}
              <div
                className="absolute bottom-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `linear-gradient(90deg, transparent, ${step.accent}, transparent)` }}
              />
            </motion.article>
          );
        })}
      </div>
    </div>
  </section>
);

export default LandingHowItWorks;
