import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LandingCTA = () => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const reveal = (delay = 0) => ({
    initial: { opacity: 0, y: reduceMotion ? 0 : 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: 0.68, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  const handleStart = (role?: 'job_seeker' | 'employer') => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register', role } });
  };

  return (
    <section id="kontakt" className="relative px-5 py-24 sm:px-6 sm:py-32 md:px-12 lg:px-24 lg:py-40" aria-label="Kom igång med Parium rekryteringsplattform">
      <div className="mx-auto max-w-7xl">
        <motion.div className="landing-cta-surface relative overflow-hidden rounded-[2.2rem] p-6 sm:p-8 lg:p-12" {...reveal()}>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-end">
            <div className="relative z-10">
              <span className="landing-eyebrow">Nästa steg</span>
              <h2 className="mt-6 max-w-[11ch] text-[clamp(2.35rem,5vw,4.8rem)] font-bold leading-[0.94] tracking-[-0.06em] text-pure-white">
                Redo att ge första intrycket samma nivå som produkten?
              </h2>
              <p className="mt-6 max-w-[36rem] text-[1rem] leading-8 text-pure-white sm:text-[1.05rem]">
                Parium är byggt för bolag och kandidater som vill ha mer fart, bättre känsla och mindre friktion i varje steg av rekryteringen.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <span className="landing-signal-pill">App-nativ känsla</span>
                <span className="landing-signal-pill">Byggd för Norden</span>
                <span className="landing-signal-pill">SEO som hjälper synlighet</span>
              </div>
            </div>

            <div className="relative z-10 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <article className="landing-role-panel rounded-[1.7rem] p-5 sm:p-6">
                  <p className="text-xs uppercase tracking-[0.18em] text-pure-white">För arbetsgivare</p>
                  <p className="mt-3 text-sm leading-7 text-pure-white">Publicera jobb, screena snabbare och boka intervjuer utan att växla mellan verktyg.</p>
                  <Button variant="glassBlue" onClick={() => handleStart('employer')} className="landing-primary-button mt-5 px-6 text-sm font-semibold">
                    <Sparkles className="h-4 w-4" />
                    Skapa företagskonto
                  </Button>
                </article>
                <article className="landing-role-panel rounded-[1.7rem] p-5 sm:p-6">
                  <p className="text-xs uppercase tracking-[0.18em] text-pure-white">För kandidater</p>
                  <p className="mt-3 text-sm leading-7 text-pure-white">Hitta jobb, visa mer än ett CV och kom till riktig kontakt mycket snabbare.</p>
                  <Button variant="glass" onClick={() => handleStart('job_seeker')} className="landing-secondary-button mt-5 px-6 text-sm font-semibold">
                    Hitta jobb nu
                  </Button>
                </article>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button variant="glassBlue" onClick={() => handleStart('employer')} className="landing-primary-button group px-7 text-base font-semibold">
                  Starta med Parium
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Button>
                <Button variant="glass" onClick={() => handleStart('job_seeker')} className="landing-secondary-button group px-7 text-base font-semibold">
                  Utforska jobbsidan
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Button>
              </div>

              <p className="text-sm leading-7 text-pure-white">
                Tidig åtkomst, tydlig onboarding och en upplevelse som redan från första scroll signalerar premium.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default LandingCTA;
