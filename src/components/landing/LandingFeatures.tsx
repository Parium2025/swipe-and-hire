import { motion } from 'framer-motion';
import { Zap, ScanFace, BarChart3, Shield, MessageCircle, Globe2 } from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Swipe-matchning',
    description: 'Kandidater och jobb matchas med ett swipe. Snabbare och mer träffsäkert än alla traditionella rekryteringsplattformar.',
    gradient: 'from-yellow-400/15 to-orange-500/15',
    iconGlow: 'shadow-yellow-400/20',
  },
  {
    icon: ScanFace,
    title: 'Video-profiler',
    description: 'Se personligheten bakom CV:t. Kandidater presenterar sig med korta, autentiska videoklipp.',
    gradient: 'from-violet-400/15 to-fuchsia-500/15',
    iconGlow: 'shadow-violet-400/20',
  },
  {
    icon: BarChart3,
    title: 'AI-driven screening',
    description: 'Automatisk AI-utvärdering mot dina urvalskriterier. Sparar timmar av manuellt rekryteringsarbete varje vecka.',
    gradient: 'from-cyan-400/15 to-blue-500/15',
    iconGlow: 'shadow-cyan-400/20',
  },
  {
    icon: Shield,
    title: 'GDPR-säkert',
    description: 'All data lagras i Sverige med end-to-end kryptering. Fullt GDPR-kompatibelt med inbyggd samtyckshantering.',
    gradient: 'from-emerald-400/15 to-green-500/15',
    iconGlow: 'shadow-emerald-400/20',
  },
  {
    icon: MessageCircle,
    title: 'Direktmeddelanden',
    description: 'Chatta i realtid med kandidater och arbetsgivare. Boka intervjuer direkt i plattformen utan omvägar.',
    gradient: 'from-blue-400/15 to-indigo-500/15',
    iconGlow: 'shadow-blue-400/20',
  },
  {
    icon: Globe2,
    title: 'Byggt för Norden',
    description: 'Designat specifikt för den nordiska arbetsmarknaden med lokala anpassningar, svensk UX och nordisk jobbkultur.',
    gradient: 'from-teal-400/15 to-cyan-500/15',
    iconGlow: 'shadow-teal-400/20',
  },
];

const LandingFeatures = () => {
  return (
    <section
      id="funktioner"
      className="relative py-24 sm:py-32 lg:py-40 px-5 sm:px-6 md:px-12 lg:px-24"
      aria-labelledby="features-heading"
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 max-w-lg h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <div className="max-w-7xl mx-auto">
        <motion.header
          className="text-center mb-16 sm:mb-20 lg:mb-24"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-secondary text-[11px] sm:text-xs font-semibold tracking-[0.2em] uppercase mb-4 block">
            Funktioner
          </span>
          <h2
            id="features-heading"
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-[-0.03em] text-white mb-4 sm:mb-5"
          >
            Allt du behöver.
            <br />
            <span className="text-white/40">Inget du inte gör.</span>
          </h2>
          <p className="text-white/40 text-[15px] sm:text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            En komplett rekryteringsplattform byggd från grunden för att vara snabb, intuitiv och effektiv.
          </p>
        </motion.header>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.article
                key={feature.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className="group relative p-6 sm:p-7 lg:p-8 rounded-2xl border border-white/[0.06] bg-white/[0.02]
                  hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-500"
              >
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />
                <div className="relative z-10">
                  <div className={`w-11 h-11 rounded-xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center mb-5 group-hover:border-white/[0.2] transition-all duration-300 group-hover:shadow-lg ${feature.iconGlow}`}>
                    <Icon className="w-5 h-5 text-secondary" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-2.5 tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-white/40 text-[13px] sm:text-sm leading-relaxed group-hover:text-white/55 transition-colors duration-300">
                    {feature.description}
                  </p>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default LandingFeatures;
