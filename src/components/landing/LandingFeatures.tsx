import { motion, useReducedMotion } from 'framer-motion';
import { BarChart3, Globe2, MessageCircle, ScanFace, Shield, Zap } from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Jobbmatchning med verkligt tempo',
    description: 'Kandidater och jobb möts snabbare i en upplevelse som känns byggd för fart från första sekund.',
    points: ['Snabbare första signal', 'Mindre friktion före kontakt'],
    span: 'lg:col-span-7',
  },
  {
    icon: ScanFace,
    title: 'Video-profiler som säger mer',
    description: 'Visa personlighet, energi och närvaro utan att allt reduceras till ett traditionellt CV.',
    points: ['Mer mänsklig presentation', 'Starkare första intryck'],
    span: 'lg:col-span-5',
  },
  {
    icon: BarChart3,
    title: 'AI-screening närmare beslutet',
    description: 'Screening, urval och nästa steg presenteras i samma sammanhang så att teamet agerar snabbare.',
    points: ['Ingen separat triagevy', 'Prioritering direkt i flödet'],
    span: 'lg:col-span-4',
  },
  {
    icon: Shield,
    title: 'Byggd för förtroende',
    description: 'Trygg struktur, tydligt språk och ett gränssnitt som signalerar kontroll och kvalitet.',
    points: ['Hög kontrast', 'Premiumkänsla på varje skärm'],
    span: 'lg:col-span-4',
  },
  {
    icon: MessageCircle,
    title: 'Direktdialog utan friktion',
    description: 'Från match till meddelande och intervju utan att lämna det sammanhang där beslutet redan tas.',
    points: ['Mindre verktygsbyte', 'Kortare väg till intervju'],
    span: 'lg:col-span-4',
  },
  {
    icon: Globe2,
    title: 'Nordisk från grunden',
    description: 'Språk, struktur och produktkänsla anpassad för Sverige och Norden snarare än generisk global SaaS.',
    points: ['SEO för nordisk rekrytering', 'Copy som speglar produkten'],
    span: 'lg:col-span-12',
  },
];

const LandingFeatures = () => {
  const reduceMotion = useReducedMotion();

  const reveal = (delay = 0) => ({
    initial: { opacity: 0, y: reduceMotion ? 0 : 26 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.18 },
    transition: { duration: 0.68, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <section id="plattform" className="relative px-5 py-24 sm:px-6 sm:py-32 md:px-12 lg:px-24 lg:py-40" aria-labelledby="features-heading">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:gap-8">
          <motion.header className="lg:sticky lg:top-28 lg:h-fit" {...reveal()}>
            <span className="landing-eyebrow">Plattformen</span>
            <h2 id="features-heading" className="mt-6 max-w-[11ch] text-[clamp(2.35rem,5vw,4.9rem)] font-bold leading-[0.94] tracking-[-0.06em] text-pure-white">
              Det här sticker ut för att allt känns gjort med riktning.
            </h2>
            <p className="mt-6 max-w-[36rem] text-[1rem] leading-8 text-pure-white sm:text-[1.05rem]">
              Istället för generiska kort bygger sektionen upp en tydlig produktstory: hur kandidaten, arbetsgivaren och beslutet hålls ihop i samma premiumflöde.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <span className="landing-signal-pill">Byggd för skala</span>
              <span className="landing-signal-pill">Hög kontrast</span>
              <span className="landing-signal-pill">Responsiv från start</span>
            </div>
          </motion.header>

          <div className="grid gap-4 lg:grid-cols-12">
            {features.map((feature, index) => {
              const Icon = feature.icon;

              return (
                <motion.article
                  key={feature.title}
                  className={`landing-feature-card rounded-[1.8rem] p-6 sm:p-7 lg:p-8 ${feature.span} ${index < 2 ? 'landing-feature-card-tall' : ''}`}
                  {...reveal(index * 0.06)}
                >
                  <div className="flex items-start gap-4">
                    <div className="landing-showcase-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] text-pure-white">
                      <Icon className="h-5 w-5" strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="landing-feature-label">0{index + 1}</span>
                        <h3 className="text-xl font-semibold tracking-[-0.03em] text-pure-white">{feature.title}</h3>
                      </div>
                      <p className="mt-3 max-w-[34rem] text-sm leading-7 text-pure-white sm:text-[0.96rem]">{feature.description}</p>
                      <div className="mt-5 flex flex-wrap gap-3">
                        {feature.points.map((point) => (
                          <span key={point} className="landing-signal-pill">
                            {point}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingFeatures;
