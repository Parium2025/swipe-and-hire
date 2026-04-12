import { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BriefcaseBusiness, MessageSquareText, ScanSearch, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Globe = lazy(() => import('./Globe'));

const signalPills = ['AI-screening', 'Swipe-matchning', 'Video-profiler', 'Direktmeddelanden'];

const trustStats = [
  {
    value: '500+',
    label: 'företag i tidig åtkomst',
  },
  {
    value: '60 sek',
    label: 'från signal till första kontakt',
  },
  {
    value: 'Allt i ett',
    label: 'rekrytering, chat och intervju',
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
      className="relative overflow-hidden px-5 pb-20 pt-28 sm:px-6 sm:pt-32 md:px-12 lg:px-24 lg:pb-24"
      aria-label="Parium – AI-driven rekryteringsplattform för kandidater och arbetsgivare i Norden"
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute left-[-12%] top-[8%] h-[28rem] w-[28rem] rounded-full bg-[hsl(var(--secondary)/0.08)] blur-[120px]" />
        <div className="absolute right-[-10%] top-[12%] h-[34rem] w-[34rem] rounded-full bg-[hsl(var(--secondary)/0.16)] blur-[160px]" />
        <div className="landing-orbit-ring landing-orbit-spin absolute left-[-8rem] top-[8rem] h-[52rem] w-[52rem] rounded-full" />
        <div className="landing-orbit-ring landing-orbit-spin-reverse absolute right-[-12rem] top-[-6rem] h-[60rem] w-[60rem] rounded-full" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="grid items-center gap-14 lg:min-h-[calc(100dvh-9rem)] lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] lg:gap-8">
          <div className="relative max-w-[42rem]">
            <span className="landing-eyebrow">
              <span className="h-2 w-2 rounded-full bg-[hsl(var(--secondary))] shadow-[0_0_24px_hsl(var(--secondary)/0.65)]" />
              AI-rekrytering för Sverige och Norden
            </span>

            <h1 className="mt-7 max-w-[10ch] text-[clamp(3.4rem,10vw,7.4rem)] font-bold leading-[0.92] tracking-[-0.07em] text-pure-white">
              Rekrytering för bolag som bygger före alla andra.
            </h1>

            <p className="mt-7 max-w-[36rem] text-[1rem] leading-8 text-pure-white sm:text-[1.05rem] lg:text-[1.12rem]">
              Parium är en AI-driven rekryteringsplattform för företag och kandidater som vill matcha snabbare,
              anställa smartare och hålla hela flödet i ett system — från jobbannons och swipe-matchning till
              screening, direktmeddelanden och intervju.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              {signalPills.map((pill) => (
                <span key={pill} className="landing-signal-pill">
                  {pill}
                </span>
              ))}
            </div>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button variant="glass" onClick={() => goTo('employer')} className="landing-primary-button group px-7 text-base font-semibold">
                <BriefcaseBusiness className="h-4 w-4" />
                Skapa företagskonto
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Button>
              <Button variant="glass" onClick={() => goTo('job_seeker')} className="landing-secondary-button group px-7 text-base font-semibold">
                <Sparkles className="h-4 w-4" />
                Jag söker jobb
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Button>
            </div>

            <p className="mt-5 text-sm leading-7 text-pure-white">
              Anpassad för touch, mus, Android, iPhone, surfplatta, laptop och stora skärmar — med samma premiumkänsla överallt.
            </p>

            <dl className="mt-10 grid gap-4 sm:grid-cols-3">
              {trustStats.map((stat) => (
                <div key={stat.label} className="landing-panel rounded-[1.5rem] p-4 sm:p-5">
                  <dt className="text-xs uppercase tracking-[0.18em] text-pure-white">{stat.label}</dt>
                  <dd className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-pure-white">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative flex min-h-[24rem] items-center justify-center sm:min-h-[31rem] lg:min-h-[44rem]">
            <div className="absolute inset-0 bg-[radial-gradient(circle,hsl(var(--secondary)/0.14)_0%,hsl(var(--secondary)/0)_68%)] blur-3xl" aria-hidden="true" />
            <div className="relative mx-auto flex w-full max-w-[46rem] items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-[hsl(var(--landing-border)/0.08)]" aria-hidden="true" />
              <div className="relative h-[min(112vw,34rem)] w-[min(112vw,34rem)] sm:h-[min(82vw,44rem)] sm:w-[min(82vw,44rem)] lg:h-[min(74vw,66rem)] lg:w-[min(74vw,66rem)]">
                <Suspense fallback={<div className="absolute inset-0 rounded-full bg-[hsl(var(--landing-panel)/0.72)]" />}>
                  <Globe className="h-full w-full" />
                </Suspense>
              </div>

              <article className="landing-panel absolute left-[1%] top-[9%] hidden max-w-[15rem] rounded-[1.5rem] p-4 md:block">
                <p className="text-xs uppercase tracking-[0.18em] text-pure-white">Norden först</p>
                <p className="mt-3 text-sm leading-6 text-pure-white">
                  Fokuserad på Sverige och Norden med lokala rekryteringsflöden, språk och beteenden i centrum.
                </p>
              </article>

              <article className="landing-panel absolute bottom-[8%] left-[4%] max-w-[16rem] rounded-[1.5rem] p-4 sm:left-[8%]">
                <div className="flex items-center gap-2 text-pure-white">
                  <ScanSearch className="h-4 w-4" />
                  <p className="text-xs uppercase tracking-[0.18em]">AI-screening</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-pure-white">
                  Sortera kandidater snabbare mot rätt kriterier och gå från intresse till intervju utan onödiga mellanled.
                </p>
              </article>

              <article className="landing-panel absolute right-[2%] top-[18%] hidden max-w-[15rem] rounded-[1.5rem] p-4 lg:block">
                <div className="flex items-center gap-2 text-pure-white">
                  <MessageSquareText className="h-4 w-4" />
                  <p className="text-xs uppercase tracking-[0.18em]">Direktdialog</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-pure-white">
                  Kandidat, jobb, meddelanden och intervju i samma premiumflöde — utan splittrade verktyg.
                </p>
              </article>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingHero;
