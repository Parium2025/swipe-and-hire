const stats = [
  {
    value: 'Kortare tid',
    label: 'från intresse till dialog',
    description: 'När jobb, kandidatkort och direktmeddelanden sitter ihop försvinner onödiga stopp.',
  },
  {
    value: 'Högre precision',
    label: 'i screening och prioritering',
    description: 'AI och mänsklig bedömning möts i samma arbetsyta istället för i separata steg.',
  },
  {
    value: 'Bättre upplevelse',
    label: 'för kandidater på mobil',
    description: 'Touch, scroll, typografi och CTA:er är byggda för att kännas omedelbara.',
  },
  {
    value: 'Starkare SEO',
    label: 'för rekrytering i Norden',
    description: 'Tydlig struktur, semantik och innehåll som svarar på vad Google och användare letar efter.',
  },
];

const differentiators = [
  'Kritvit typografi i hela upplevelsen',
  'Byggd för Sverige och Norden',
  'En design som fungerar på mobil och desktop utan kompromiss',
];

const LandingStats = () => {
  return (
    <section id="bevis" className="relative px-5 py-16 sm:px-6 sm:py-24 md:px-12 lg:px-24 lg:py-28" aria-label="Resultat från Parium rekryteringsplattform">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-5">
          <article className="landing-panel-strong rounded-[2rem] p-6 sm:p-8 lg:p-10">
            <span className="landing-eyebrow">Bevis på riktning</span>
            <h2 className="mt-6 max-w-[11ch] text-[clamp(2.35rem,5vw,4.8rem)] font-bold leading-[0.94] tracking-[-0.06em] text-pure-white">
              En landningssida och produktstory som känns byggd för ett större bolag.
            </h2>
            <p className="mt-6 max-w-[37rem] text-[1rem] leading-8 text-pure-white sm:text-[1.05rem]">
              Istället för generisk SaaS-estetik lyfter Parium fram tempo, tydlighet och kontroll. Det är en upplevelse
              som berättar vad produkten faktiskt gör och varför den känns snabbare redan innan inloggning.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {differentiators.map((item) => (
                <span key={item} className="landing-signal-pill">
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-8 rounded-[1.6rem] border border-[hsl(var(--landing-border)/0.14)] bg-[hsl(var(--landing-panel)/0.58)] p-5 sm:p-6">
              <p className="text-xs uppercase tracking-[0.18em] text-pure-white">Vad sidan signalerar</p>
              <p className="mt-3 text-sm leading-7 text-pure-white sm:text-[0.96rem]">
                Modern rekrytering, nordisk precision, hög kontrast, app-nativa CTA:er och tydliga sektioner som både
                människor och sökmotorer kan förstå snabbt.
              </p>
            </div>
          </article>

          <div className="grid gap-4 sm:grid-cols-2">
            {stats.map((stat) => (
              <article key={stat.label} className="landing-metric-card rounded-[1.7rem] p-5 sm:p-6">
                <p className="text-[1.65rem] font-semibold leading-[1.02] tracking-[-0.05em] text-pure-white sm:text-[2rem]">
                  {stat.value}
                </p>
                <h3 className="mt-4 text-sm font-semibold uppercase tracking-[0.16em] text-pure-white">{stat.label}</h3>
                <p className="mt-3 text-sm leading-7 text-pure-white">{stat.description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingStats;
