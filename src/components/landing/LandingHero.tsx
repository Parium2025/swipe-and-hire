import { useEffect, useRef, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import storyDiscover from '@/assets/landing-story-discover-v2.jpg';
import storyMatch from '@/assets/landing-story-match.jpg';
import storyChat from '@/assets/landing-story-chat.jpg';
import storyHire from '@/assets/landing-story-hire.jpg';

const steps = [
  {
    id: 'discover',
    headline: 'Vi finns här för er.',
    sub: 'Oavsett om du söker jobb eller rätt kandidat — Parium kopplar samman er.',
    image: storyDiscover,
    alt: 'Diversifierade professionella som går framåt på en stadsgata vid solnedgång',
  },
  {
    id: 'match',
    headline: 'Rätt person. Rätt tajming.',
    sub: 'Kandidat och arbetsgivare möts i en exakt, meningsfull matchning.',
    image: storyMatch,
    alt: 'Två professionella skakar hand framför en stadsutsikt',
  },
  {
    id: 'chat',
    headline: 'Dialog utan fördröjning.',
    sub: 'Samtalet startar sömlöst, medan intresset fortfarande brinner.',
    image: storyChat,
    alt: 'Kvinna använder smartphone i modernt café',
  },
  {
    id: 'hire',
    headline: 'Från match till anställning.',
    sub: 'Hela resan, i en plattform. Resultat du kan mäta.',
    image: storyHire,
    alt: 'Team firar med high-five på modernt kontor',
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

  // Wider crossfade overlap for smoother blending between images
  const fade = 0.12;

  const img0Opacity = useTransform(scrollYProgress, [0, 0.25 - fade, 0.25 + fade / 2], [1, 1, 0]);
  const img1Opacity = useTransform(scrollYProgress, [0.25 - fade, 0.25 + fade / 2, 0.5 - fade, 0.5 + fade / 2], [0, 1, 1, 0]);
  const img2Opacity = useTransform(scrollYProgress, [0.5 - fade, 0.5 + fade / 2, 0.75 - fade, 0.75 + fade / 2], [0, 1, 1, 0]);
  const img3Opacity = useTransform(scrollYProgress, [0.75 - fade, 0.75 + fade / 2, 1], [0, 1, 1]);

  // Ken Burns zoom
  const img0Scale = useTransform(scrollYProgress, [0, 0.25], [1, 1.12]);
  const img1Scale = useTransform(scrollYProgress, [0.25, 0.5], [1, 1.12]);
  const img2Scale = useTransform(scrollYProgress, [0.5, 0.75], [1, 1.12]);
  const img3Scale = useTransform(scrollYProgress, [0.75, 1], [1, 1.12]);

  // Text opacity — smoother fade with wider windows
  const text0Opacity = useTransform(scrollYProgress, [0, 0.03, 0.18, 0.25], [1, 1, 1, 0]);
  const text1Opacity = useTransform(scrollYProgress, [0.22, 0.28, 0.45, 0.5], [0, 1, 1, 0]);
  const text2Opacity = useTransform(scrollYProgress, [0.47, 0.53, 0.7, 0.75], [0, 1, 1, 0]);
  const text3Opacity = useTransform(scrollYProgress, [0.72, 0.78, 0.95, 1], [0, 1, 1, 1]);

  // Text Y translation
  const text0Y = useTransform(scrollYProgress, [0, 0.03, 0.18, 0.25], [0, 0, 0, -30]);
  const text1Y = useTransform(scrollYProgress, [0.22, 0.28, 0.45, 0.5], [30, 0, 0, -30]);
  const text2Y = useTransform(scrollYProgress, [0.47, 0.53, 0.7, 0.75], [30, 0, 0, -30]);
  const text3Y = useTransform(scrollYProgress, [0.72, 0.78, 0.95, 1], [30, 0, 0, 0]);

  // Single continuous progress bar
  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  const imgOpacities = [img0Opacity, img1Opacity, img2Opacity, img3Opacity];
  const imgScales = [img0Scale, img1Scale, img2Scale, img3Scale];
  const textOpacities = [text0Opacity, text1Opacity, text2Opacity, text3Opacity];
  const textYs = [text0Y, text1Y, text2Y, text3Y];

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
        {/* Stacked images — continuous crossfade */}
        {steps.map((step, i) => (
          <motion.img
            key={step.id}
            src={step.image}
            alt={step.alt}
            width={1920}
            height={1080}
            loading={i === 0 ? 'eager' : 'lazy'}
            className={`absolute inset-0 h-full w-full object-cover will-change-transform ${i === 0 ? 'object-[30%_center]' : ''}`}
            style={{
              opacity: imgOpacities[i],
              scale: imgScales[i],
              zIndex: i,
            }}
          />
        ))}

        {/* Gradient overlays for text readability */}
        <div className="pointer-events-none absolute inset-0 z-[5] bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
        <div className="pointer-events-none absolute inset-0 z-[5] bg-gradient-to-r from-black/15 to-transparent lg:from-black/20" />

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col justify-between">
          {/* Top text area — centered horizontally */}
          <div className="flex flex-col items-center px-6 pt-16 text-center lg:items-center lg:text-center lg:px-16 lg:flex-1 lg:justify-start">
            {/* Main heading */}
            <motion.h1
              className="text-[clamp(2.8rem,8vw,6.5rem)] font-black uppercase leading-[0.88] tracking-[-0.04em] text-white"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.05 }}
            >
              Rekrytering. I rörelse.
            </motion.h1>

            {/* Scroll-driven text — layered, fading smoothly */}
            <div className="relative mt-4 min-h-[5rem] w-full">
              {steps.map((step, i) => (
                <motion.div
                  key={step.id}
                  className="absolute inset-0 flex flex-col items-center lg:items-start"
                  style={{ opacity: textOpacities[i], y: textYs[i] }}
                >
                  <h2 className="text-[clamp(1.3rem,3.2vw,2.2rem)] font-semibold leading-tight tracking-[-0.02em] text-white">
                    {step.headline}
                  </h2>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-white/60 sm:text-base">
                    {step.sub}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* CTA — pinned to bottom, centered */}
          <motion.div
             className="absolute inset-x-0 bottom-20 z-20 flex justify-center px-6 sm:bottom-24 md:bottom-28 lg:relative lg:inset-auto lg:bottom-auto lg:z-auto lg:justify-center lg:px-16 lg:pb-12"
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

          {/* Minimal progress bar instead of step indicators */}
          <div className="relative z-20 px-6 pb-5 lg:px-16 lg:pb-8">
            <div className="h-[2px] w-full rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-secondary"
                style={{ width: progressWidth }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingHero;
