import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import LandingNav from '@/components/LandingNav';
import { AnimatedBackground } from '@/components/AnimatedBackground';

type AudienceLandingProps = {
  audience: 'job_seeker' | 'employer';
};

const content = {
  job_seeker: {
    eyebrow: 'För jobbsökare',
    title: 'Jobbflödet som börjar med dig.',
    body: 'Här bygger vi nästa steg: en modern upplevelse för profil, matchning och relevanta jobb.',
    cta: 'Skapa jobbsökarprofil',
  },
  employer: {
    eyebrow: 'För arbetsgivare',
    title: 'Rekrytering som känns snabbare från start.',
    body: 'Här bygger vi nästa steg: en premiumvy för roller, kandidater, matchning och urval.',
    cta: 'Skapa arbetsgivarkonto',
  },
};

const AudienceLanding = ({ audience }: AudienceLandingProps) => {
  const navigate = useNavigate();
  const page = content[audience];

  useEffect(() => {
    document.documentElement.classList.remove('landing-video-chrome');
    document.body.classList.remove('landing-video-chrome');
    document.documentElement.classList.add('parium-app-chrome');
    document.body.classList.add('parium-app-chrome');
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', '#001935');
    });
  }, []);

  const handleLogin = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth');
  };

  const handleStart = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register', role: audience } });
  };

  return (
    <div className="fixed inset-0 z-0 overflow-y-auto overflow-x-hidden bg-parium-navy text-primary-foreground">
      <AnimatedBackground />
      <div className="relative z-10 min-h-full">
        <LandingNav onLoginClick={handleLogin} />
        <main className="relative min-h-[100svh] overflow-hidden px-5 pb-16 pt-28 sm:px-6 md:px-12 lg:px-24">
          <motion.div
            className="mx-auto flex min-h-[calc(100svh-11rem)] max-w-[1180px] flex-col justify-center"
            initial={{ x: audience === 'job_seeker' ? '100vw' : '-100vw', opacity: 0, filter: 'blur(12px)' }}
            animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="text-xs font-bold uppercase tracking-[0.26em] text-secondary/75">{page.eyebrow}</span>
            <h1 className="mt-6 max-w-5xl text-[3.5rem] font-black leading-[0.92] tracking-[-0.03em] text-white sm:text-[5.5rem] lg:text-[7rem]">
              {page.title}
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-white/60 sm:text-lg">{page.body}</p>
            <button
              type="button"
              onPointerDown={handleStart}
              className="group mt-10 inline-flex min-h-touch w-fit items-center justify-center gap-3 rounded-full bg-secondary px-7 py-3.5 text-sm font-bold text-secondary-foreground shadow-[0_18px_55px_hsl(var(--secondary)/0.28)] transition-shadow hover:shadow-[0_22px_70px_hsl(var(--secondary)/0.36)]"
            >
              {page.cta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default AudienceLanding;