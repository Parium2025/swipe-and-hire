import { motion } from 'framer-motion';
import { Zap, ScanFace, BarChart3, Shield, MessageCircle, Globe2 } from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Swipe-matchning',
    description: 'Kandidater och jobb matchas med ett swipe. Snabbare och mer träffsäkert än traditionell rekrytering.',
  },
  {
    icon: ScanFace,
    title: 'Video-profiler',
    description: 'Se personligheten bakom CV:t. Kandidater presenterar sig med korta, autentiska videoklipp.',
  },
  {
    icon: BarChart3,
    title: 'AI-driven screening',
    description: 'Automatisk AI-utvärdering mot dina urvalskriterier. Spara timmar av manuellt arbete varje vecka.',
  },
  {
    icon: Shield,
    title: 'GDPR-säkert',
    description: 'All data lagras tryggt och plattformen är byggd för modern dataskyddshantering.',
  },
  {
    icon: MessageCircle,
    title: 'Direktmeddelanden',
    description: 'Chatta, följ upp och boka intervjuer direkt i plattformen utan omvägar.',
  },
  {
    icon: Globe2,
    title: 'Byggt för Norden',
    description: 'Skapat för Sverige och Norden med lokala flöden, språk och rekryteringsbeteenden i fokus.',
  },
];

const LandingFeatures = () => {
  return (
    <section
      id="funktioner"
      className="relative px-5 py-24 sm:px-6 sm:py-32 md:px-12 lg:px-24 lg:py-40"
      aria-labelledby="features-heading"
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
            Funktioner
          </span>
          <h2 id="features-heading" className="mb-4 text-3xl font-bold tracking-[-0.03em] text-white sm:mb-5 sm:text-4xl md:text-5xl">
            Rekryteringsverktyget som
            <br />
            <span className="text-white">faktiskt känns snabbt.</span>
          </h2>
          <p className="mx-auto max-w-xl text-[15px] leading-relaxed text-white/80 sm:text-base md:text-lg">
            Ett modernt system för rekrytering, jobbmatchning, screening och dialog — byggt för att kännas premium i varje steg.
          </p>
        </motion.header>

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.article
                key={feature.title}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-500 hover:border-white/[0.12] hover:bg-white/[0.04] sm:p-7 lg:p-8"
              >
                <div className="relative z-10">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.05] transition-all duration-300 group-hover:border-white/[0.18]">
                    <Icon className="h-5 w-5 text-white" strokeWidth={1.5} />
                  </div>
                  <h3 className="mb-2.5 text-base font-semibold tracking-tight text-white sm:text-lg">
                    {feature.title}
                  </h3>
                  <p className="text-[13px] leading-relaxed text-white/78 sm:text-sm">
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
