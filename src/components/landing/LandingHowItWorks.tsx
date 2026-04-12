import { motion } from 'framer-motion';
import { UserPlus, Search, Handshake } from 'lucide-react';

const steps = [
  {
    icon: UserPlus,
    step: '01',
    title: 'Skapa profil',
    description: 'Registrera dig på 30 sekunder. Ladda upp CV, spela in en videopresentation – eller båda.',
  },
  {
    icon: Search,
    step: '02',
    title: 'Swipea & matcha',
    description: 'Bläddra igenom relevanta jobb eller kandidater. Swipea höger på dem som matchar dina kriterier.',
  },
  {
    icon: Handshake,
    step: '03',
    title: 'Anställ direkt',
    description: 'Chatta, boka intervju och signera – allt i en plattform. Från match till anställning utan omvägar.',
  },
];

const ease = [0.22, 1, 0.36, 1] as const;

const LandingHowItWorks = () => {
  return (
    <section
      className="relative py-24 sm:py-32 lg:py-40 px-5 sm:px-6 md:px-12 lg:px-24"
      aria-labelledby="how-heading"
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 max-w-lg h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <div className="max-w-7xl mx-auto">
        <motion.header
          className="text-center mb-16 sm:mb-20 lg:mb-24"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease }}
        >
          <span className="text-secondary text-[11px] sm:text-xs font-semibold tracking-[0.2em] uppercase mb-4 block">
            Så fungerar det
          </span>
          <h2 id="how-heading" className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-[-0.03em] text-white">
            Tre steg till din nästa match
          </h2>
        </motion.header>

        <div className="grid md:grid-cols-3 gap-8 sm:gap-10 lg:gap-14 relative">
          {/* Connecting line — desktop only */}
          <div className="hidden md:block absolute top-14 left-[16%] right-[16%] h-px" aria-hidden="true">
            <div className="w-full h-full bg-gradient-to-r from-white/5 via-secondary/20 to-white/5" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-secondary/40" />
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
                {/* Step icon */}
                <div className="relative z-10 mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary border border-white/[0.08] flex items-center justify-center mb-6 sm:mb-8 group-hover:border-white/[0.15] transition-colors duration-300 shadow-lg shadow-black/20">
                  <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-secondary" strokeWidth={1.5} />
                  <span className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full bg-secondary text-primary text-[11px] font-bold flex items-center justify-center shadow-lg shadow-secondary/30">
                    {step.step}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-3 tracking-tight">
                  {step.title}
                </h3>
                <p className="text-white/40 text-[13px] sm:text-sm leading-relaxed max-w-[280px] mx-auto">
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
