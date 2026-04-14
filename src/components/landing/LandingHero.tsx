import { useEffect, useRef, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { AnimatedBackground } from '@/components/AnimatedBackground';
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
    alt: 'Abstrakt ljusflöde genom glasspaneler i djupblått',
  },
  {
    id: 'match',
    label: '02 — Matcha',
    headline: 'Rätt person. Rätt tajming.',
    sub: 'Två krafter möts — kandidat och arbetsgivare i en exakt träff.',
    image: storyMatch,
    alt: 'Energiexplosion av cyan ljus och kristallskärvor',
  },
  {
    id: 'chat',
    label: '03 — Kontakt',
    headline: 'Dialog utan fördröjning.',
    sub: 'Samtalet startar sömlöst, medan intresset fortfarande brinner.',
    image: storyChat,
    alt: 'Sammanflätade ljustrådar som bildar en helixstruktur',
  },
  {
    id: 'hire',
    label: '04 — Anställ',
    headline: 'Från match till anställning.',
    sub: 'Hela resan, i en plattform. Resultat du kan mäta.',
    image: storyHire,
    alt: 'Lysande kristallring som symboliserar konvertering',
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
      <div className="sticky top-0 h-[100dvh] overflow-hidden bg-gradient-parium">
        <AnimatedBackground />

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col">
          {/* Main area */}
          <div className="flex flex-1 flex-col lg:flex-row">
            {/* Visual – full bleed on mobile, right side on desktop */}
            <div className="relative flex-1 lg:order-2">
              <AnimatePresence mode="wait">
                <motion.img
                  key={current.id}
                  src={current.image}
                  alt={current.alt}
                  loading="eager"
                  className="absolute inset-0 h-full w-full object-cover"
                  initial={{ opacity: 0, scale: 1.08 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                />
              </AnimatePresence>

              {/* Gradient overlays for text readability */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[hsl(var(--background))] via-[hsl(var(--background)/0.4)] to-transparent lg:bg-gradient-to-r lg:from-[hsl(var(--background))] lg:via-[hsl(var(--background)/0.5)] lg:to-transparent" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[hsl(var(--background)/0.6)] via-transparent to-transparent lg:from-transparent" />
            </div>

            {/* Copy – overlaid on mobile, left side on desktop */}
            <div className="relative z-20 flex flex-col justify-end px-6 pb-6 lg:order-1 lg:w-[48%] lg:justify-center lg:px-12 lg:pb-0 lg:pt-28">
              <motion.span
                className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-foreground/10 bg-background/40 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-secondary/80 backdrop-blur-xl"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease }}
              >
                Parium
              </motion.span>

              <motion.h1
                className="max-w-[10ch] text-[clamp(3rem,9vw,7rem)] font-black uppercase leading-[0.88] tracking-[-0.04em] text-foreground"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.05, ease }}
              >
                Rekrytering. I rörelse.
              </motion.h1>

              {/* Animated step content */}
              <div className="relative mt-6 min-h-[7.5rem]">
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
                    <h2 className="mt-2 text-[clamp(1.4rem,3.5vw,2.4rem)] font-semibold leading-tight tracking-[-0.02em] text-foreground">
                      {current.headline}
                    </h2>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-foreground/60 sm:text-base">
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
          </div>

          {/* Step indicators */}
          <div className="relative z-20 flex items-center gap-3 px-6 pb-5 lg:px-12 lg:pb-8">
            {steps.map((step, i) => (
              <div
                key={step.id}
                className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
                  i <= activeStep
                    ? 'bg-secondary'
                    : 'bg-foreground/12'
                }`}
              />
            ))}
            <span className="ml-2 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-foreground/40">
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
