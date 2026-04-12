import { motion } from 'framer-motion';
import { UserPlus, Search, Handshake } from 'lucide-react';

const steps = [
  {
    icon: UserPlus,
    step: '01',
    title: 'Skapa profil',
    description: 'Registrera dig snabbt, ladda upp CV och aktivera video om du vill sticka ut direkt.',
  },
  {
    icon: Search,
    step: '02',
    title: 'Swipea & matcha',
    description: 'Se relevanta jobb eller kandidater först, utan långa listor eller onödigt brus.',
  },
  {
    icon: Handshake,
    step: '03',
    title: 'Anställ direkt',
    description: 'Chatta, boka intervju och gå från match till anställning i ett sammanhängande flöde.',
  },
];

const LandingHowItWorks = () => {
  return (
    <section
      id="hur-det-funkar"
      className="relative px-5 py-24 sm:px-6 sm:py-32 md:px-12 lg:px-24 lg:py-40"
      aria-labelledby="how-heading"
    >
      <div className="absolute left-1/2 top-0 h-px w-2/3 max-w-lg -translate-x-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="mx-auto max-w-7xl">
        <motion.header
          className="mb-16 text-center sm:mb-20 lg:mb-24"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
        >
          <span className="mb-4 block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/86 sm:text-xs">
            Hur det funkar
          </span>
          <h2 id="how-heading" className="text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl md:text-5xl">
            Tre steg till din nästa match
          </h2>
        </motion.header>

        <div className="relative grid gap-8 sm:gap-10 md:grid-cols-3 lg:gap-14">
          <div className="absolute left-[16%] right-[16%] top-14 hidden h-px md:block" aria-hidden="true">
            <div className="h-full w-full bg-gradient-to-r from-white/5 via-white/12 to-white/5" />
          </div>

          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.article
                key={step.step}
                className="group relative text-center"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.12 }}
              >
                <div className="relative z-10 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] sm:mb-8 sm:h-20 sm:w-20">
                  <Icon className="h-7 w-7 text-white sm:h-8 sm:w-8" strokeWidth={1.5} />
                  <span className="absolute -right-2.5 -top-2.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.12] bg-white text-[11px] font-bold text-primary">
                    {step.step}
                  </span>
                </div>
                <h3 className="mb-3 text-lg font-semibold tracking-tight text-white sm:text-xl">
                  {step.title}
                </h3>
                <p className="mx-auto max-w-[280px] text-[13px] leading-relaxed text-white/78 sm:text-sm">
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
