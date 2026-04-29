import { type PointerEvent, type RefObject, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useTransform } from 'framer-motion';
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
  const rotateX = useTransform(pointerY, [0, 1], [13, -13]);
  const rotateY = useTransform(pointerX, [0, 1], [-13, 13]);
  const innerX = useTransform(pointerX, [0, 1], [-18, 18]);
  const innerY = useTransform(pointerY, [0, 1], [-18, 18]);
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
      animate={isSelected ? { scale: 1.055, y: -8 } : isOtherSelected ? { opacity: 0.22, scale: 0.92 } : undefined}
      whileTap={!selectedRole ? { scale: 0.985 } : undefined}
      transition={{ duration: 0.55, ease }}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      className="group relative min-h-[16rem] overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-7 text-left shadow-[0_32px_100px_hsl(var(--background)/0.38)] outline-none backdrop-blur-2xl transition-colors hover:bg-white/[0.065] focus-visible:ring-2 focus-visible:ring-secondary sm:min-h-[18rem] sm:p-8"
    >
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(89%_85%_at_17%_79%,hsl(var(--secondary)/0.42)_0%,hsl(var(--secondary)/0.24)_38%,hsl(var(--primary)/0.34)_72%,hsl(var(--background)/0.18)_100%)] opacity-80 transition-opacity group-hover:opacity-100" />
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:34px_34px] opacity-35" />
      <motion.span className="relative z-10 flex h-full flex-col justify-between gap-8" style={{ x: innerX, y: innerY }}>
        <span className="flex items-center justify-between gap-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-secondary/20 bg-secondary/[0.10] text-secondary shadow-[0_0_42px_hsl(var(--secondary)/0.24)]">
            <Icon className="h-5 w-5" />
          </span>
          <ArrowRight className="h-5 w-5 text-white/40 transition-transform group-hover:translate-x-1 group-hover:text-secondary" />
        </span>
        <span className="block text-4xl font-black leading-[0.95] tracking-[-0.02em] text-white sm:text-5xl">
          {label}
        </span>
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
    <section className="relative min-h-[100svh] overflow-hidden px-5 pb-16 pt-28 sm:px-6 md:px-12 lg:px-24" aria-labelledby="landing-hero-heading">
      <div className="pointer-events-none absolute inset-x-0 top-24 mx-auto h-[30rem] max-w-5xl rounded-full bg-secondary/10 blur-3xl" />
      {selectedRole && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--secondary)/0.28),hsl(var(--background)/0.98)_68%)]"
          initial={{ x: selectedRole === 'job_seeker' ? '100%' : '-100%', opacity: 0.88 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.86, ease }}
        />
      )}
      <motion.div
        className="relative z-10 mx-auto flex min-h-[calc(100svh-11rem)] max-w-[1180px] flex-col items-center justify-center text-center"
        animate={selectedRole ? { x: exitX, opacity: 0.2, scale: 0.96 } : { x: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.86, ease }}
        style={{ perspective: 650 }}
      >
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
            return (
              <AudienceCard
                key={option.role}
                label={option.label}
                role={option.role}
                icon={option.icon}
                selectedRole={selectedRole}
                onChoose={handleChoice}
              />
            );
          })}
        </motion.div>
      </motion.div>
    </section>
  );
};

export default LandingHero;
