import { type PointerEvent, type RefObject, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowRight, BriefcaseBusiness, Search } from 'lucide-react';
import HeroGlobe from './HeroGlobe';


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

type AudienceRole = (typeof audienceOptions)[number]['role'];

const AudienceCard = ({
  label,
  role,
  icon: Icon,
  selectedRole,
  onChoose,
}: {
  label: string;
  role: AudienceRole;
  icon: typeof Search;
  selectedRole: AudienceRole | null;
  onChoose: (role: AudienceRole) => void;
}) => {
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const smoothX = useSpring(pointerX, { stiffness: 115, damping: 24, mass: 0.72 });
  const smoothY = useSpring(pointerY, { stiffness: 115, damping: 24, mass: 0.72 });
  const rotateX = useTransform(smoothY, [0, 1], [3.2, -3.2]);
  const rotateY = useTransform(smoothX, [0, 1], [-3.8, 3.8]);
  const innerX = useTransform(smoothX, [0, 1], [-3, 3]);
  const innerY = useTransform(smoothY, [0, 1], [-2, 2]);
  const isSelected = selectedRole === role;
  const isOtherSelected = selectedRole && selectedRole !== role;

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (selectedRole) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - bounds.left) / bounds.width);
    pointerY.set((event.clientY - bounds.top) / bounds.height);
  };

  const resetTilt = () => {
    pointerX.set(0.5);
    pointerY.set(0.5);
  };

  return (
    <motion.button
      type="button"
      onPointerDown={() => onChoose(role)}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
      variants={{
        hidden: { opacity: 0, y: 34, scale: 0.96, filter: 'blur(12px)' },
        show: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
      }}
      animate={isSelected ? { scale: 1.035, y: -3 } : isOtherSelected ? { opacity: 0.2, scale: 0.94 } : undefined}
      whileTap={!selectedRole ? { scale: 0.985 } : undefined}
      transition={{ duration: 0.68, ease }}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      className="group relative min-h-touch rounded-full bg-transparent p-0 text-left outline-none"
    >
      <span className="pointer-events-none absolute -inset-3 rounded-full bg-secondary/24 opacity-0 blur-2xl transition-opacity duration-500 ease-out group-hover:opacity-100 group-focus-visible:opacity-100" />
      <span className="pointer-events-none absolute -inset-px rounded-full bg-[linear-gradient(135deg,hsl(var(--secondary)/0.65),hsl(var(--secondary)/0.14)_44%,hsl(var(--primary)/0.34))] opacity-45 transition-opacity duration-500 ease-out group-hover:opacity-100 group-focus-visible:opacity-100" />
      <motion.span
        className="relative z-10 flex items-center gap-3.5 overflow-hidden rounded-full border border-white/12 bg-white/[0.045] px-5 py-3.5 shadow-[0_16px_48px_hsl(var(--background)/0.18)] backdrop-blur-xl transition-colors duration-500 ease-out group-hover:border-secondary/34 group-hover:bg-white/[0.06] group-focus-visible:border-secondary/45 sm:px-6 sm:py-4"
        style={{ x: innerX, y: innerY }}
      >
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-secondary/20 bg-secondary/[0.10] text-secondary transition-shadow duration-500 ease-out group-hover:shadow-[0_0_30px_hsl(var(--secondary)/0.28)] group-focus-visible:shadow-[0_0_30px_hsl(var(--secondary)/0.28)]">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="whitespace-nowrap text-base font-black leading-none text-white sm:text-lg">
          {label}
        </span>
        <ArrowRight className="ml-1 h-4 w-4 text-white/38 transition-transform group-hover:translate-x-0.5 group-hover:text-secondary" />
      </motion.span>
    </motion.button>
  );
};

const LandingHero = ({ scrollContainerRef: _scrollContainerRef }: LandingHeroProps) => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<AudienceRole | null>(null);

  const handleChoice = (role: AudienceRole) => {
    if (selectedRole) return;
    setSelectedRole(role);
    sessionStorage.setItem('parium-skip-splash', '1');
    window.setTimeout(() => {
      navigate(role === 'job_seeker' ? '/jobbsokare' : '/arbetsgivare');
    }, 860);
  };
  const exitX = selectedRole === 'job_seeker' ? '-105vw' : selectedRole === 'employer' ? '105vw' : 0;

  return (
    <section className="relative min-h-[100svh] overflow-hidden px-5 pb-10 pt-24 sm:px-6 sm:pb-14 sm:pt-28 md:px-12 lg:px-24" aria-labelledby="landing-hero-heading">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-x-0 top-24 mx-auto h-[30rem] max-w-5xl rounded-full bg-secondary/10 blur-3xl z-[1]" />

      {selectedRole && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--secondary)/0.28),hsl(var(--background)/0.98)_68%)]"
          initial={{ x: selectedRole === 'job_seeker' ? '100%' : '-100%', opacity: 0.88 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.86, ease }}
        />
      )}

      {/* Vertically stacked hero: heading → brain → CTAs */}
      <motion.div
        className="relative z-10 mx-auto flex min-h-[calc(100svh-9rem)] max-w-[1180px] flex-col items-center text-center"
        animate={selectedRole ? { x: exitX, opacity: 0.2, scale: 0.96 } : { x: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.86, ease }}
        style={{ perspective: 650 }}
      >
        {/* 1. Heading at the very top */}
        <motion.div className="mx-auto w-full">
          <h1
            id="landing-hero-heading"
            className="text-[1.95rem] font-black leading-[1.05] tracking-[-0.035em] text-white sm:text-[3rem] md:text-[3.8rem] lg:text-[4.8rem]"
          >
            {(() => {
              const lines = ['Från en tanke till verklighet,', 'vi gör det möjligt'];
              let globalIndex = 0;
              return lines.map((line, li) => (
                <span
                  key={li}
                  className="block overflow-hidden py-[0.1em]"
                  aria-label={line}
                >
                  {line.split(' ').map((word, wi, words) => (
                    <span key={wi} className="inline-block whitespace-nowrap">
                      {Array.from(word).map((char) => {
                        const i = globalIndex++;
                        return (
                          <motion.span
                            key={i}
                            aria-hidden
                            className="inline-block will-change-transform"
                            initial={{ y: '-110%', opacity: 0 }}
                            animate={{ y: '0%', opacity: 1 }}
                            transition={{
                              duration: 1.15,
                              ease: [0.85, 0.09, 0.15, 0.91],
                              delay: 0.6 + i * 0.035,
                            }}
                          >
                            {char}
                          </motion.span>
                        );
                      })}
                      {wi < words.length - 1 && (
                        <span className="inline-block">&nbsp;</span>
                      )}
                    </span>
                  ))}
                </span>
              ));
            })()}
          </h1>
        </motion.div>

        {/* 2. The 3D brain — flexes to fill remaining space between heading and CTAs */}
        <div className="relative my-2 w-full flex-1 sm:my-4">
          <HeroGlobe />
        </div>

        {/* 3. Audience CTAs at the bottom — clearly under the brain */}
        <motion.div
          className="mt-2 flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.22, delayChildren: 2.6 } },
          }}
        >
          {audienceOptions.map((option) => (
            <AudienceCard
              key={option.role}
              label={option.label}
              role={option.role}
              icon={option.icon}
              selectedRole={selectedRole}
              onChoose={handleChoice}
            />
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
};

export default LandingHero;
