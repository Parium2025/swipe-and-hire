import { useNavigate } from 'react-router-dom';
import { ArrowRight, BriefcaseBusiness, ShieldCheck, Sparkles, TrendingUp, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';

const signalPills = ['AI-screening', 'Jobbmatchning', 'Video-profiler', 'Direktdialog'];

const trustStats = [
  { value: '01', label: 'ett flöde för hela rekryteringen' },
  { value: '60s', label: 'från signal till första kontakt' },
  { value: '∞', label: 'byggt för mobil, touch och desktop' },
];

const flowHighlights = [
  {
    title: 'Kandidater prioriteras efter faktisk match',
    detail: 'AI-screening, video och urval i samma vy för snabbare beslut utan tab-kaos.',
  },
  {
    title: 'Dialog startar där beslutet redan tas',
    detail: 'Meddelanden, jobb, kandidatkort och intervju sitter ihop från början.',
  },
  {
    title: 'Nordisk känsla i både språk och beteende',
    detail: 'Designat för Sverige och Norden med hög kontrast, tempo och premiumkänsla.',
  },
];

const LandingHero = () => {
  const navigate = useNavigate();

  const goTo = (role: 'job_seeker' | 'employer') => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register', role } });
  };

  return (
    <section
      id="top"
      className="relative overflow-hidden px-5 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32 md:px-12 lg:px-24 lg:pb-24"
      aria-label="Parium – AI-driven rekryteringsplattform för kandidater och arbetsgivare i Norden"
    >
      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="grid items-start gap-10 lg:min-h-[calc(100dvh-8rem)] lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:items-center lg:gap-12">
          <div className="relative max-w-[44rem]">
            <span className="landing-eyebrow">
              <span className="h-2 w-2 rounded-full bg-[hsl(var(--secondary))] shadow-[0_0_24px_hsl(var(--secondary)/0.55)]" />
              AI-rekrytering för Sverige och Norden
            </span>

            <h1 className="mt-7 max-w-[11ch] text-[clamp(3.15rem,10vw,7.6rem)] font-bold leading-[0.9] tracking-[-0.08em] text-pure-white">
              Rekrytering som känns som en premiumprodukt, inte ett gammalt HR-system.
            </h1>

            <p className="mt-7 max-w-[39rem] text-[1rem] leading-8 text-pure-white sm:text-[1.05rem] lg:text-[1.12rem]">
              Parium samlar jobb, kandidater, video, AI-screening, direktdialog och intervju i ett sammanhängande flöde
              för företag och kandidater som vill röra sig snabbare utan att kompromissa med känsla eller kontroll.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              {signalPills.map((pill) => (
                <span key={pill} className="landing-signal-pill">
                  {pill}
                </span>
              ))}
            </div>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button variant="glassBlue" onClick={() => goTo('employer')} className="group px-7 text-base font-semibold">
                <BriefcaseBusiness className="h-4 w-4" />
                Skapa företagskonto
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Button>
              <Button variant="glass" onClick={() => goTo('job_seeker')} className="group px-7 text-base font-semibold">
                <Sparkles className="h-4 w-4" />
                Hitta jobb nu
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Button>
            </div>

            <p className="mt-5 text-sm leading-7 text-pure-white">
              Anpassad för Android, iPhone, surfplatta, laptop, stationär dator, touch och mus — med samma premiumkänsla överallt.
            </p>

            <dl className="mt-10 grid gap-4 sm:grid-cols-3">
              {trustStats.map((stat) => (
                <div key={stat.label} className="landing-metric-card rounded-[1.6rem] p-4 sm:p-5">
                  <dd className="text-[1.9rem] font-semibold tracking-[-0.06em] text-pure-white sm:text-[2.2rem]">{stat.value}</dd>
                  <dt className="mt-2 text-xs uppercase tracking-[0.16em] text-pure-white">{stat.label}</dt>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <div className="landing-stage-frame mx-auto max-w-[46rem] overflow-hidden rounded-[2rem] p-4 sm:p-5 lg:p-6">
              <div className="landing-stage-beam" aria-hidden="true" />
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <article className="landing-command-screen rounded-[1.7rem] p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-pure-white">Live recruiting signal</p>
                      <p className="mt-2 text-[1.45rem] font-semibold tracking-[-0.04em] text-pure-white sm:text-[1.75rem]">
                        Allt viktigt syns innan någon annan ens hunnit öppna nästa verktyg.
                      </p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] border border-[hsl(var(--landing-border)/0.18)] bg-[hsl(var(--landing-panel)/0.82)] text-pure-white">
                      <Workflow className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3">
                    {flowHighlights.map((item, index) => (
                      <article key={item.title} className="landing-story-card rounded-[1.35rem] p-4 sm:p-5">
                        <div className="flex items-start gap-4">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--landing-border)/0.18)] bg-[hsl(var(--landing-panel)/0.84)] text-xs font-bold tracking-[0.16em] text-pure-white">
                            0{index + 1}
                          </span>
                          <div>
                            <h2 className="text-base font-semibold tracking-[-0.03em] text-pure-white sm:text-lg">{item.title}</h2>
                            <p className="mt-2 text-sm leading-7 text-pure-white">{item.detail}</p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </article>

                <div className="grid gap-4">
                  <article className="landing-metric-card rounded-[1.6rem] p-5 sm:p-6">
                    <div className="flex items-center gap-3 text-pure-white">
                      <ShieldCheck className="h-5 w-5" />
                      <p className="text-xs uppercase tracking-[0.18em]">Premiumkontroll</p>
                    </div>
                    <p className="mt-4 text-[2.6rem] font-semibold leading-none tracking-[-0.08em] text-pure-white">100%</p>
                    <p className="mt-3 text-sm leading-7 text-pure-white">
                      Hög kontrast, rena beslutspunkter och en upplevelse som håller ihop på varje skärmstorlek.
                    </p>
                  </article>

                  <article className="landing-metric-card rounded-[1.6rem] p-5 sm:p-6">
                    <div className="flex items-center gap-3 text-pure-white">
                      <TrendingUp className="h-5 w-5" />
                      <p className="text-xs uppercase tracking-[0.18em]">Nordic scale</p>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="rounded-[1.1rem] border border-[hsl(var(--landing-border)/0.14)] bg-[hsl(var(--landing-panel)/0.62)] px-4 py-3">
                        <p className="text-sm font-semibold text-pure-white">Företag</p>
                        <p className="mt-1 text-sm leading-6 text-pure-white">Publicera jobb, screena snabbare, boka intervju direkt.</p>
                      </div>
                      <div className="rounded-[1.1rem] border border-[hsl(var(--landing-border)/0.14)] bg-[hsl(var(--landing-panel)/0.62)] px-4 py-3">
                        <p className="text-sm font-semibold text-pure-white">Kandidater</p>
                        <p className="mt-1 text-sm leading-6 text-pure-white">Swipea, visa personlighet och gå från intresse till samtal snabbare.</p>
                      </div>
                    </div>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingHero;
