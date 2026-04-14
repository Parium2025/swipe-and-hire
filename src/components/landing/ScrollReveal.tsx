import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, type ReactNode } from 'react';

const ease = [0.22, 1, 0.36, 1] as const;

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  /** How far the element travels vertically (px) */
  distance?: number;
  /** Horizontal parallax offset */
  xOffset?: number;
  /** Scale from → to */
  scaleFrom?: number;
  /** Rotation in degrees */
  rotateDeg?: number;
  /** Delay in seconds */
  delay?: number;
  /** Use 3D perspective */
  perspective?: boolean;
}

export const ScrollReveal = ({
  children,
  className,
  distance = 80,
  xOffset = 0,
  scaleFrom = 0.92,
  rotateDeg = 0,
  delay = 0,
  perspective = false,
}: ScrollRevealProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  // Parallax: element moves up as user scrolls
  const y = useTransform(scrollYProgress, [0, 0.5, 1], [distance, 0, -distance * 0.3]);
  const x = useTransform(scrollYProgress, [0, 0.5], [xOffset, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.25, 0.75, 1], [0, 1, 1, 0.6]);
  const scale = useTransform(scrollYProgress, [0, 0.4], [scaleFrom, 1]);
  const rotate = useTransform(scrollYProgress, [0, 0.5], [rotateDeg, 0]);

  return (
    <div ref={ref} className={perspective ? 'perspective-[1200px]' : undefined}>
      <motion.div
        className={className}
        style={{ y, x, opacity, scale, rotate }}
        transition={{ ease }}
      >
        {children}
      </motion.div>
    </div>
  );
};

/** Horizontal parallax layer — moves at different speed for depth */
export const ParallaxLayer = ({
  children,
  className,
  speed = 0.5,
}: {
  children: ReactNode;
  className?: string;
  speed?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [100 * speed, -100 * speed]);

  return (
    <motion.div ref={ref} className={className} style={{ y }}>
      {children}
    </motion.div>
  );
};

/** Stagger container for children */
export const StaggerReveal = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <motion.div
    className={className}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, margin: '-60px' }}
    variants={{
      hidden: {},
      visible: { transition: { staggerChildren: 0.12 } },
    }}
  >
    {children}
  </motion.div>
);

export const StaggerItem = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <motion.div
    className={className}
    variants={{
      hidden: { opacity: 0, y: 60, scale: 0.9, filter: 'blur(8px)' },
      visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        transition: { duration: 0.8, ease },
      },
    }}
  >
    {children}
  </motion.div>
);
