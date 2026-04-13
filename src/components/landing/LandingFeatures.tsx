import { BarChart3, Globe2, MessageCircle, ScanFace, Shield, Zap } from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Jobbmatchning med tempo',
    description: 'Kandidater och jobb möts snabbare i ett flöde som känns modernt redan från första interaktion.',
  },
  {
    icon: ScanFace,
    title: 'Video-profiler som säger mer',
    description: 'Visa personlighet, energi och närvaro utan att allt reduceras till ett traditionellt CV.',
  },
  {
    icon: BarChart3,
    title: 'AI-screening närmare beslutet',
    description: 'Screening, urval och nästa steg presenteras i samma sammanhang så att teamet agerar snabbare.',
  },
  {
    icon: Shield,
    title: 'Byggd för förtroende',
    description: 'Trygg datahantering, tydlig struktur och ett gränssnitt som signalerar kontroll och kvalitet.',
  },
  {
    icon: MessageCircle,
    title: 'Direktdialog utan friktion',
    description: 'Från match till meddelande och intervju utan att lämna det sammanhang där beslutet redan tas.',
  },
  {
    icon: Globe2,
    title: 'Nordisk från grunden',
    description: 'Språk, struktur och produktkänsla anpassad för Sverige och Norden snarare än generisk global SaaS.',
  },
];

const LandingFeatures = () => {
  return (
    <section id="plattform" className="relative px-5 py-24 sm:px-6 sm:py-32 md:px-12 lg:px-24 lg:py-40" aria-labelledby="features-heading">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-8">
          <header className="lg:sticky lg:top-28 lg:h-fit">
            <span className="landing-eyebrow">Plattformen</span>
            <h2 id="features-heading" className="mt-6 max-w-[11ch] text-[clamp(2.35rem,5vw,4.9rem)] font-bold leading-[0.94] tracking-[-0.06em] text-pure-white">
              Ett nytt sätt att visa vad Parium faktiskt gör bäst.
            </h2>
            <p className="mt-6 max-w-[36rem] text-[1rem] leading-8 text-pure-white sm:text-[1.05rem]">
              Här handlar det inte om att rada upp generiska SaaS-kort. Varje block berättar hur kandidaten,
              arbetsgivaren och beslutet hålls samman i ett premiumflöde.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <span className="landing-signal-pill">Byggd för skala</span>
              <span className="landing-signal-pill">Hög kontrast</span>
              <span className="landing-signal-pill">Responsiv från start</span>
            </div>
          </header>

          <div className="grid gap-4">
            {features.map((feature, index) => {
              const Icon = feature.icon;

              return (
                <article
                  key={feature.title}
                  className={`landing-story-card rounded-[1.8rem] p-6 sm:p-7 lg:p-8 ${index % 2 === 1 ? 'lg:ml-14' : 'lg:mr-14'}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] border border-[hsl(var(--landing-border)/0.18)] bg-[hsl(var(--landing-panel)/0.84)]">
                      <Icon className="h-5 w-5 text-pure-white" strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-semibold tracking-[-0.03em] text-pure-white">{feature.title}</h3>
                        <span className="text-xs uppercase tracking-[0.18em] text-pure-white">0{index + 1}</span>
                      </div>
                      <p className="mt-3 max-w-[34rem] text-sm leading-7 text-pure-white sm:text-[0.96rem]">{feature.description}</p>
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
