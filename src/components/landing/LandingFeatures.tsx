import { BarChart3, Globe2, MessageCircle, ScanFace, Shield, Zap } from 'lucide-react';

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
      <div className="mx-auto max-w-7xl">
        <header className="mb-14 max-w-[42rem] sm:mb-18 lg:mb-20">
          <span className="landing-eyebrow">Funktioner</span>
          <h2 id="features-heading" className="mt-6 text-[clamp(2.35rem,5vw,4.7rem)] font-bold leading-[0.96] tracking-[-0.05em] text-pure-white">
            Premiumflöden för modern rekrytering.
          </h2>
          <p className="mt-6 max-w-[38rem] text-[1rem] leading-8 text-pure-white sm:text-[1.05rem]">
            Byggt för företag som vill publicera jobb, hitta kandidater, screena smartare och hålla varje konversation nära beslutet.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-5">
          <article className="landing-panel-strong rounded-[2rem] p-6 sm:p-8 lg:p-10">
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
              <div>
                <span className="landing-eyebrow">Operativ kärna</span>
                <h3 className="mt-5 text-[clamp(2rem,4vw,3.25rem)] font-bold leading-[0.98] tracking-[-0.05em] text-pure-white">
                  Ett system där kandidat, jobb och dialog alltid hänger ihop.
                </h3>
                <p className="mt-5 text-[1rem] leading-8 text-pure-white">
                  Istället för splittrade steg får du en rekryteringsplattform där jobbannonser, matchning, screening,
                  meddelanden och uppföljning rör sig i samma riktning från första kontakt till intervju.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {features.slice(0, 4).map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <article key={feature.title} className="landing-panel rounded-[1.5rem] p-5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[hsl(var(--landing-border)/0.18)] bg-[hsl(var(--landing-panel)/0.82)]">
                        <Icon className="h-5 w-5 text-pure-white" strokeWidth={1.5} />
                      </div>
                      <h4 className="mt-4 text-lg font-semibold tracking-[-0.03em] text-pure-white">{feature.title}</h4>
                      <p className="mt-3 text-sm leading-7 text-pure-white">{feature.description}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </article>

          <div className="grid gap-4">
            {features.slice(4).map((feature) => {
              const Icon = feature.icon;

              return (
                <article key={feature.title} className="landing-panel rounded-[1.8rem] p-6 sm:p-7 lg:p-8">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-[hsl(var(--landing-border)/0.18)] bg-[hsl(var(--landing-panel)/0.84)]">
                      <Icon className="h-5 w-5 text-pure-white" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold tracking-[-0.03em] text-pure-white">{feature.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-pure-white">{feature.description}</p>
                    </div>
                  </div>
                </article>
              );
            })}
        </div>
      </div>
      </div>
    </section>
  );
};

export default LandingFeatures;
