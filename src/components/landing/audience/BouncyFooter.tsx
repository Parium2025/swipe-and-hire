import { useEffect, useRef, useState } from 'react';
import { motion, useAnimationFrame } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

type Props = {
  audience: 'job_seeker' | 'employer';
  onCta: () => void;
};

// Elastic ease-out (matches GSAP elastic.out(1, 0.3) feel)
const elasticOut = (t: number, amplitude = 1, period = 0.3) => {
  if (t === 0 || t === 1) return t;
  const s = (period / (2 * Math.PI)) * Math.asin(1 / amplitude);
  return amplitude * Math.pow(2, -10 * t) * Math.sin(((t - s) * (2 * Math.PI)) / period) + 1;
};

const buildPath = (curveY: number) =>
  `M0-0.3C0-0.3,464,${curveY},1139,${curveY}S2278-0.3,2278-0.3V683H0V-0.3z`;

const BouncyFooter = ({ audience, onCta }: Props) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const startRef = useRef<number | null>(null);
  const [animating, setAnimating] = useState(false);
  const [played, setPlayed] = useState(false);

  // Trigger elastic morph when footer enters viewport
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    // Find scrollable container (landing root) or fall back to window
    const root = (document.querySelector('[data-landing-scroll-root]') as HTMLElement) ?? null;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !played) {
            setPlayed(true);
            setAnimating(true);
            startRef.current = null;
          }
        }
      },
      { root, threshold: 0.05 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [played]);

  useAnimationFrame((t) => {
    if (!animating || !pathRef.current) return;
    if (startRef.current === null) startRef.current = t;
    const elapsed = (t - startRef.current) / 1000;
    const duration = 2;
    const progress = Math.min(elapsed / duration, 1);
    const eased = elasticOut(progress);
    // From 156 (down/bouncy) to 0 (center/flat)
    const y = 156 + (0 - 156) * eased;
    pathRef.current.setAttribute('d', buildPath(y));
    if (progress >= 1) setAnimating(false);
  });

  const headline =
    audience === 'job_seeker'
      ? 'Skapa ett konto nu.'
      : 'Skapa ett konto nu.';
  const sub =
    audience === 'job_seeker'
      ? 'Vi är här för att ta dig till nästa steg.'
      : 'Vi är här för att ta er till nästa anställning.';
  const cta = audience === 'job_seeker' ? 'Kom igång gratis' : 'Skapa arbetsgivarkonto';

  return (
    <div ref={wrapperRef} className="relative w-full overflow-hidden">
      {/* Bouncy gradient wave */}
      <div className="relative w-full">
        <svg
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 2278 683"
          className="block h-[60vh] min-h-[420px] w-full overflow-visible"
          aria-hidden
        >
          <defs>
            <linearGradient id="bouncy-footer-grad" x1="0" y1="0" x2="2278" y2="683" gradientUnits="userSpaceOnUse">
              <stop offset="0.2" stopColor="hsl(var(--secondary))" />
              <stop offset="0.8" stopColor="hsl(var(--primary-glow, var(--primary)))" />
            </linearGradient>
          </defs>
          <path
            ref={pathRef}
            d={buildPath(156)}
            fill="url(#bouncy-footer-grad)"
          />
        </svg>

        {/* Content overlay – sits inside the colored bounce */}
        <div className="absolute inset-x-0 bottom-0 top-0 flex items-end justify-center px-6 pb-16 sm:pb-20 md:pb-28">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
            className="mx-auto max-w-3xl text-center"
          >
            <h2 className="text-3xl font-black leading-[1.05] tracking-[-0.02em] text-background sm:text-5xl md:text-6xl">
              {headline}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base font-medium leading-7 text-background/80 sm:text-lg">
              {sub}
            </p>
            <button
              type="button"
              onPointerDown={onCta}
              className="group mt-8 inline-flex min-h-touch items-center justify-center gap-3 rounded-full bg-background px-7 py-3.5 text-sm font-bold text-foreground shadow-[0_18px_55px_hsl(var(--background)/0.35)] transition-shadow hover:shadow-[0_22px_70px_hsl(var(--background)/0.5)]"
            >
              {cta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default BouncyFooter;
