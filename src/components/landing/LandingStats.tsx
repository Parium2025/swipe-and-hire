const stats = [
  {
    value: '60 sek',
    label: 'från match till första kontakt',
    description: 'Kortare väg mellan relevant kandidat, jobbintresse och faktisk dialog.',
  },
  {
    value: '3x snabbare',
    label: 'screening och urval',
    description: 'AI-rekrytering som sorterar bättre och tidigare i processen.',
  },
  {
    value: '500+',
    label: 'företag i tidig åtkomst',
    description: 'Ett växande nätverk av arbetsgivare som vill rekrytera snabbare.',
  },
  {
    value: '94%',
    label: 'upplever bättre överblick',
    description: 'All kommunikation, screening och intervju samlad i samma flöde.',
  },
];

const differentiators = [
  'Byggd för Sverige och Norden',
  'Optimerad för mobil, touch och desktop',
  'Kandidat, jobb och intervju i ett system',
];

const LandingStats = () => {
  return (
    <section id="bevis" className="relative px-5 py-16 sm:px-6 sm:py-24 md:px-12 lg:px-24 lg:py-28" aria-label="Resultat från Parium rekryteringsplattform">
      <div className="mx-auto max-w-7xl">
        <div className="landing-panel-strong rounded-[2rem] p-6 sm:p-8 lg:p-10">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:gap-12">
            <div>
              <span className="landing-eyebrow">Bevis på tempo</span>
              <h2 className="mt-6 max-w-[12ch] text-[clamp(2.35rem,5vw,4.6rem)] font-bold leading-[0.96] tracking-[-0.05em] text-pure-white">
                Ett rekryteringsverktyg som rör sig lika snabbt som ditt bolag.
              </h2>
              <p className="mt-6 max-w-[34rem] text-[1rem] leading-8 text-pure-white sm:text-[1.05rem]">
                Parium samlar AI-screening, jobbmatchning, kandidatdialog och intervjubokning i en modern plattform.
                Resultatet är mindre friktion, tydligare överblick och ett rekryteringsflöde som känns byggt för nu.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {differentiators.map((item) => (
                  <span key={item} className="landing-signal-pill">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {stats.map((stat) => (
                <article key={stat.label} className="landing-panel rounded-[1.6rem] p-5 sm:p-6">
                  <p className="text-[clamp(2rem,4vw,3.2rem)] font-bold leading-none tracking-[-0.05em] text-pure-white">
                    {stat.value}
                  </p>
                  <h3 className="mt-4 text-sm font-semibold uppercase tracking-[0.16em] text-pure-white">
                    {stat.label}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-pure-white">{stat.description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingStats;
