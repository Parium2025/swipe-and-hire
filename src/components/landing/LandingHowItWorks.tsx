import { motion } from 'framer-motion';
import { UserPlus, Search, Handshake } from 'lucide-react';

const steps = [
  {
    icon: UserPlus,
    step: '01',
    title: 'Skapa profil',
    description: 'Registrera dig på 30 sekunder. Ladda upp CV eller spela in en videopresentation.',
  },
  {
    icon: Search,
    step: '02',
    title: 'Swipea & matcha',
    description: 'Bläddra igenom relevanta jobb eller kandidater. Swipea höger för att matcha.',
  },
  {
    icon: Handshake,
    step: '03',
    title: 'Anställ direkt',
    description: 'Chatta, boka intervju och signera – allt i en plattform utan omvägar.',
  },
];

const LandingHowItWorks = () => {
  return (
    <section className="relative py-24 sm:py-32 px-6 md:px-12 lg:px-24">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="max-w-7xl mx-auto">
        <motion.div
          className="text-center mb-16 sm:mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-secondary text-xs sm:text-sm font-semibold tracking-widest uppercase mb-3 block">
            Så fungerar det
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
            Tre steg till din nästa match
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 sm:gap-12 relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-px bg-gradient-to-r from-white/10 via-secondary/30 to-white/10" />

          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.step}
                className="relative text-center"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
              >
                <div className="relative z-10 mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary border border-white/10 flex items-center justify-center mb-6 shadow-lg shadow-primary/20">
                  <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-secondary" />
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-secondary text-primary text-[10px] font-bold flex items-center justify-center">
                    {step.step}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3 tracking-tight">
                  {step.title}
                </h3>
                <p className="text-white/45 text-sm leading-relaxed max-w-xs mx-auto">
                  {step.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default LandingHowItWorks;
