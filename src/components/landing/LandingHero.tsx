import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, BriefcaseBusiness, MessageCircle, ShieldCheck, Sparkles, TrendingUp, Video, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';

const signalPills = ['AI-screening', 'Jobbmatchning', 'Video-profiler', 'Direktdialog', 'Mobil först', 'SEO-byggd'];

const trustStats = [
  { value: 'Ett flöde', label: 'jobb, screening, dialog och intervju i samma produkt' },
  { value: 'Mobil först', label: 'byggt för touch, mus, surfplatta och desktop' },
  { value: 'SEO-maxat', label: 'skrivet semantiskt för att synas hårdare på Google' },
];

const flowHighlights = [
  {
    icon: Workflow,
    title: 'AI-screening ligger nära beslutet',
    detail: 'Kandidater sorteras i ett levande flöde istället för i stillastående listor och gamla systemvyer.',
  },
  {
    icon: MessageCircle,
    title: 'Dialogen startar där matchningen redan syns',
    detail: 'Meddelanden, jobb och intervjuer sitter ihop så att vägen från signal till kontakt känns omedelbar.',
  },
  {
    icon: Video,
    title: 'Video ger personlighet utan extra friktion',
    detail: 'Kandidater kan visa mer än ett CV och arbetsgivare får snabbare en känsla för rätt matchning.',
  },
];

const spotlightCards = [
  {
    label: 'För arbetsgivare',
    value: 'Mer kontroll',
    detail: 'Publicera, prioritera och boka utan att lämna samma rytm.',
  },
  {
    label: 'För kandidater',
    value: 'Mer synlighet',
    detail: 'Jobb, profil och direktkontakt i en snabbare upplevelse.',
  },
];

const LandingHero = () => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const reveal = (delay = 0) => ({
    initial: { opacity: 0, y: reduceMotion ? 0 : 28 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.25 },
    transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  const goTo = (role: 'job_seeker' | 'employer') => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register', role } });
  };

  return (
    <section
      id="top"
      className="relative overflow-hidden px-5 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-32 md:px-12 lg:px-24 lg:pb-32"
      aria-label="Parium – AI-driven rekryteringsplattform för kandidater och arbetsgivare i Norden"
    >
      <div className="landing-hero-backdrop" aria-hidden="true">
        <div className="landing-hero-orb landing-hero-orb-primary" />
        <div className="landing-hero-orb landing-hero-orb-secondary" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="grid items-start gap-10 lg:min-h-[calc(100dvh-9rem)] lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] lg:items-center lg:gap-12">
          <motion.div className="relative max-w-[46rem]" {...reveal()}>
            <motion.span className="landing-eyebrow" {...reveal(0.05)}>
              <span className="h-2 w-2 rounded-full bg-[hsl(var(--secondary))] shadow-[0_0_24px_hsl(var(--secondary)/0.55)]" />
              Premium AI-rekrytering för Sverige och Norden
            </motion.span>

            <motion.h1
              id="landing-hero-heading"
              className="mt-7 max-w-[11ch] text-[clamp(3.2rem,10vw,7.8rem)] font-bold leading-[0.88] tracking-[-0.08em] text-pure-white"
              {...reveal(0.12)}
            >
              Rekrytering som känns som nästa stora produkt, inte samma gamla jobbsajt.
            </motion.h1>

            <motion.p className="mt-7 max-w-[39rem] text-[1rem] leading-8 text-pure-white sm:text-[1.05rem] lg:text-[1.12rem]" {...reveal(0.18)}>
              Parium samlar jobb, kandidater, video, AI-screening, direktdialog och intervju i ett sammanhängande flöde
              för företag och kandidater som vill röra sig snabbare utan att kompromissa med känsla, kontroll eller premiumkänsla.
            </motion.p>

            <motion.div className="mt-7 flex flex-wrap gap-3" {...reveal(0.24)}>
              {signalPills.map((pill) => (
                <span key={pill} className="landing-signal-pill">
                  {pill}
                </span>
              ))}
            </motion.div>

            <motion.div className="mt-10 flex flex-col gap-3 sm:flex-row" {...reveal(0.3)}>
              <Button variant="glassBlue" onClick={() => goTo('employer')} className="landing-primary-button group px-7 text-base font-semibold">
                <BriefcaseBusiness className="h-4 w-4" />
                Skapa företagskonto
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Button>
              <Button variant="glass" onClick={() => goTo('job_seeker')} className="landing-secondary-button group px-7 text-base font-semibold">
                <Sparkles className="h-4 w-4" />
                Hitta jobb nu
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Button>
            </motion.div>

            <motion.p className="mt-5 text-sm leading-7 text-pure-white" {...reveal(0.34)}>
              Anpassad för Android, iPhone, surfplatta, laptop, stationär dator, touch och mus — med samma premiumkänsla överallt.
            </motion.p>

            <motion.dl className="mt-10 grid gap-4 sm:grid-cols-3" {...reveal(0.4)}>
              {trustStats.map((stat) => (
                <div key={stat.label} className="landing-metric-bar rounded-[1.6rem] p-4 sm:p-5">
                  <dd className="text-[1.4rem] font-semibold tracking-[-0.05em] text-pure-white sm:text-[1.7rem]">{stat.value}</dd>
                  <dt className="mt-2 text-sm leading-6 text-pure-white">{stat.label}</dt>
                </div>
              ))}
            </motion.dl>
          </motion.div>

          <motion.div className="relative" {...reveal(0.16)}>
            <div className="landing-showcase-shell mx-auto max-w-[48rem]">
              <div className="landing-showcase-grid">
                <article className="landing-showcase-main rounded-[1.9rem] p-5 sm:p-6 lg:p-7">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="landing-kicker">Live recruiting signal</p>
                      <p className="mt-3 max-w-[18ch] text-[1.55rem] font-semibold tracking-[-0.05em] text-pure-white sm:text-[2rem]">
                        Allt viktigt rör sig i samma riktning redan i första scrollen.
                      </p>
                    </div>
                    <div className="landing-status-pill flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-pure-white">
                      <span className="landing-status-dot" />
                      Live
                    </div>
                  </div>

                  <p className="mt-5 max-w-[36rem] text-sm leading-7 text-pure-white sm:text-[0.98rem]">
                    Ingen generisk SaaS-layout. Här känns Parium som ett rekryteringsoperativsystem med puls, riktning och tydlig premiumenergi.
                  </p>

                  <div className="mt-6 grid gap-3">
                    {flowHighlights.map((item, index) => {
                      const Icon = item.icon;

                      return (
                      <article key={item.title} className="landing-showcase-card rounded-[1.45rem] p-4 sm:p-5">
                        <div className="flex items-start gap-4">
                          <span className="landing-showcase-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] text-pure-white">
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className="landing-showcase-step flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold tracking-[0.16em] text-pure-white">
                            0{index + 1}
                          </span>
                          <div>
                            <h2 className="text-base font-semibold tracking-[-0.03em] text-pure-white sm:text-lg">{item.title}</h2>
                            <p className="mt-2 text-sm leading-7 text-pure-white">{item.detail}</p>
                          </div>
                        </div>
                      </article>
                    )})}
                  </div>
                </article>

                <div className="grid gap-4">
                  <article className="landing-mini-panel rounded-[1.6rem] p-5 sm:p-6">
                    <div className="flex items-center gap-3 text-pure-white">
                      <ShieldCheck className="h-5 w-5" />
                      <p className="text-xs uppercase tracking-[0.18em]">Premiumkontroll</p>
                    </div>
                    <p className="mt-4 text-[2.2rem] font-semibold leading-none tracking-[-0.08em] text-pure-white">Hög kontrast</p>
                    <p className="mt-3 text-sm leading-7 text-pure-white">
                      Kritvit typografi, app-nativa knappar och en upplevelse som känns konsekvent över varje skärmstorlek.
                    </p>
                  </article>

                  <article className="landing-mini-panel rounded-[1.6rem] p-5 sm:p-6">
                    <div className="flex items-center gap-3 text-pure-white">
                      <TrendingUp className="h-5 w-5" />
                      <p className="text-xs uppercase tracking-[0.18em]">Momentum</p>
                    </div>
                    <div className="mt-4 space-y-3">
                      {spotlightCards.map((card) => (
                        <div key={card.label} className="landing-metric-pill rounded-[1.1rem] px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-pure-white">{card.label}</p>
                          <p className="mt-2 text-base font-semibold text-pure-white">{card.value}</p>
                          <p className="mt-1 text-sm leading-6 text-pure-white">{card.detail}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>
              </div>

              <div className="landing-float-badge landing-float-badge-top rounded-full px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-pure-white">
                Sverige · Norden · AI-rekrytering
              </div>
              <div className="landing-float-badge landing-float-badge-bottom rounded-full px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-pure-white">
                Touch · Mus · Desktop · Mobil
              </div>
            </div>
          </motion.div>
        </div>

        <div className="landing-ticker mt-8 rounded-full px-4 py-3 sm:px-5">
          <div className="landing-ticker-track">
            {[...signalPills, ...signalPills].map((item, index) => (
              <span key={`${item}-${index}`} className="landing-ticker-item">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingHero;
