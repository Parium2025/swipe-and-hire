import { type RefObject, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, BriefcaseBusiness, Search } from 'lucide-react';

type LandingHeroProps = {
  scrollContainerRef: RefObject<HTMLDivElement>;
};

const ease = [0.22, 1, 0.36, 1] as const;

const audienceOptions = [
  {
    role: 'job_seeker' as const,
    label: 'För jobbsökare',
    icon: Search,
  },
  {
    role: 'employer' as const,
    label: 'För arbetsgivare',
    icon: BriefcaseBusiness,
  },
];

const LandingHero = ({ scrollContainerRef: _scrollContainerRef }: LandingHeroProps) => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<'job_seeker' | 'employer' | null>(null);

  const handleChoice = (role: 'job_seeker' | 'employer') => {
    if (selectedRole) return;
    setSelectedRole(role);
    sessionStorage.setItem('parium-skip-splash', '1');
    window.setTimeout(() => {
      navigate('/auth', { state: { mode: 'register', role } });
    }, 520);
  };

  return (
    <section className="relative min-h-[100svh] overflow-hidden px-5 pb-16 pt-28 sm:px-6 md:px-12 lg:px-24" aria-labelledby="landing-hero-heading">
      <div className="pointer-events-none absolute inset-x-0 top-24 mx-auto h-[30rem] max-w-5xl rounded-full bg-secondary/10 blur-3xl" />
      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-11rem)] max-w-[1180px] flex-col items-center justify-center text-center">
        <motion.div
          className="mx-auto overflow-hidden pb-2"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
        >
          <h1 id="landing-hero-heading" className="text-[4.7rem] font-black leading-[0.82] tracking-[-0.03em] text-white sm:text-[7.5rem] md:text-[10rem] lg:text-[12rem]">
            <motion.span
              className="block"
              initial={{ y: '-115%', opacity: 0, filter: 'blur(18px)' }}
              animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
              transition={{ duration: 1.05, ease, delay: 0.08 }}
            >
              Parium
            </motion.span>
          </h1>
        </motion.div>

        <motion.div
          className="mt-10 grid w-full max-w-3xl gap-4 sm:grid-cols-2 lg:mt-12"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.16, delayChildren: 0.95 } },
          }}
        >
          {audienceOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedRole === option.role;
            const isOtherSelected = selectedRole && selectedRole !== option.role;

            return (
              <motion.button
                key={option.role}
                type="button"
                onPointerDown={() => handleChoice(option.role)}
                variants={{
                  hidden: { opacity: 0, y: 34, scale: 0.96, filter: 'blur(12px)' },
                  show: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
                }}
                animate={isSelected ? { scale: 1.045, y: -6 } : isOtherSelected ? { opacity: 0.34, scale: 0.96 } : undefined}
                whileHover={!selectedRole ? { y: -6, scale: 1.015 } : undefined}
                whileTap={!selectedRole ? { scale: 0.985 } : undefined}
                transition={{ duration: 0.55, ease }}
                className="group relative min-h-[13rem] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-7 text-left shadow-[0_28px_90px_hsl(var(--background)/0.34)] backdrop-blur-2xl transition-colors hover:bg-white/[0.07] sm:p-8"
              >
                <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--secondary)/0.18),transparent_52%)] opacity-80 transition-opacity group-hover:opacity-100" />
                <span className="relative z-10 flex h-full flex-col justify-between gap-8">
                  <span className="flex items-center justify-between gap-4">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-secondary/20 bg-secondary/12 text-secondary shadow-[0_0_42px_hsl(var(--secondary)/0.22)]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <ArrowRight className="h-5 w-5 text-white/34 transition-transform group-hover:translate-x-1 group-hover:text-secondary" />
                  </span>
                  <span>
                    <span className="block text-3xl font-black leading-tight tracking-[-0.02em] text-white sm:text-4xl">{option.label}</span>
                  </span>
                </span>
              </motion.button>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};

export default LandingHero;
