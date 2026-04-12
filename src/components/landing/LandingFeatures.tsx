import { motion } from 'framer-motion';
import { Zap, ScanFace, BarChart3, Shield, MessageCircle, Globe2 } from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Swipe-matchning',
    description: 'Kandidater och jobb matchas med ett swipe. Snabbare än alla traditionella plattformar.',
  },
  {
    icon: ScanFace,
    title: 'Video-profiler',
    description: 'Se personligheten bakom CV:t. Kandidater presenterar sig med korta videoklipp.',
  },
  {
    icon: BarChart3,
    title: 'AI-screening',
    description: 'Automatisk utvärdering av kandidater mot dina urvalskriterier – sparar timmar.',
  },
  {
    icon: Shield,
    title: 'GDPR-säkert',
    description: 'All data lagras i Sverige. Fullt GDPR-kompatibelt med inbyggd samtyckshantering.',
  },
  {
    icon: MessageCircle,
    title: 'Direktmeddelanden',
    description: 'Chatta direkt med kandidater och arbetsgivare. Inga omvägar – bara rak kommunikation.',
  },
  {
    icon: Globe2,
    title: 'Byggt för Norden',
    description: 'Designat för den nordiska arbetsmarknaden med lokala anpassningar och svenska som grund.',
  },
];

const LandingFeatures = () => {
  return (
    <section className="relative py-24 sm:py-32 px-6 md:px-12 lg:px-24">
      {/* Subtle divider glow */}
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
            Funktioner
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
            Allt du behöver, inget du inte gör
          </h2>
          <p className="text-white/50 text-base sm:text-lg max-w-2xl mx-auto">
            En komplett rekryteringsplattform byggd från grunden för att vara snabb, intuitiv och effektiv.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="group relative p-6 sm:p-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-500"
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-secondary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-secondary/10 border border-secondary/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="w-5 h-5 text-secondary" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2 tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-white/45 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default LandingFeatures;
