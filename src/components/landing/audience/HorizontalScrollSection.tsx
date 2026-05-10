import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

type Panel = {
  eyebrow?: string;
  title: ReactNode;
  body?: ReactNode;
  visual?: ReactNode;
};

type HorizontalScrollSectionProps = {
  panels: Panel[];
  /** Kept for backwards-compat; not used by the staircase layout. */
  panelScrollVh?: number;
};

/**
 * Premium "staircase" scroll section (inspired by originexec.com).
 * Each panel pins for ~100svh of vertical scroll. As you scroll:
 *   - the image glides in from the alternating side (right / left / right / left)
 *   - the text drifts in from the opposite side with a slight delay
 *   - both fade and parallax slightly to feel layered & cinematic
 *
 * Mobile: simpler stacked layout, image always on top, no horizontal motion.
 */
const HorizontalScrollSection = ({ panels }: HorizontalScrollSectionProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <section className="relative">
        {panels.map((p, i) => (
          <MobilePanel key={i} panel={p} index={i} total={panels.length} />
        ))}
      </section>
    );
  }

  return (
    <section className="relative">
      {panels.map((p, i) => (
        <StaircasePanel
          key={i}
          panel={p}
          index={i}
          total={panels.length}
          imageOnRight={i % 2 === 0}
        />
      ))}
    </section>
  );
};

/* ───────────────────────── Desktop staircase panel ───────────────────────── */

const StaircasePanel = ({
  panel,
  index,
  total,
  imageOnRight,
}: {
  panel: Panel;
  index: number;
  total: number;
  imageOnRight: boolean;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [container, setContainer] = useState<RefObject<HTMLElement> | undefined>(undefined);

  // The landing page uses an inner scrollable container (fixed inset-0 overflow-y-auto),
  // not the window. Find it once mounted and feed it to useScroll.
  useEffect(() => {
    const root = ref.current?.closest<HTMLElement>('[data-landing-scroll-root]');
    if (root) setContainer({ current: root });
  }, []);

  const { scrollYProgress } = useScroll({
    target: ref,
    container,
    offset: ['start end', 'end start'],
  });

  // Image slides in from its side, parks in the middle, then drifts out.
  const imgFromX = imageOnRight ? 180 : -180;
  const imageX = useTransform(
    scrollYProgress,
    [0, 0.35, 0.65, 1],
    reduce ? [0, 0, 0, 0] : [imgFromX, 0, 0, -imgFromX * 0.35],
  );
  const imageY = useTransform(scrollYProgress, [0, 0.5, 1], reduce ? [0, 0, 0] : [80, 0, -80]);
  const imageOpacity = useTransform(scrollYProgress, [0, 0.25, 0.75, 1], [0, 1, 1, 0.4]);
  const imageScale = useTransform(scrollYProgress, [0, 0.5, 1], reduce ? [1, 1, 1] : [0.92, 1, 1.04]);

  // Text comes from the opposite side, with a slightly later in-point.
  const textFromX = imageOnRight ? -120 : 120;
  const textX = useTransform(
    scrollYProgress,
    [0, 0.4, 0.7, 1],
    reduce ? [0, 0, 0, 0] : [textFromX, 0, 0, -textFromX * 0.25],
  );
  const textOpacity = useTransform(scrollYProgress, [0.05, 0.35, 0.8, 1], [0, 1, 1, 0.3]);

  return (
    <div
      ref={ref}
      className="relative flex min-h-[100svh] items-center overflow-hidden px-6 py-24 md:px-12 lg:px-24"
    >
      <div
        className={
          'mx-auto grid w-full max-w-[1280px] grid-cols-1 items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]'
        }
      >
        {/* Text column */}
        <motion.div
          style={{ x: textX, opacity: textOpacity }}
          className={imageOnRight ? 'lg:order-1' : 'lg:order-2'}
        >
          {panel.eyebrow && (
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary/75">
              {panel.eyebrow}
            </span>
          )}
          <h2 className="mt-5 max-w-2xl text-4xl font-black leading-[0.96] tracking-[-0.025em] text-white sm:text-5xl md:text-6xl lg:text-[5rem]">
            {panel.title}
          </h2>
          {panel.body && (
            <div className="mt-6 max-w-xl text-base leading-8 text-white/60 sm:text-lg">
              {panel.body}
            </div>
          )}
          <div className="mt-10 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
            <span>{String(index + 1).padStart(2, '0')}</span>
            <span className="h-px w-10 bg-white/25" />
            <span>{String(total).padStart(2, '0')}</span>
          </div>
        </motion.div>

        {/* Image column */}
        <motion.div
          style={{
            x: imageX,
            y: imageY,
            opacity: imageOpacity,
            scale: imageScale,
          }}
          className={`relative ${imageOnRight ? 'lg:order-2' : 'lg:order-1'}`}
        >
          {panel.visual ?? <PanelPlaceholder />}
        </motion.div>
      </div>
    </div>
  );
};

/* ───────────────────────── Mobile stacked panel ───────────────────────── */

const MobilePanel = ({
  panel,
  index,
  total,
}: {
  panel: Panel;
  index: number;
  total: number;
}) => (
  <div className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden px-5 py-20 sm:px-6">
    <div className="mx-auto grid w-full max-w-[1280px] grid-cols-1 items-center gap-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 30 }}
        whileInView={{ opacity: 1, scale: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="relative"
      >
        {panel.visual ?? <PanelPlaceholder />}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      >
        {panel.eyebrow && (
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary/75">
            {panel.eyebrow}
          </span>
        )}
        <h2 className="mt-5 max-w-2xl text-4xl font-black leading-[0.96] tracking-[-0.025em] text-white sm:text-5xl">
          {panel.title}
        </h2>
        {panel.body && (
          <div className="mt-6 max-w-xl text-base leading-8 text-white/60 sm:text-lg">
            {panel.body}
          </div>
        )}
        <div className="mt-10 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
          <span>{String(index + 1).padStart(2, '0')}</span>
          <span className="h-px w-10 bg-white/25" />
          <span>{String(total).padStart(2, '0')}</span>
        </div>
      </motion.div>
    </div>
  </div>
);

const PanelPlaceholder = () => (
  <div className="relative mx-auto aspect-[9/16] w-full max-w-[360px] overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.015] shadow-[0_40px_120px_hsl(var(--background)/0.6)] backdrop-blur-2xl">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--secondary)/0.18),transparent_60%)]" />
  </div>
);

export default HorizontalScrollSection;
