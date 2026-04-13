import { motion, useReducedMotion } from 'framer-motion';
import { MousePointer2, SearchCheck, ShieldCheck, Smartphone } from 'lucide-react';

const stats = [
  {
    icon: SearchCheck,
    value: 'Tydligare signaler',
    label: 'innan första klicket ens hunnit svalna',
    description: 'När jobb, matchning och kommunikation sitter ihop blir nästa steg självklart snabbare.',
  },
  {
    icon: ShieldCheck,
    value: 'Mindre friktion',
    label: 'mellan screening, urval och intervju',
    description: 'AI och mänsklig bedömning arbetar i samma arbetsyta istället för i separata verktyg.',
  },
  {
    icon: Smartphone,
    value: 'Starkare mobilkänsla',
    label: 'för touch, scroll och tempo',
    description: 'Kandidater möter en upplevelse som känns byggd för handen, inte nedskalad från desktop.',
  },
  {
    icon: MousePointer2,
    value: 'Mer synlighet',
    label: 'med semantik som hjälper SEO på riktigt',
    description: 'Tydlig struktur, korrekta rubriker och konkret copy gör sidan starkare för både människor och Google.',
  },
];

const differentiators = [
  'Kritvit typografi i hela upplevelsen',
  'App-nativa knappar istället för vita standard-CTA:er',
  'Asymmetrisk premiumlayout som känns byggd för produktbolag',
  'Byggd för Sverige och Norden utan generisk SaaS-estetik',
];

const LandingStats = () => {
  const reduceMotion = useReducedMotion();

  const reveal = (delay = 0) => ({
    initial: { opacity: 0, y: reduceMotion ? 0 : 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <section id="bevis" className="relative px-5 py-16 sm:px-6 sm:py-24 md:px-12 lg:px-24 lg:py-28" aria-label="Resultat från Parium rekryteringsplattform">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:gap-5">
          <motion.article className="landing-panel-strong rounded-[2rem] p-6 sm:p-8 lg:sticky lg:top-28 lg:h-fit lg:p-10" {...reveal()}>
            <span className="landing-eyebrow">Bevis på riktning</span>
            <h2 className="mt-6 max-w-[11ch] text-[clamp(2.35rem,5vw,4.8rem)] font-bold leading-[0.92] tracking-[-0.06em] text-pure-white">
              Här känns Parium som ett premiumvarumärke redan innan inloggning.
            </h2>
            <p className="mt-6 max-w-[37rem] text-[1rem] leading-8 text-pure-white sm:text-[1.05rem]">
              Istället för samma gamla rekryteringsspråk lyfter sidan fram tempo, precision, mobilkänsla och tydliga nästa steg.
              Det gör att produkten känns större, skarpare och mer minnesvärd direkt.
            </p>

            <div className="mt-8 grid gap-3">
              {differentiators.map((item) => (
                <div key={item} className="landing-proof-list-item rounded-[1.2rem] px-4 py-3 text-sm leading-7 text-pure-white">
                  {item}
                </div>
              ))}
            </div>

            <div className="landing-proof-card landing-proof-card-featured mt-8 rounded-[1.6rem] p-5 sm:p-6">
              <p className="text-xs uppercase tracking-[0.18em] text-pure-white">Vad sidan signalerar</p>
              <p className="mt-3 text-sm leading-7 text-pure-white sm:text-[0.96rem]">
                Modern rekrytering, nordisk precision, hög kontrast, tydlig semantik och en premiumkomposition som känns utvecklad med intention — inte framtagen från en mall.
              </p>
            </div>
          </motion.article>

          <div className="grid gap-4 sm:grid-cols-2">
            {stats.map((stat, index) => {
              const Icon = stat.icon;

              return (
              <motion.article
                key={stat.label}
                className={`landing-proof-card rounded-[1.7rem] p-5 sm:p-6 ${index === 0 ? 'sm:col-span-2' : ''}`}
                {...reveal(index * 0.08)}
              >
                <div className="landing-showcase-icon flex h-12 w-12 items-center justify-center rounded-[1rem] text-pure-white">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-5 text-[1.65rem] font-semibold leading-[1.02] tracking-[-0.05em] text-pure-white sm:text-[2rem]">
                  {stat.value}
                </p>
                <h3 className="mt-4 text-sm font-semibold uppercase tracking-[0.16em] text-pure-white">{stat.label}</h3>
                <p className="mt-3 text-sm leading-7 text-pure-white">{stat.description}</p>
              </motion.article>
            )})}
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingStats;
