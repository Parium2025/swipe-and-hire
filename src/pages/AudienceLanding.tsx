import { useLocation, useNavigate } from 'react-router-dom';
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

const EntryZoomOverlay = ({ show }: { show: boolean }) => {
  if (!show) return null;

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center overflow-hidden bg-background"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1], delay: 0.18 }}
    >
      <motion.div
        className="relative h-[84vh] w-[84vh] rounded-full"
        initial={{ scale: 1.35, opacity: 1, filter: 'blur(0px)' }}
        animate={{ scale: 3.1, opacity: 0.08, filter: 'blur(22px)' }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="absolute inset-0 rounded-full bg-secondary/18 blur-3xl" />
        <svg className="relative h-full w-full" viewBox="0 0 640 640" aria-hidden="true">
          <circle cx="320" cy="320" r="238" fill="none" stroke="hsl(var(--secondary))" strokeOpacity="0.32" strokeWidth="1.4" />
          <path d="M91 238c60-98 220-126 349-68 92 42 151 111 141 162-12 63-126 82-254 44C174 331 60 290 91 238Z" fill="none" stroke="hsl(var(--secondary))" strokeOpacity="0.72" strokeWidth="1.8" strokeDasharray="2 10" strokeLinecap="round" />
          <path d="M276 65c77 74 113 201 80 283-29 74-112 76-186 5-76-73-111-199-80-281 28-74 111-78 186-7Z" fill="none" stroke="hsl(var(--primary))" strokeOpacity="0.32" strokeWidth="1.1" strokeDasharray="7 13" strokeLinecap="round" />
          <circle cx="320" cy="320" r="172" fill="hsl(var(--secondary))" opacity="0.08" />
        </svg>
      </motion.div>
    </motion.div>
  );
};

const AudienceLanding = ({ audience }: AudienceLandingProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const page = content[audience];
  const entryFromGlobe = (location.state as { entry?: string } | null)?.entry === 'globe-zoom';

  const handleLogin = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth');
  };

  const handleStart = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register', role: audience } });
  };

  return (
    <div className="fixed inset-0 z-0 overflow-y-auto overflow-x-hidden bg-gradient-parium text-primary-foreground">
      <AnimatedBackground showBubbles={false} />
      <EntryZoomOverlay show={entryFromGlobe} />
      <div className="relative z-10 min-h-full">
        <LandingNav onLoginClick={handleLogin} />
        <main className="relative min-h-[100svh] overflow-hidden px-5 pb-16 pt-28 sm:px-6 md:px-12 lg:px-24">
          <motion.div
            className="mx-auto flex min-h-[calc(100svh-11rem)] max-w-[1180px] flex-col justify-center"
            initial={entryFromGlobe ? { y: 34, scale: 0.94, opacity: 0, filter: 'blur(18px)' } : { x: audience === 'job_seeker' ? '100vw' : '-100vw', opacity: 0, filter: 'blur(12px)' }}
            animate={{ x: 0, y: 0, scale: 1, opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 1.08, delay: entryFromGlobe ? 0.34 : 0, ease: [0.16, 1, 0.3, 1] }}
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