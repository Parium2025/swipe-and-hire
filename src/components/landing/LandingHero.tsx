import { useRef, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import pariumLogo from '/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png';

const storyFrames = [
  { id: 'start', headline: 'Vi finns här för dig.', sub: 'Jobb och kandidater, samlat i ett flöde som rör sig med dig.' },
  { id: 'swipe', headline: 'Svep när det känns rätt.', sub: 'Snabba beslut, tydliga profiler och bättre tajming.' },
  { id: 'match', headline: 'Matchen sker direkt.', sub: 'När båda är intresserade öppnas dialogen utan friktion.' },
  { id: 'brand', headline: 'Parium.', sub: 'Rekrytering som känns enkel från första sekunden.' },
];

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

  const phoneY = useTransform(scrollYProgress, [0, 0.38, 0.72, 1], ['8%', '0%', '-3%', '0%']);
  const phoneScale = useTransform(scrollYProgress, [0, 0.46, 0.72, 1], [0.82, 0.94, 1.18, 1.48]);
  const phoneRotate = useTransform(scrollYProgress, [0, 0.36, 0.72, 1], [-2.5, 0, 0.8, 0]);
  const streetOpacity = useTransform(scrollYProgress, [0, 0.68, 0.86], [1, 1, 0]);
  const brandFillOpacity = useTransform(scrollYProgress, [0.72, 0.9, 1], [0, 1, 1]);
  const logoScale = useTransform(scrollYProgress, [0.74, 0.92, 1], [0.78, 1, 1.03]);
  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);
  const textOpacities = [
    useTransform(scrollYProgress, [0, 0.04, 0.18, 0.28], [1, 1, 1, 0]),
    useTransform(scrollYProgress, [0.24, 0.34, 0.46, 0.56], [0, 1, 1, 0]),
    useTransform(scrollYProgress, [0.52, 0.62, 0.72, 0.82], [0, 1, 1, 0]),
    useTransform(scrollYProgress, [0.78, 0.9, 1], [0, 1, 1]),
  ];
  const textYs = [
    useTransform(scrollYProgress, [0, 0.2, 0.28], [0, 0, -18]),
    useTransform(scrollYProgress, [0.24, 0.34, 0.56], [18, 0, -18]),
    useTransform(scrollYProgress, [0.52, 0.62, 0.82], [18, 0, -18]),
    useTransform(scrollYProgress, [0.78, 0.9], [18, 0]),
  ];

  const handleStart = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register' } });
  };

  return (
    <section ref={sectionRef} className="relative" style={{ height: '400vh' }}>
      <div className="sticky top-0 h-[100dvh] overflow-hidden">
        {/* First slide: profession grid */}
        <motion.div
          className="absolute inset-0 will-change-transform"
          style={{
            opacity: imgOpacities[0],
            scale: imgScales[0],
            zIndex: 0,
          }}
        >
          <ProfessionGrid />
        </motion.div>

        {/* Remaining slides: regular images */}
        {steps.slice(1).map((step, idx) => {
          const i = idx + 1;
          return (
            <motion.img
              key={step.id}
              src={step.image!}
              alt={step.alt}
              width={1920}
              height={1080}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover will-change-transform"
              style={{
                opacity: imgOpacities[i],
                scale: imgScales[i],
                zIndex: i,
              }}
            />
          );
        })}

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
