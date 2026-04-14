import { motion } from 'framer-motion';
import { Zap, Target, Smartphone } from 'lucide-react';

const values = [
  {
    icon: Zap,
    title: '10x snabbare',
    description: 'Från ansökan till anställning på dagar — inte veckor. AI-matchning som faktiskt fungerar.',
    metric: '10x',
  },
  {
    icon: Target,
    title: 'Bättre matchningar',
    description: 'Algoritmerna lär sig vad du letar efter. Varje swipe gör matchningen smartare.',
    metric: '94%',
  },
  {
    icon: Smartphone,
    title: 'Mobile-first',
    description: 'Byggt för mobilen först. Rekrytera eller sök jobb var du än är, när du vill.',
    metric: '100%',
  },
];

const LandingFeatures = () => {
  return (
    <section
      id="funktioner"
      className="relative py-24 sm:py-32 lg:py-40 px-5 sm:px-6 md:px-12 lg:px-24"
      aria-labelledby="value-heading"
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 max-w-lg h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-6xl mx-auto">
        <motion.header
          className="text-center mb-16 sm:mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-[hsl(250_80%_70%)] text-[11px] sm:text-xs font-semibold tracking-[0.2em] uppercase mb-4 block">
            Varför Parium
          </span>
          <h2
            id="value-heading"
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-[-0.03em] text-white mb-4"
          >
            Rekrytering,{' '}
            <span className="text-white/30">reinvented.</span>
          </h2>
        </motion.header>

        <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
          {values.map((v, i) => {
            const Icon = v.icon;
            return (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group relative p-8 sm:p-10 rounded-3xl border border-white/[0.06] bg-white/[0.02]
                  hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-500"
              >
                <div className="mb-6">
                  <span className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-[hsl(250_80%_70%)] to-[hsl(200_90%_70%)] bg-clip-text text-transparent">
                    {v.metric}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-[hsl(250_80%_70%)]" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 tracking-tight">{v.title}</h3>
                <p className="text-white/35 text-sm leading-relaxed">{v.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default LandingFeatures;
