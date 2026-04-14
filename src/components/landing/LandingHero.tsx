import { useEffect, useRef, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import storyDiscover from '@/assets/landing-story-discover.jpg';
import storyMatch from '@/assets/landing-story-match.jpg';
import storyChat from '@/assets/landing-story-chat.jpg';
import storyHire from '@/assets/landing-story-hire.jpg';

const ease = [0.22, 1, 0.36, 1] as const;

type StoryStep = {
  id: string;
  label: string;
  headline: string;
  sub: string;
  image: string;
  alt: string;
};

const steps: StoryStep[] = [
  {
    id: 'discover',
    label: '01 — Upptäck',
    headline: 'Se rätt match direkt.',
    sub: 'Parium gör första intrycket visuellt, snabbt och premium.',
    image: storyDiscover,
    alt: 'Professionell kvinna i stadsmiljö med cyan belysning',
  },
  {
    id: 'match',
    label: '02 — Matcha',
    headline: 'Rätt person. Rätt tajming.',
    sub: 'Två krafter möts — kandidat och arbetsgivare i en exakt träff.',
    image: storyMatch,
    alt: 'Två professionella skakar hand framför stadspanorama',
  },
  {
    id: 'chat',
    label: '03 — Kontakt',
    headline: 'Dialog utan fördröjning.',
    sub: 'Samtalet startar sömlöst, medan intresset fortfarande brinner.',
    image: storyChat,
    alt: 'Person chattar på smartphone i mörkt kontorsmiljö',
  },
  {
    id: 'hire',
    label: '04 — Anställ',
    headline: 'Från match till anställning.',
    sub: 'Hela resan, i en plattform. Resultat du kan mäta.',
    image: storyHire,
    alt: 'Team firar ny anställning med konfetti',
  },
];

type LandingHeroProps = {
  scrollContainerRef: RefObject<HTMLDivElement>;
};

const LandingHero = ({ scrollContainerRef }: LandingHeroProps) => {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const [activeStep, setActiveStep] = useState(0);

  const { scrollYProgress } = useScroll({
    container: scrollContainerRef,
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  const progressScale = useTransform(scrollYProgress, [0, 1], [0.08, 1]);

  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', (v) => {
      const clamped = Math.max(0, Math.min(v, 0.9999));
      setActiveStep(Math.floor(clamped * steps.length));
    });
    return unsubscribe;
  }, [scrollYProgress]);

  // Preload images
  useEffect(() => {
    steps.forEach(({ image }) => {
      const img = new Image();
      img.src = image;
    });
  }, []);

  const current = steps[activeStep];

  const handleStart = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register' } });
  };

  return (
    <section ref={sectionRef} className="relative" style={{ height: '400vh' }}>
      {/* Sticky full-viewport container – NO animated background here, pure imagery */}
      <div className="sticky top-0 h-[100dvh] overflow-hidden">
        {/* Full-bleed background image */}
        <AnimatePresence mode="wait">
          <motion.img
            key={current.id}
            src={current.image}
            alt={current.alt}
            loading="eager"
            className="absolute inset-0 h-full w-full object-cover"
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </AnimatePresence>

        {/* Gradient overlays for text readability */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/50" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/40 to-transparent lg:from-black/60" />

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col justify-between">
          {/* Text content – bottom aligned on mobile, center-left on desktop */}
          <div className="flex flex-1 flex-col justify-end px-6 pb-24 lg:justify-center lg:px-16 lg:pb-0 lg:max-w-[55%]">
            <motion.span
              className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-white/70 backdrop-blur-xl"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease }}
            >
              Parium
            </motion.span>

            <motion.h1
              className="max-w-[10ch] text-[clamp(3rem,9vw,7rem)] font-black uppercase leading-[0.88] tracking-[-0.04em] text-white"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.05, ease }}
            >
              Rekrytering. I rörelse.
            </motion.h1>

            {/* Animated step content */}
            <div className="relative mt-6 min-h-[7rem]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.45, ease }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                    {current.label}
                  </p>
                  <h2 className="mt-2 text-[clamp(1.4rem,3.5vw,2.4rem)] font-semibold leading-tight tracking-[-0.02em] text-white">
                    {current.headline}
                  </h2>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-white/60 sm:text-base">
                    {current.sub}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            <motion.div
              className="mt-6 flex items-center gap-4"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease }}
            >
              <motion.button
                type="button"
                onPointerDown={handleStart}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="group inline-flex min-h-touch items-center gap-3 rounded-full bg-secondary px-7 py-3.5 text-sm font-bold text-secondary-foreground shadow-[0_16px_48px_hsl(var(--secondary)/0.35)] transition-shadow hover:shadow-[0_20px_60px_hsl(var(--secondary)/0.45)]"
              >
                Kom igång gratis
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </motion.button>
            </motion.div>
          </div>

          {/* Step indicators */}
          <div className="relative z-20 flex items-center gap-3 px-6 pb-5 lg:px-16 lg:pb-8">
            {steps.map((step, i) => (
              <div
                key={step.id}
                className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
                  i <= activeStep ? 'bg-secondary' : 'bg-white/15'
                }`}
              />
            ))}
            <span className="ml-2 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-white/40">
              {activeStep + 1}/{steps.length}
            </span>
          </div>
        </div>

        {/* Progress line */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 z-30 h-px origin-left bg-gradient-to-r from-secondary/0 via-secondary/60 to-secondary/0"
          style={{ scaleX: progressScale }}
        />
      </div>
    </section>
  );
};

export default LandingHero;
