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
  const ctaOpacity = useTransform(scrollYProgress, [0, 0.66, 0.78], [1, 1, 0]);
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
    <section ref={sectionRef} className="relative" style={{ height: '420vh' }}>
      <div className="sticky top-0 h-[100dvh] overflow-hidden bg-gradient-parium">
        <motion.div className="pointer-events-none absolute inset-0" style={{ opacity: streetOpacity }}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,hsl(var(--secondary)/0.18),transparent_34%),linear-gradient(180deg,hsl(var(--primary)/0),hsl(var(--primary)/0.7))]" />
          <div className="absolute left-1/2 top-[18%] h-[120vh] w-[1px] origin-top bg-secondary/25" />
          <div className="absolute left-[22%] top-[22%] h-[105vh] w-[1px] origin-top -rotate-[18deg] bg-secondary/15" />
          <div className="absolute right-[22%] top-[22%] h-[105vh] w-[1px] origin-top rotate-[18deg] bg-secondary/15" />
          <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-[repeating-linear-gradient(90deg,hsl(var(--secondary)/0.09)_0_1px,transparent_1px_92px)] opacity-50" />
        </motion.div>

        <motion.div className="absolute inset-0 z-[3] bg-primary" style={{ opacity: brandFillOpacity }} />

        <div className="relative z-10 flex h-full flex-col items-center justify-between px-5 pb-5 pt-20 sm:px-8 sm:pb-8 lg:px-16">
          <div className="relative h-[8.75rem] w-full max-w-5xl text-center sm:h-[9.5rem]">
            {storyFrames.map((frame, i) => (
              <motion.div
                key={frame.id}
                className="absolute inset-x-0 top-0 flex flex-col items-center"
                style={{ opacity: textOpacities[i], y: textYs[i] }}
              >
                <h1 className="max-w-[12ch] text-[clamp(2.25rem,7vw,5.75rem)] font-black uppercase leading-[0.9] text-primary-foreground sm:max-w-none">
                  {frame.headline}
                </h1>
                <p className="mt-3 max-w-[34rem] text-sm font-medium leading-relaxed text-primary-foreground/70 sm:text-base md:text-lg">
                  {frame.sub}
                </p>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="relative z-10 flex w-full flex-1 items-center justify-center py-3 will-change-transform"
            style={{ y: phoneY, scale: phoneScale, rotate: phoneRotate }}
          >
            <div className="relative aspect-[9/18.8] h-[min(58vh,34rem)] min-h-[23rem] overflow-hidden rounded-[2.25rem] border-[0.58rem] border-primary bg-primary shadow-[0_30px_90px_hsl(var(--primary)/0.58)] sm:h-[min(62vh,38rem)]">
              <div className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-primary" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--primary))_0%,hsl(var(--primary)/0.88)_20%,hsl(var(--primary)/0.34)_100%)]" />
              <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 pb-3 pt-6 text-[0.63rem] font-bold text-primary-foreground/80">
                <span>13:58</span>
                <span>1/3</span>
              </div>
              <div className="absolute inset-x-4 top-16 z-10 flex justify-center">
                <div className="rounded-full border border-primary-foreground/15 bg-primary-foreground/8 px-4 py-2 text-[0.68rem] font-bold text-primary-foreground/85">
                  Visa filter
                </div>
              </div>
              <div className="absolute inset-x-4 top-28 bottom-24 overflow-hidden rounded-[1.35rem] border border-primary-foreground/10 bg-[linear-gradient(145deg,hsl(var(--accent)/0.9),hsl(var(--secondary)/0.14))]">
                <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0_36%,hsl(var(--primary)/0.16)_36%_37%,transparent_37%_64%,hsl(var(--primary)/0.14)_64%_65%,transparent_65%)]" />
                <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-[linear-gradient(180deg,transparent,hsl(var(--primary)/0.72))]" />
                <div className="absolute left-1/2 top-[44%] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-primary" />
                <div className="absolute inset-x-0 bottom-8 px-4 text-center">
                  <p className="text-[0.65rem] font-bold text-primary-foreground/75">Är Parium AB</p>
                  <p className="mt-1 text-xl font-black leading-none text-primary-foreground">Vi finns här för dig</p>
                  <p className="mt-2 text-[0.68rem] font-semibold text-primary-foreground/70">Heltid · Parium</p>
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-8 z-20 flex justify-center gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-destructive text-sm font-black text-destructive-foreground">×</div>
                <div className="grid h-11 w-11 place-items-center rounded-full bg-secondary text-sm font-black text-secondary-foreground">▱</div>
                <div className="grid h-11 w-11 place-items-center rounded-full bg-accent text-sm font-black text-accent-foreground">♥</div>
              </div>
            </div>
          </motion.div>

          <motion.div className="pointer-events-none absolute inset-0 z-20 grid place-items-center" style={{ opacity: brandFillOpacity }}>
            <motion.img src={pariumLogo} alt="Parium" className="h-auto w-[min(72vw,34rem)]" style={{ scale: logoScale }} />
          </motion.div>

          {/* CTA — pinned to bottom, centered */}
          <motion.div
             className="absolute inset-x-0 bottom-20 z-30 flex justify-center px-6 sm:bottom-24 md:bottom-28 lg:relative lg:inset-auto lg:bottom-auto lg:z-30 lg:justify-center lg:px-16 lg:pb-12"
            style={{ opacity: ctaOpacity }}
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
