import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { useRef, type ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

type Panel = {
  eyebrow?: string;
  title: ReactNode;
  body?: ReactNode;
  visual?: ReactNode;
};

type HorizontalScrollSectionProps = {
  panels: Panel[];
  /** Section pin-height multiplier per panel (1 = 100vh of scroll per panel). */
  panelScrollVh?: number;
};

/**
 * Premium scroll-jacking section.
 * Desktop/tablet: pins for `panels.length * panelScrollVh` of vertical scroll
 * and translates a horizontal track from 0 → -((n-1)*100%) as the user scrolls.
 * Mobile: stacks panels vertically (smoother, no horizontal jank).
 */
const HorizontalScrollSection = ({ panels, panelScrollVh = 1 }: HorizontalScrollSectionProps) => {
  const isMobile = useIsMobile();
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  // Smooth out the scroll for that buttery premium feel
  const smooth = useSpring(scrollYProgress, { stiffness: 90, damping: 30, mass: 0.4 });
  const translateX = useTransform(smooth, [0, 1], ['0%', `-${(panels.length - 1) * 100}%`]);
  const progressBar = useTransform(smooth, [0, 1], ['0%', '100%']);

  if (isMobile) {
    return (
      <section className="relative">
        {panels.map((p, i) => (
          <div
            key={i}
            className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden px-5 py-20 sm:px-6"
          >
            <PanelInner panel={p} index={i} total={panels.length} />
          </div>
        ))}
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      className="relative"
      style={{ height: `${panels.length * panelScrollVh * 100}svh` }}
    >
      <div className="sticky top-0 flex h-svh w-full items-center overflow-hidden">
        {/* Top-edge progress bar */}
        <motion.div
          aria-hidden
          style={{ width: progressBar }}
          className="absolute left-0 top-0 z-30 h-[2px] bg-gradient-to-r from-secondary/0 via-secondary to-secondary/0"
        />

        {/* Panel counter */}
        <div className="absolute right-6 top-6 z-30 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45 md:right-12 lg:right-24">
          <PanelCounter progress={smooth} total={panels.length} />
        </div>

        <motion.div style={{ x: translateX }} className="flex h-full w-max">
          {panels.map((p, i) => (
            <div
              key={i}
              className="relative flex h-svh w-screen shrink-0 items-center px-5 sm:px-6 md:px-12 lg:px-24"
            >
              <PanelInner panel={p} index={i} total={panels.length} horizontal />
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

const PanelCounter = ({
  progress,
  total,
}: {
  progress: ReturnType<typeof useSpring>;
  total: number;
}) => {
  const idx = useTransform(progress, (v) => {
    const i = Math.round(v * (total - 1)) + 1;
    return `${String(i).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  });
  return <motion.span>{idx}</motion.span>;
};

const PanelInner = ({
  panel,
  index,
  total,
  horizontal = false,
}: {
  panel: Panel;
  index: number;
  total: number;
  horizontal?: boolean;
}) => (
  <div
    className={
      horizontal
        ? 'mx-auto grid w-full max-w-[1280px] grid-cols-1 items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]'
        : 'mx-auto grid w-full max-w-[1280px] grid-cols-1 items-center gap-10'
    }
  >
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
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

    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 30 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      className="relative"
    >
      {panel.visual ?? <PanelPlaceholder />}
    </motion.div>
  </div>
);

const PanelPlaceholder = () => (
  <div className="relative mx-auto aspect-[9/16] w-full max-w-[360px] overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.015] shadow-[0_40px_120px_hsl(var(--background)/0.6)] backdrop-blur-2xl">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--secondary)/0.18),transparent_60%)]" />
    <div className="relative flex h-full flex-col gap-4 p-6">
      <div className="h-3 w-20 rounded-full bg-white/15" />
      <div className="h-6 w-40 rounded-full bg-white/25" />
      <div className="mt-4 flex-1 rounded-2xl border border-white/10 bg-white/[0.04]" />
      <div className="flex gap-2">
        <div className="h-11 flex-1 rounded-full bg-white/10" />
        <div className="h-11 flex-1 rounded-full bg-secondary/80" />
      </div>
    </div>
  </div>
);

export default HorizontalScrollSection;
