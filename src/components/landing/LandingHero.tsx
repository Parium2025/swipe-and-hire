import { useEffect, useRef, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, BarChart3, MessageSquareText, Sparkles, Zap } from 'lucide-react';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import storyDiscover from '@/assets/landing-story-discover.png';
import storyMatch from '@/assets/landing-story-match.png';
import storyChat from '@/assets/landing-story-chat.png';
import storyHire from '@/assets/landing-story-hire.png';

const ease = [0.22, 1, 0.36, 1] as const;

type StoryStep = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  metric: string;
  caption: string;
  alt: string;
  image: string;
  icon: LucideIcon;
  pills: string[];
};

const storySteps: StoryStep[] = [
  {
    id: 'discover',
    eyebrow: '01 · Upptäck',
    title: 'Se rätt match direkt i ett levande flöde.',
    description:
      'Parium gör första intrycket visuellt, snabbt och premium — så att kandidater och arbetsgivare känner kvalitet redan från första svepet.',
    metric: 'Visuell screening som känns mer app än jobbsajt.',
    caption: 'Första kontakten ska kännas exklusiv, inte generisk.',
    alt: 'Premiumvisual som visar en snabb rekryteringsresa genom flytande kort i Pariums blå färger.',
    image: storyDiscover,
    icon: Sparkles,
    pills: ['Snabbt flöde', 'Premium UI', 'Hög konvertering'],
  },
  {
    id: 'match',
    eyebrow: '02 · Matcha',
    title: 'När tajmingen sitter ska matchen smälla till.',
    description:
      'Scrollen driver berättelsen framåt och visar exakt när rätt kandidat och rätt arbetsgivare möts — med mer energi, mer tryck och mer identitet.',
    metric: 'Ett tydligt wow-moment innan användaren släpps vidare.',
    caption: 'Varje övergång ska kännas som en release, inte som ett vanligt slidebyte.',
    alt: 'Högupplöst premiumvisual av två glaspaneler som möts i en stark cyan explosion.',
    image: storyMatch,
    icon: Zap,
    pills: ['Direkt match', 'Stark energi', 'Storydriven scroll'],
  },
  {
    id: 'chat',
    eyebrow: '03 · Starta dialog',
    title: 'Få igång samtalet innan känslan hinner svalna.',
    description:
      'Efter matchen fortsätter resan i samma tempo — kontakt, dialog och nästa steg presenteras som en sömlös premiumupplevelse.',
    metric: 'Från intresse till dialog utan visuella avbrott.',
    caption: 'Kommunikationen ska kännas nära, snabb och självklar.',
    alt: 'Premiumvisual som visar två personer sammankopplade av flytande meddelandepaneler i djupblå miljö.',
    image: storyChat,
    icon: MessageSquareText,
    pills: ['Sömlös dialog', 'Tydlig resa', 'Mer engagemang'],
  },
  {
    id: 'convert',
    eyebrow: '04 · Konvertera',
    title: 'Och sen mäter du det som faktiskt leder till anställning.',
    description:
      'När storyn är klar släpper hero-sektionen vidare till resten av sidan — där du kan visa resultat, siffror och varför Parium konverterar bättre.',
    metric: 'Pinned storytelling först. Resten av landningssidan efteråt.',
    caption: 'Premium betyder att design, känsla och affär går ihop.',
    alt: 'Högupplöst premiumvisual av glaspaneler och lysande ringar som symboliserar konvertering och resultat.',
    image: storyHire,
    icon: BarChart3,
    pills: ['Konvertering', 'Resultat', 'Premium finish'],
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

  const visualY = useTransform(scrollYProgress, [0, 1], [22, -30]);
  const visualScale = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0.94, 1, 1.02, 0.98]);
  const visualRotateX = useTransform(scrollYProgress, [0, 0.5, 1], [8, 0, -6]);
  const visualRotateY = useTransform(scrollYProgress, [0, 0.5, 1], [-5, 0, 5]);
  const glowLeftY = useTransform(scrollYProgress, [0, 1], [-20, 30]);
  const glowRightY = useTransform(scrollYProgress, [0, 1], [30, -20]);
  const progressScale = useTransform(scrollYProgress, [0, 1], [0.12, 1]);

  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', (value) => {
      const clampedValue = Math.max(0, Math.min(value, 0.9999));
      const nextStep = Math.floor(clampedValue * storySteps.length);
      setActiveStep(nextStep);
    });

    return unsubscribe;
  }, [scrollYProgress]);

  useEffect(() => {
    storySteps.forEach(({ image }) => {
      const img = new Image();
      img.src = image;
    });
  }, []);

  const currentStep = storySteps[activeStep];
  const CurrentIcon = currentStep.icon;

  const handleStart = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register' } });
  };

  return (
    <section ref={sectionRef} className="dark relative" style={{ height: '420vh' }}>
      <div className="sticky top-0 h-[100dvh] overflow-hidden bg-gradient-parium">
        <AnimatedBackground />

        <motion.div
          className="pointer-events-none absolute -left-16 top-28 h-44 w-44 rounded-full bg-secondary/20 blur-3xl"
          style={{ y: glowLeftY }}
        />
        <motion.div
          className="pointer-events-none absolute -right-12 bottom-24 h-56 w-56 rounded-full bg-primary-glow/20 blur-3xl"
          style={{ y: glowRightY }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--secondary)/0.12),transparent_34%),linear-gradient(180deg,hsl(var(--background)/0)_0%,hsl(var(--background)/0.18)_100%)]" />

        <div className="relative z-10 mx-auto flex h-full w-full max-w-[1440px] flex-col px-5 pb-8 pt-24 sm:px-8 sm:pb-10 sm:pt-28 lg:px-12 lg:pb-12 lg:pt-32">
          <div className="grid flex-1 items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
            <div className="order-2 flex flex-col justify-center lg:order-1">
              <motion.span
                className="inline-flex w-fit items-center gap-3 rounded-full border border-foreground/10 bg-background/35 px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-secondary/80 backdrop-blur-xl"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease }}
              >
                Parium scroll story
              </motion.span>

              <motion.h1
                className="mt-5 max-w-[11ch] text-[clamp(2.8rem,8vw,6.8rem)] font-black uppercase leading-[0.9] tracking-[-0.05em] text-foreground"
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.1, ease }}
              >
                Framtidens rekrytering. I rörelse.
              </motion.h1>

              <div className="relative mt-6 min-h-[20rem] sm:min-h-[17rem] lg:min-h-[18rem]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep.id}
                    className="absolute inset-0"
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -24 }}
                    transition={{ duration: 0.55, ease }}
                  >
                    <div className="inline-flex items-center gap-2 rounded-full border border-secondary/20 bg-secondary/10 px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-secondary">
                      <CurrentIcon className="h-3.5 w-3.5" />
                      {currentStep.eyebrow}
                    </div>

                    <h2 className="mt-4 max-w-[12ch] text-[clamp(1.65rem,4.7vw,3.2rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-foreground">
                      {currentStep.title}
                    </h2>

                    <p className="mt-4 max-w-xl text-base leading-relaxed text-foreground/68 sm:text-lg">
                      {currentStep.description}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2.5">
                      {currentStep.pills.map((pill) => (
                        <span
                          key={pill}
                          className="rounded-full border border-foreground/10 bg-background/30 px-3 py-1.5 text-sm font-medium text-foreground/65 backdrop-blur-xl"
                        >
                          {pill}
                        </span>
                      ))}
                    </div>

                    <p className="mt-5 max-w-md text-sm font-medium text-secondary/85 sm:text-base">
                      {currentStep.metric}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              <motion.div
                className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease }}
              >
                <motion.button
                  type="button"
                  onPointerDown={handleStart}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="group inline-flex min-h-touch items-center gap-3 rounded-full bg-secondary px-6 py-3 text-sm font-bold text-secondary-foreground shadow-[0_18px_60px_hsl(var(--secondary)/0.32)] transition-transform"
                >
                  Kom igång gratis
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </motion.button>
                <span className="text-sm text-foreground/45">
                  Scrolla igenom storyn — sen tar resten av sidan över.
                </span>
              </motion.div>
            </div>

            <div className="order-1 flex items-center justify-center lg:order-2 lg:justify-end">
              <motion.div
                className="relative w-full max-w-[23rem] sm:max-w-[29rem] lg:max-w-[38rem]"
                style={{
                  y: visualY,
                  scale: visualScale,
                  rotateX: visualRotateX,
                  rotateY: visualRotateY,
                  transformPerspective: 1600,
                  transformStyle: 'preserve-3d',
                }}
                initial={{ opacity: 0, y: 38 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.15, ease }}
              >
                <div className="pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-secondary/12 blur-3xl" />

                <div className="relative overflow-hidden rounded-[2rem] border border-foreground/10 bg-background/30 shadow-[0_30px_120px_hsl(var(--primary)/0.55)] backdrop-blur-sm">
                  <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-br from-secondary/18 via-transparent to-transparent" />

                  <AnimatePresence mode="popLayout">
                    <motion.img
                      key={currentStep.image}
                      src={currentStep.image}
                      alt={currentStep.alt}
                      loading="eager"
                      className="relative z-0 aspect-[4/5] w-full object-cover"
                      initial={{ opacity: 0, scale: 1.15, y: 40, filter: 'blur(12px)' }}
                      animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, scale: 0.92, y: -30, filter: 'blur(10px)' }}
                      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </AnimatePresence>

                  <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-background via-background/12 to-background/0" />

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${currentStep.id}-caption`}
                      className="absolute inset-x-0 bottom-0 z-20 p-4 sm:p-6"
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 16 }}
                      transition={{ duration: 0.5, ease }}
                    >
                      <div className="rounded-[1.5rem] border border-foreground/10 bg-background/60 p-4 backdrop-blur-xl sm:p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-secondary/78">
                              {currentStep.eyebrow}
                            </p>
                            <p className="mt-2 text-lg font-semibold leading-tight text-foreground sm:text-xl">
                              {currentStep.caption}
                            </p>
                          </div>
                          <div className="rounded-full border border-secondary/20 bg-secondary/12 p-3 text-secondary">
                            <CurrentIcon className="h-5 w-5" />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            </div>
          </div>

          <div className="relative z-20 mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:max-w-3xl">
              {storySteps.map((step, index) => {
                const Icon = step.icon;
                const isActive = index === activeStep;

                return (
                  <div
                    key={step.id}
                    className={`rounded-[1.25rem] border px-3 py-3 backdrop-blur-xl transition-all duration-500 sm:px-4 ${
                      isActive
                        ? 'border-secondary/30 bg-secondary/12 text-foreground'
                        : 'border-foreground/10 bg-background/24 text-foreground/42'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Icon className={`h-4 w-4 ${isActive ? 'text-secondary' : 'text-foreground/35'}`} />
                      <span>{step.eyebrow}</span>
                    </div>
                    <p className={`mt-2 text-sm leading-snug ${isActive ? 'text-foreground/78' : 'text-foreground/38'}`}>
                      {step.title}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3 text-foreground/45">
              <div className="h-px w-12 bg-gradient-to-r from-secondary/60 to-transparent" />
              <span className="text-[0.72rem] font-medium uppercase tracking-[0.22em]">
                {activeStep === storySteps.length - 1
                  ? 'Fortsätt scrolla för resten av sidan'
                  : 'Scrolla för nästa kapitel'}
              </span>
            </div>
          </div>
        </div>

        <motion.div
          className="absolute bottom-0 left-0 right-0 z-20 h-px origin-left bg-gradient-to-r from-secondary/0 via-secondary/60 to-secondary/0"
          style={{ scaleX: progressScale }}
        />
      </div>
    </section>
  );
};

export default LandingHero;
