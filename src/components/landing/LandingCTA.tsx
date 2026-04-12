import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LandingCTA = () => {
  const navigate = useNavigate();

  const handleStart = (role?: 'job_seeker' | 'employer') => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register', role } });
  };

  return (
    <section id="kontakt" className="relative px-5 py-24 sm:px-6 sm:py-32 md:px-12 lg:px-24 lg:py-40" aria-label="Kom igång med Parium rekryteringsplattform">
      <div className="mx-auto max-w-7xl">
        <div className="landing-panel-strong relative overflow-hidden rounded-[2.2rem] p-6 sm:p-8 lg:p-12">
          <div className="absolute right-[-10%] top-[-20%] h-[22rem] w-[22rem] rounded-full bg-[hsl(var(--secondary)/0.12)] blur-[120px]" aria-hidden="true" />
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-end">
            <div className="relative z-10">
              <span className="landing-eyebrow">Kontakt och nästa steg</span>
              <h2 className="mt-6 max-w-[11ch] text-[clamp(2.35rem,5vw,4.8rem)] font-bold leading-[0.96] tracking-[-0.05em] text-pure-white">
                Redo att bygga nästa nivå av rekrytering?
              </h2>
              <p className="mt-6 max-w-[36rem] text-[1rem] leading-8 text-pure-white sm:text-[1.05rem]">
                Gå med företag och kandidater som vill ha ett snabbare, snyggare och mer sammanhållet sätt att hitta rätt match i Sverige och Norden.
              </p>
            </div>

            <div className="relative z-10 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <article className="landing-panel rounded-[1.6rem] p-5 sm:p-6">
                  <p className="text-xs uppercase tracking-[0.18em] text-pure-white">För arbetsgivare</p>
                  <p className="mt-3 text-sm leading-7 text-pure-white">Skapa företagskonto och bygg ett rekryteringsflöde som rör sig snabbare från första signal till intervju.</p>
                </article>
                <article className="landing-panel rounded-[1.6rem] p-5 sm:p-6">
                  <p className="text-xs uppercase tracking-[0.18em] text-pure-white">För kandidater</p>
                  <p className="mt-3 text-sm leading-7 text-pure-white">Hitta jobb, visa upp dig med video och nå arbetsgivare utan att fastna i tröga ansökningsflöden.</p>
                </article>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button variant="glass" onClick={() => handleStart('employer')} className="landing-primary-button group px-7 text-base font-semibold">
                  <Sparkles className="h-4 w-4" />
                  Skapa företagskonto
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Button>
                <Button variant="glass" onClick={() => handleStart('job_seeker')} className="landing-secondary-button group px-7 text-base font-semibold">
                  Hitta jobb nu
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Button>
              </div>

              <p className="text-sm leading-7 text-pure-white">
                Gratis att komma igång under lanseringsfasen. Ingen friktion, inget brus — bara snabbare rekrytering.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingCTA;
