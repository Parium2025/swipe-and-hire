import { type PointerEvent, type RefObject, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowRight, BriefcaseBusiness, Search } from 'lucide-react';
import HeroVideo from './HeroVideo';
import { syncBrowserChrome } from '@/lib/browserChrome';


type LandingHeroProps = {
  scrollContainerRef: RefObject<HTMLDivElement>;
};

const ease = [0.22, 1, 0.36, 1] as const;

const audienceOptions = [
  {
    role: 'job_seeker' as const,
    label: 'För jobbsökare',
    sublabel: 'Hitta jobb direkt',
    icon: Search,
  },
  {
    role: 'employer' as const,
    label: 'För arbetsgivare',
    sublabel: 'Hitta rätt kandidat nu',
    icon: BriefcaseBusiness,
  },
];

type AudienceRole = (typeof audienceOptions)[number]['role'];

const AudienceCard = ({
  label,
  sublabel,
  role,
  icon: Icon,
  selectedRole,
  onChoose,
}: {
  label: string;
  sublabel: string;
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
      className="group relative min-h-touch w-full max-w-[300px] rounded-full bg-transparent p-0 text-left outline-none sm:w-[300px]"
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
        <span className="flex-1 flex flex-col items-center gap-0.5 leading-none text-center">
          <span className="whitespace-nowrap text-base font-black leading-none text-white sm:text-lg">
            {label}
          </span>
          <span className="whitespace-nowrap text-[11px] font-medium leading-none text-white sm:text-xs">
            {sublabel}
          </span>
        </span>
        <ArrowRight className="ml-1 h-4 w-4 shrink-0 text-white transition-transform group-hover:translate-x-0.5" />
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
    syncBrowserChrome(role === 'job_seeker' ? '/jobbsokare' : '/arbetsgivare');
    sessionStorage.setItem('parium-skip-splash', '1');
    const target = role === 'job_seeker' ? '/jobbsokare' : '/arbetsgivare';
    window.setTimeout(() => {
      // Hard navigation (location.assign) istället för SPA-push.
      // Anledning: iOS Safaris bottenverktygsfält samplar body-färgen
      // vid first paint och uppdaterar INTE vid SPA-navigering, även
      // om body-färg/theme-color ändras dynamiskt. En riktig page load
      // tvingar Safari att räkna om både topp- och bottenfältet baserat
      // på nya sidans theme-color + body background. Detta är samma
      // mekanism som en hard refresh, vilket användaren bekräftar funkar.
      window.location.assign(target);
    }, 860);
  };
  const exitX = selectedRole === 'job_seeker' ? '-105vw' : selectedRole === 'employer' ? '105vw' : 0;

  return (
    <section
      className="relative min-h-[100svh] min-h-[100dvh] w-screen overflow-hidden"
      style={{
        marginLeft: 'calc(50% - 50vw)',
        marginRight: 'calc(50% - 50vw)',
        marginTop: 'calc(-1 * env(safe-area-inset-top, 0px))',
        marginBottom: 'calc(-1 * env(safe-area-inset-bottom, 0px))',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      aria-labelledby="landing-hero-heading"
    >
      {/* Background video — fills entire viewport including safe areas */}
      <HeroVideo />

      {/* iOS Safari bottom-toolbar färg styrs via body.landing-video-chrome
          regeln i index.css — den färgar body grå så Safari samplar grått. */}


      {/* Stacked hero: heading → CTAs */}
      <motion.div
        className="pointer-events-none relative z-10 mx-auto flex min-h-[100svh] max-w-[1180px] flex-col items-center justify-center px-5 pb-16 pt-24 text-center sm:px-6 sm:pt-28 md:px-12 lg:px-24"
        animate={selectedRole ? { x: exitX, opacity: 0.2, scale: 0.96 } : { x: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.86, ease }}
        style={{ perspective: 650 }}
      >
        <motion.h1
          id="landing-hero-heading"
          initial={{ opacity: 0, y: 32, filter: 'blur(14px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1.4, ease, delay: 0.4 }}
          className="max-w-4xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-white drop-shadow-[0_4px_24px_hsl(var(--background)/0.6)] sm:text-6xl md:text-7xl lg:text-[5.5rem]"
        >
          Välkommen till Parium
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease, delay: 0.9 }}
          className="mt-6 max-w-xl text-base text-white/80 sm:text-lg"
        >
          Rekrytering på 60 sekunder. Swipea, matcha och anställ.
        </motion.p>

        {/* CTAs */}

        <motion.div
          className="pointer-events-auto mt-10 flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.18, delayChildren: 1.2 } },
          }}
        >
          {audienceOptions.map((option) => (
            <AudienceCard
              key={option.role}
              label={option.label}
              sublabel={option.sublabel}
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
