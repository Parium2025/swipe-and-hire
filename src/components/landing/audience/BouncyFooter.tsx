import { useEffect, useRef } from 'react';
import { motion, useAnimationFrame } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import SplitHeadline from './SplitHeadline';
import MagneticButton from './MagneticButton';

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
  const animatingRef = useRef(false);

  // Replay elastic morph varje gång sektionen passerar in igen efter reset-linjen.
  // Reset-linjen armar om även om föregående bounce fortfarande klingar av; annars
  // missas varannan trigger när man scrollar upp snabbt och vänder tillbaka ned.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const scrollRoot = (document.querySelector('[data-landing-scroll-root]') as HTMLElement) ?? null;
    let armed = true;

    const triggerBounce = () => {
      if (!armed) return;
      armed = false;
      startRef.current = null;
      pathRef.current?.setAttribute('d', buildPath(156));
      animatingRef.current = true;
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            triggerBounce();
          } else {
            // Förbi reset-linjen -> arma alltid om inför nästa nedscrollning.
            armed = true;
            // Återställ kurvan till nedböjt startläge medan den är utanför triggerzonen.
            pathRef.current?.setAttribute('d', buildPath(156));
          }
        }
      },
      // Shrink top så att "out of view" triggas redan när man scrollar upp en kort bit
      // (ca 15% av viewporten) — då armas bouncen om snabbare nästa gång man scrollar ner.
      { root: scrollRoot, rootMargin: '-15% 0px 18% 0px', threshold: 0 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);


  useAnimationFrame((t) => {
    if (!animatingRef.current || !pathRef.current) return;
    if (startRef.current === null) startRef.current = t;
    const elapsed = (t - startRef.current) / 1000;
    const duration = 1.8;
    const progress = Math.min(elapsed / duration, 1);
    const eased = elasticOut(progress, 1, 0.38);
    // From 156 (down/bouncy) to 0 (center/flat)
    const y = 156 + (0 - 156) * eased;
    pathRef.current.setAttribute('d', buildPath(y));
    if (progress >= 1) {
      pathRef.current.setAttribute('d', buildPath(0));
      animatingRef.current = false;
    }
  });

  const headline = 'Skapa ett konto nu.';
  const sub =
    audience === 'job_seeker'
      ? 'Vi är här för att ta dig till nästa steg.'
      : 'Vi är här för att ta er till nästa anställning.';
  const cta = audience === 'job_seeker' ? 'Kom igång gratis' : 'Skapa arbetsgivarkonto';

  return (
    <div
      ref={wrapperRef}
      className="relative w-full overflow-hidden bg-primary"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 900px' } as React.CSSProperties}
    >
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
              <stop offset="0.8" stopColor="hsl(var(--secondary))" />
            </linearGradient>
          </defs>
          <path
            ref={pathRef}
            d={buildPath(156)}
            fill="url(#bouncy-footer-grad)"
          />
        </svg>

        {/* Content overlay – sits inside the colored bounce */}
          <div className="absolute inset-x-0 bottom-0 top-0 flex items-center justify-center px-6 pb-8 pt-16 sm:pb-10 md:items-end md:pb-28 md:pt-0">
            <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.01, margin: "0px 0px 100% 0px" }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
            className="mx-auto max-w-3xl text-center"
          >
              <SplitHeadline
                as="h2"
                text={headline}
                emphasizeLast
                delay={0.55}
                className="audience-ipad-heading audience-ipad-heading--single-line text-3xl font-black leading-[1.05] tracking-[-0.025em] text-background sm:text-5xl md:text-6xl md:[@media_(orientation:landscape)_and_(min-width:900px)_and_(max-width:1400px)]:text-[clamp(3rem,4.8vw,3.75rem)] md:[@media_(orientation:landscape)_and_(min-width:900px)_and_(max-width:1400px)]:leading-[1.05] md:[@media_(orientation:landscape)_and_(min-width:900px)_and_(max-width:1400px)]:whitespace-nowrap md:[@media_(orientation:portrait)]:text-[5.25rem] md:[@media_(orientation:portrait)]:leading-[1.05]"
              />
            <p className="mx-auto mt-4 max-w-xl text-base font-medium leading-7 text-background/80 sm:text-lg">
              {sub}
            </p>
            <MagneticButton
              type="button"
              onPointerDown={onCta}
              className="group mt-8 inline-flex min-h-touch items-center justify-center rounded-full border-2 border-white bg-secondary px-7 py-3.5 text-sm font-bold text-white shadow-[0_18px_55px_-12px_hsl(var(--secondary)/0.6)] transition-shadow hover:shadow-[0_22px_70px_-12px_hsl(var(--secondary)/0.8)]"
            >
              {cta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </MagneticButton>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default BouncyFooter;
