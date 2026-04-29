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
    title: 'Hitta jobb som faktiskt passar dig.',
    description: 'Utforska roller, bygg en stark profil och gå vidare när matchningen känns rätt.',
    icon: Search,
  },
  {
    role: 'employer' as const,
    label: 'För arbetsgivare',
    title: 'Hitta rätt kandidat snabbare.',
    description: 'Skapa bättre urval, se tydligare matchningar och kom snabbare till samtal.',
    icon: BriefcaseBusiness,
  },
];

const headingWords = ['Välj', 'din', 'väg', 'in', 'i', 'Parium.'];

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
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease }}
          className="mx-auto max-w-5xl"
        >
          <span className="inline-flex items-center justify-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary/70">
            <span className="h-px w-10 bg-gradient-to-r from-secondary to-transparent" />
            Parium för två världar
            <span className="h-px w-10 bg-gradient-to-l from-secondary to-transparent" />
          </span>
          <h1 id="landing-hero-heading" className="mt-6 text-[3.05rem] font-black leading-[0.92] tracking-[-0.03em] text-white sm:text-[4.6rem] md:text-[6.1rem] lg:text-[7rem]">
            {headingWords.map((word, index) => (
              <motion.span
                key={`${word}-${index}`}
                className="mr-[0.18em] inline-block"
                initial={{ opacity: 0, y: 42, filter: 'blur(14px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.72, ease, delay: 0.12 + index * 0.075 }}
              >
                {word}
              </motion.span>
            ))}
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-base leading-8 text-white/60 sm:text-lg">
            Börja där du är. Parium samlar jobbsökare och arbetsgivare i två separata premiumflöden — byggda för matchning, tempo och tydligare nästa steg.
          </p>
        </motion.div>

        <motion.div
          className="mt-12 grid w-full max-w-4xl gap-4 sm:grid-cols-2 lg:mt-14"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.14, delayChildren: 0.72 } },
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
                className="group relative min-h-[18rem] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-7 text-left shadow-[0_28px_90px_hsl(var(--background)/0.34)] backdrop-blur-2xl transition-colors hover:bg-white/[0.07] sm:p-8"
              >
                <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--secondary)/0.18),transparent_52%)] opacity-80 transition-opacity group-hover:opacity-100" />
                <span className="relative z-10 flex h-full flex-col justify-between gap-9">
                  <span className="flex items-center justify-between gap-4">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-secondary/20 bg-secondary/12 text-secondary shadow-[0_0_42px_hsl(var(--secondary)/0.22)]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <ArrowRight className="h-5 w-5 text-white/34 transition-transform group-hover:translate-x-1 group-hover:text-secondary" />
                  </span>
                  <span>
                    <span className="text-xs font-bold uppercase tracking-[0.22em] text-secondary/75">{option.label}</span>
                    <span className="mt-4 block text-3xl font-black leading-tight tracking-[-0.02em] text-white sm:text-4xl">{option.title}</span>
                    <span className="mt-4 block text-sm leading-7 text-white/56">{option.description}</span>
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
