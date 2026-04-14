import { useEffect, useRef, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import storyDiscover from '@/assets/landing-story-discover.jpg';
import storyMatch from '@/assets/landing-story-match.jpg';
import storyChat from '@/assets/landing-story-chat.jpg';
import storyHire from '@/assets/landing-story-hire.jpg';

const steps = [
  {
    id: 'discover',
    label: '01 — Upptäck',
    headline: 'Se rätt match direkt.',
    sub: 'Parium gör första intrycket visuellt, snabbt och premium.',
    image: storyDiscover,
    alt: 'Professionella människor som går på en stadsgata vid solnedgång',
  },
  {
    id: 'match',
    label: '02 — Matcha',
    headline: 'Rätt person. Rätt tajming.',
    sub: 'Två krafter möts — kandidat och arbetsgivare i en exakt träff.',
    image: storyMatch,
    alt: 'Två professionella skakar hand i modernt kontor',
  },
  {
    id: 'chat',
    label: '03 — Kontakt',
    headline: 'Dialog utan fördröjning.',
    sub: 'Samtalet startar sömlöst, medan intresset fortfarande brinner.',
    image: storyChat,
    alt: 'Kvinna tittar på smartphone i café',
  },
  {
    id: 'hire',
    label: '04 — Anställ',
    headline: 'Från match till anställning.',
    sub: 'Hela resan, i en plattform. Resultat du kan mäta.',
    image: storyHire,
    alt: 'Team firar med high-five på kontor',
  },
] as const;

type LandingHeroProps = {
  scrollContainerRef: RefObject<HTMLDivElement>;
};

const LandingHero = ({ scrollContainerRef }: LandingHeroProps) => {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    container: scrollContainerRef,
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  // Each image gets a continuous opacity driven directly by scroll position
  // 4 steps → each occupies 25% of scroll. Crossfade in the overlap zones.
  const fade = 0.08; // crossfade overlap (8% of total scroll)

  const img0Opacity = useTransform(scrollYProgress, [0, 0.25 - fade, 0.25], [1, 1, 0]);
  const img1Opacity = useTransform(scrollYProgress, [0.25 - fade, 0.25, 0.5 - fade, 0.5], [0, 1, 1, 0]);
  const img2Opacity = useTransform(scrollYProgress, [0.5 - fade, 0.5, 0.75 - fade, 0.75], [0, 1, 1, 0]);
  const img3Opacity = useTransform(scrollYProgress, [0.75 - fade, 0.75, 1], [0, 1, 1]);

  // Subtle Ken Burns zoom per image driven by scroll
  const img0Scale = useTransform(scrollYProgress, [0, 0.25], [1, 1.08]);
  const img1Scale = useTransform(scrollYProgress, [0.25, 0.5], [1, 1.08]);
  const img2Scale = useTransform(scrollYProgress, [0.5, 0.75], [1, 1.08]);
  const img3Scale = useTransform(scrollYProgress, [0.75, 1], [1, 1.08]);

  // Text content opacity — each step's text fades in/out
  const text0Opacity = useTransform(scrollYProgress, [0, 0.05, 0.2, 0.25], [0, 1, 1, 0]);
  const text1Opacity = useTransform(scrollYProgress, [0.25, 0.3, 0.45, 0.5], [0, 1, 1, 0]);
  const text2Opacity = useTransform(scrollYProgress, [0.5, 0.55, 0.7, 0.75], [0, 1, 1, 0]);
  const text3Opacity = useTransform(scrollYProgress, [0.75, 0.8, 0.95, 1], [0, 1, 1, 1]);

  // Text Y translation for parallax feel
  const text0Y = useTransform(scrollYProgress, [0, 0.05, 0.2, 0.25], [30, 0, 0, -20]);
  const text1Y = useTransform(scrollYProgress, [0.25, 0.3, 0.45, 0.5], [30, 0, 0, -20]);
  const text2Y = useTransform(scrollYProgress, [0.5, 0.55, 0.7, 0.75], [30, 0, 0, -20]);
  const text3Y = useTransform(scrollYProgress, [0.75, 0.8, 0.95, 1], [30, 0, 0, 0]);

  // Progress bar
  const progressScale = useTransform(scrollYProgress, [0, 1], [0.02, 1]);

  // Step indicator driven by scroll
  const stepIndicatorOpacity0 = useTransform(scrollYProgress, [0, 0.25], [1, 1]);
  const stepIndicatorOpacity1 = useTransform(scrollYProgress, [0.24, 0.26], [0.2, 1]);
  const stepIndicatorOpacity2 = useTransform(scrollYProgress, [0.49, 0.51], [0.2, 1]);
  const stepIndicatorOpacity3 = useTransform(scrollYProgress, [0.74, 0.76], [0.2, 1]);

  const imgOpacities = [img0Opacity, img1Opacity, img2Opacity, img3Opacity];
  const imgScales = [img0Scale, img1Scale, img2Scale, img3Scale];
  const textOpacities = [text0Opacity, text1Opacity, text2Opacity, text3Opacity];
  const textYs = [text0Y, text1Y, text2Y, text3Y];
  const stepOpacities = [stepIndicatorOpacity0, stepIndicatorOpacity1, stepIndicatorOpacity2, stepIndicatorOpacity3];

  // Preload images
  useEffect(() => {
    steps.forEach(({ image }) => {
      const img = new Image();
      img.src = image;
    });
  }, []);

  const handleStart = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register' } });
  };

  return (
    <section ref={sectionRef} className="relative" style={{ height: '400vh' }}>
      <div className="sticky top-0 h-[100dvh] overflow-hidden">
        {/* All 4 images stacked — opacity driven by scroll continuously */}
        {steps.map((step, i) => (
          <motion.img
            key={step.id}
            src={step.image}
            alt={step.alt}
            loading={i === 0 ? 'eager' : 'lazy'}
            className="absolute inset-0 h-full w-full object-cover will-change-transform"
            style={{
              opacity: imgOpacities[i],
              scale: imgScales[i],
              zIndex: i,
            }}
          />
        ))}

        {/* Gradient overlays */}
        <div className="pointer-events-none absolute inset-0 z-[5] bg-gradient-to-t from-black/80 via-black/30 to-black/50" />
        <div className="pointer-events-none absolute inset-0 z-[5] bg-gradient-to-r from-black/40 to-transparent lg:from-black/60" />

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col justify-between">
          <div className="flex flex-1 flex-col justify-end px-6 pb-24 lg:justify-center lg:px-16 lg:pb-0 lg:max-w-[55%]">
            {/* Badge */}
            <motion.span
              className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-white/70 backdrop-blur-xl"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              Parium
            </motion.span>

            {/* Main heading */}
            <motion.h1
              className="max-w-[10ch] text-[clamp(3rem,9vw,7rem)] font-black uppercase leading-[0.88] tracking-[-0.04em] text-white"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.05 }}
            >
              Rekrytering. I rörelse.
            </motion.h1>

            {/* Scroll-driven step text — all 4 layered, opacity controlled by scroll */}
            <div className="relative mt-6 min-h-[7rem]">
              {steps.map((step, i) => (
                <motion.div
                  key={step.id}
                  className="absolute inset-0"
                  style={{ opacity: textOpacities[i], y: textYs[i] }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                    {step.label}
                  </p>
                  <h2 className="mt-2 text-[clamp(1.4rem,3.5vw,2.4rem)] font-semibold leading-tight tracking-[-0.02em] text-white">
                    {step.headline}
                  </h2>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-white/60 sm:text-base">
                    {step.sub}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <motion.div
              className="mt-6 flex items-center gap-4"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
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

          {/* Step indicators — glow driven by scroll */}
          <div className="relative z-20 flex items-center gap-3 px-6 pb-5 lg:px-16 lg:pb-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.id}
                className="h-1 flex-1 rounded-full bg-white/15"
                style={{ opacity: 1 }}
              >
                <motion.div
                  className="h-full w-full rounded-full bg-secondary"
                  style={{ opacity: stepOpacities[i] }}
                />
              </motion.div>
            ))}
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
