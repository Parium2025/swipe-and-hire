import { type PointerEvent, type RefObject, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
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

type AudienceRole = (typeof audienceOptions)[number]['role'];

const PariumGlobe = ({ selectedRole }: { selectedRole: AudienceRole | null }) => {
  const orbitPaths = useMemo(
    () => [
      'M91 238c60-98 220-126 349-68 92 42 151 111 141 162-12 63-126 82-254 44C174 331 60 290 91 238Z',
      'M146 126c84-46 226-25 318 48 88 69 96 155 17 193-84 41-225 12-314-64-83-70-92-139-21-177Z',
      'M276 65c77 74 113 201 80 283-29 74-112 76-186 5-76-73-111-199-80-281 28-74 111-78 186-7Z',
      'M455 85c-38 94-142 218-233 278-81 54-126 31-101-51 28-91 132-216 232-278 86-53 131-30 102 51Z',
    ],
    []
  );

  const particles = useMemo(
    () => Array.from({ length: 34 }, (_, i) => ({
      x: 82 + ((i * 47) % 438),
      y: 68 + ((i * 83) % 354),
      r: 1.25 + (i % 4) * 0.42,
      opacity: 0.28 + (i % 5) * 0.08,
    })),
    []
  );

  return (
    <motion.div
      className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0, scale: 0.72, filter: 'blur(18px)' }}
      animate={
        selectedRole
          ? { opacity: 1, scale: 2.28, filter: 'blur(0px)' }
          : { opacity: 1, scale: 1, filter: 'blur(0px)' }
      }
      transition={{ duration: selectedRole ? 1.08 : 2.05, ease: [0.16, 1, 0.3, 1] }}
      aria-hidden="true"
    >
      <motion.div
        className="relative h-[68vh] w-[68vh] max-h-[710px] max-w-[710px] sm:h-[74vh] sm:w-[74vh] lg:h-[80vh] lg:w-[80vh] lg:max-h-[850px] lg:max-w-[850px]"
        animate={selectedRole ? { y: 0 } : { y: [0, -10, 0] }}
        transition={selectedRole ? { duration: 0.9, ease } : { duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="absolute inset-[5%] rounded-full bg-secondary/10 blur-3xl" />
        <div className="absolute inset-[13%] rounded-full bg-primary/12 blur-2xl" />
        <svg className="relative h-full w-full" viewBox="0 0 640 640" role="img" aria-label="Parium globe">
          <defs>
            <radialGradient id="parium-globe-core" cx="50%" cy="45%" r="54%">
              <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity="0.34" />
              <stop offset="42%" stopColor="hsl(var(--primary))" stopOpacity="0.14" />
              <stop offset="76%" stopColor="hsl(var(--background))" stopOpacity="0.18" />
              <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="parium-globe-line" x1="82" y1="83" x2="560" y2="514" gradientUnits="userSpaceOnUse">
              <stop stopColor="hsl(var(--secondary))" stopOpacity="0.12" />
              <stop offset="0.48" stopColor="hsl(var(--secondary))" stopOpacity="0.72" />
              <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0.18" />
            </linearGradient>
            <filter id="parium-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <motion.g
            animate={selectedRole ? { rotate: 14 } : { rotate: [0, 360] }}
            transition={selectedRole ? { duration: 1.08, ease } : { duration: 58, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: '320px 320px' }}
          >
            <circle cx="320" cy="320" r="244" fill="url(#parium-globe-core)" />
            <circle cx="320" cy="320" r="244" fill="none" stroke="hsl(var(--secondary))" strokeOpacity="0.18" strokeWidth="1.2" />
            {orbitPaths.map((path, index) => (
              <motion.path
                key={path}
                d={path}
                fill="none"
                stroke="url(#parium-globe-line)"
                strokeWidth={index === 0 ? 1.7 : 1.15}
                strokeDasharray={index % 2 ? '7 13' : '2 10'}
                strokeLinecap="round"
                filter="url(#parium-glow)"
                animate={{ strokeDashoffset: index % 2 ? [0, -120] : [0, 96] }}
                transition={{ duration: 16 + index * 4, repeat: Infinity, ease: 'linear' }}
              />
            ))}
            {particles.map((particle, index) => (
              <motion.circle
                key={`${particle.x}-${particle.y}`}
                cx={particle.x}
                cy={particle.y}
                r={particle.r}
                fill="hsl(var(--secondary))"
                opacity={particle.opacity}
                animate={{ opacity: [particle.opacity * 0.45, particle.opacity, particle.opacity * 0.55] }}
                transition={{ duration: 2.8 + (index % 6) * 0.42, repeat: Infinity, ease: 'easeInOut' }}
              />
            ))}
          </motion.g>
          <motion.path
            d="M504 169c21 17 37 34 50 54"
            fill="none"
            stroke="hsl(var(--accent))"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray="4 10"
            animate={{ pathLength: [0.25, 1, 0.25], opacity: [0.35, 0.95, 0.35] }}
            transition={{ duration: 5.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </svg>
      </motion.div>
    </motion.div>
  );
};

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
      navigate(role === 'job_seeker' ? '/jobbsokare' : '/arbetsgivare', {
        state: { entry: 'globe-zoom', audience: role },
      });
    }, 1060);
  };
  const exitX = selectedRole === 'job_seeker' ? '-105vw' : selectedRole === 'employer' ? '105vw' : 0;

  return (
    <section className="relative min-h-[100svh] overflow-hidden px-5 pb-16 pt-28 sm:px-6 md:px-12 lg:px-24" aria-labelledby="landing-hero-heading">
      <PariumGlobe selectedRole={selectedRole} />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-x-0 top-24 mx-auto h-[30rem] max-w-5xl rounded-full bg-secondary/10 blur-3xl z-[1]" />

      {selectedRole && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--secondary)/0.22),hsl(var(--background)/0.12)_34%,hsl(var(--background)/0.98)_78%)]"
          initial={{ x: selectedRole === 'job_seeker' ? '100%' : '-100%', opacity: 0.88 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 1.06, ease }}
        />
      )}

      <motion.div
        className="relative z-10 mx-auto flex min-h-[calc(100svh-11rem)] max-w-[1180px] flex-col items-center justify-center text-center"
        animate={selectedRole ? { x: exitX, opacity: 0, scale: 0.74, filter: 'blur(16px)' } : { x: 0, opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 1.06, ease }}
        style={{ perspective: 650 }}
      >
        {/* Main heading — word-by-word stagger */}
        <motion.div className="mx-auto pb-4">
          <h1
            id="landing-hero-heading"
            className="text-[2.6rem] font-black leading-[1.1] tracking-[-0.03em] text-white sm:text-[4rem] md:text-[5.2rem] lg:text-[6.4rem]"
          >
            {'Vi gör drömmar\ntill verklighet'.split('\n').map((line, li) => (
              <span key={li} className="block overflow-hidden py-[0.08em]">
                {line.split(' ').map((word, wi) => (
                  <motion.span
                    key={wi}
                    className="inline-block mr-[0.28em] last:mr-0"
                    initial={{ y: '120%', opacity: 0, filter: 'blur(10px)' }}
                    animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
                    transition={{
                      duration: 1.1,
                      ease: [0.22, 1, 0.36, 1],
                      delay: 0.5 + (li * 3 + wi) * 0.14,
                    }}
                  >
                    {word}
                  </motion.span>
                ))}
              </span>
            ))}
          </h1>
        </motion.div>

        {/* Audience buttons */}
        <motion.div
          className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4 lg:mt-10"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.18, delayChildren: 1.6 } },
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
