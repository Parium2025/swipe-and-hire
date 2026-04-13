import { motion, useReducedMotion } from 'framer-motion';
import { BriefcaseBusiness, CalendarCheck2, MessageCircleMore, Search, UserRoundSearch, Video } from 'lucide-react';

const employerFlow = [
  {
    icon: BriefcaseBusiness,
    step: '01',
    title: 'Publicera utan att tappa fart',
    description: 'Skapa jobb med rätt struktur, rätt språk och en upplevelse som känns lika stark på mobil som desktop.',
  },
  {
    icon: UserRoundSearch,
    step: '02',
    title: 'Se rätt kandidater först',
    description: 'AI-screening, video och kriterier hjälper dig att prioritera snabbare med bättre överblick.',
  },
  {
    icon: CalendarCheck2,
    step: '03',
    title: 'Boka intervju direkt i flödet',
    description: 'När dialogen redan finns nära beslutet går steget till intervju betydligt snabbare.',
  },
];

const candidateFlow = [
  {
    icon: Search,
    step: '01',
    title: 'Upptäck jobb snabbare',
    description: 'Swipea eller sök i ett gränssnitt som känns byggt för tempo, inte för formulärtrötthet.',
  },
  {
    icon: Video,
    step: '02',
    title: 'Visa mer än ett CV',
    description: 'Kombinera profil, video och tydlig presentation för att sticka ut på ett mer mänskligt sätt.',
  },
  {
    icon: MessageCircleMore,
    step: '03',
    title: 'Kom till samtal snabbare',
    description: 'När arbetsgivaren redan ser matchning och kontext blir vägen till dialog kortare och tydligare.',
  },
];

const LandingHowItWorks = () => {
  const reduceMotion = useReducedMotion();

  const reveal = (delay = 0) => ({
    initial: { opacity: 0, y: reduceMotion ? 0 : 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.18 },
    transition: { duration: 0.68, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <section id="floden" className="relative px-5 py-24 sm:px-6 sm:py-32 md:px-12 lg:px-24 lg:py-40" aria-labelledby="how-heading">
      <div className="mx-auto max-w-7xl">
        <motion.header className="mb-14 max-w-[46rem] sm:mb-16 lg:mb-18" {...reveal()}>
          <span className="landing-eyebrow">Hur det funkar</span>
          <h2 id="how-heading" className="mt-6 text-[clamp(2.35rem,5vw,4.8rem)] font-bold leading-[0.94] tracking-[-0.06em] text-pure-white">
            Två riktningar. Ett flöde som faktiskt håller ihop.
          </h2>
          <p className="mt-6 max-w-[38rem] text-[1rem] leading-8 text-pure-white sm:text-[1.05rem]">
            Parium visar hur arbetsgivare och kandidater rör sig genom samma system med olika behov men samma premiumtempo.
          </p>
        </motion.header>

        <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
          {[
            { title: 'För arbetsgivare', description: 'Rekryteringsflödet från publicering till intervju.', items: employerFlow },
            { title: 'För kandidater', description: 'Jobbsökandet som känns snabbt, modernt och mänskligt.', items: candidateFlow },
          ].map((group, groupIndex) => (
            <motion.article key={group.title} className="landing-flow-shell landing-panel-strong rounded-[2rem] p-6 sm:p-8 lg:p-10" {...reveal(groupIndex * 0.08)}>
              <p className="text-xs uppercase tracking-[0.18em] text-pure-white">{group.title}</p>
              <p className="mt-3 max-w-[30rem] text-sm leading-7 text-pure-white sm:text-[0.96rem]">{group.description}</p>

              <div className="mt-8 grid gap-4">
                {group.items.map((step) => {
                  const Icon = step.icon;

                  return (
                    <article key={step.step} className="landing-flow-step rounded-[1.55rem] p-5 sm:p-6">
                      <div className="landing-flow-step-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] text-pure-white">
                        <Icon className="h-5 w-5" strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-lg font-semibold tracking-[-0.03em] text-pure-white">{step.title}</h3>
                          <span className="text-xs font-bold tracking-[0.18em] text-pure-white">{step.step}</span>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-pure-white">{step.description}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </motion.article>
          ))}
        </div>

        <motion.div className="landing-proof-card mt-5 rounded-[1.8rem] p-5 sm:p-6 lg:p-7" {...reveal(0.1)}>
          <p className="text-xs uppercase tracking-[0.18em] text-pure-white">Varför strukturen är bättre</p>
          <p className="mt-3 max-w-[60rem] text-sm leading-7 text-pure-white sm:text-[0.96rem]">
            Strukturen förklarar tydligt värdet för båda målgrupperna, fungerar starkare i mobil scroll och bygger SEO genom konkret semantik kring hur produkten faktiskt används.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default LandingHowItWorks;
