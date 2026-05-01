import { motion, useReducedMotion } from 'framer-motion';

/**
 * ThoughtBubbles — floating thought clouds that appear to rise FROM the
 * brain. All bubbles are placed in the upper half of the hero (above the
 * brain's visual center) and arranged asymmetrically so they never feel
 * like a grid. Each bubble has a trail of dots that descend toward the
 * brain — making them look connected to / pulled out of the brain.
 *
 * Constraints:
 *  - Nothing sits behind the brain (everything in upper region only).
 *  - Asymmetric placement (different heights, no straight rows).
 *  - Tail dots always descend toward the brain center.
 */

type Bubble = {
  text: string;
  /** Tailwind position classes (mobile first → desktop) */
  position: string;
  /** Delay (s) for the entrance animation */
  delay: number;
  /** Float duration (s) for the idle loop */
  floatDuration: number;
  /**
   * Horizontal anchor on the bubble where the tail starts.
   * 'l' = bottom-left, 'c' = bottom-center, 'r' = bottom-right.
   * Choose based on which side of the brain the bubble sits on, so the
   * tail visually slants toward the brain center.
   */
  tailAnchor: 'l' | 'c' | 'r';
  /** Tail length (number of dots, 3-5). Longer for bubbles farther up. */
  tailLength?: number;
  /** Hidden on small screens to avoid clutter */
  hideOnMobile?: boolean;
};

/**
 * All bubbles live in the TOP half of the hero, asymmetrically arranged.
 * Heights are intentionally varied (no two on the same row).
 */
const bubbles: Bubble[] = [
  // Far top-left, high up
  {
    text: 'Ska vi rekrytera en ny kollega?',
    position: 'left-[3%] top-[6%] sm:left-[5%] sm:top-[5%] lg:left-[7%] lg:top-[6%]',
    delay: 3.0,
    floatDuration: 7.5,
    tailAnchor: 'r',
    tailLength: 5,
  },
  // Upper-mid-left, slightly lower than first
  {
    text: 'Ska jag söka nytt jobb?',
    position: 'left-[6%] top-[26%] sm:left-[14%] sm:top-[22%] lg:left-[18%] lg:top-[24%]',
    delay: 3.4,
    floatDuration: 8.5,
    tailAnchor: 'r',
    tailLength: 4,
    hideOnMobile: false,
  },
  // Top-center, highest
  {
    text: 'Är det värt att anställa en till?',
    position: 'left-1/2 -translate-x-1/2 top-[2%] sm:top-[3%]',
    delay: 3.6,
    floatDuration: 9,
    tailAnchor: 'c',
    tailLength: 5,
    hideOnMobile: true,
  },
  // Upper-mid-right, lower than top-center
  {
    text: 'Hur går vi tillväga för att rekrytera?',
    position: 'right-[6%] top-[20%] sm:right-[14%] sm:top-[18%] lg:right-[18%] lg:top-[20%]',
    delay: 3.2,
    floatDuration: 8,
    tailAnchor: 'l',
    tailLength: 4,
  },
  // Far top-right, high
  {
    text: 'Det är jobbigt att söka jobb.',
    position: 'right-[3%] top-[8%] sm:right-[5%] sm:top-[7%] lg:right-[7%] lg:top-[8%]',
    delay: 3.8,
    floatDuration: 9.5,
    tailAnchor: 'l',
    tailLength: 5,
  },
  // Slight off-center bubble between mid-left and top-center
  {
    text: 'Jag trivs inte där jag jobbar i dag.',
    position: 'left-[32%] top-[12%] sm:left-[34%] sm:top-[10%] lg:left-[36%] lg:top-[12%]',
    delay: 4.0,
    floatDuration: 7.8,
    tailAnchor: 'c',
    tailLength: 4,
    hideOnMobile: true,
  },
];

const TailDots = ({ length, delay }: { length: number; delay: number }) => {
  const prefersReducedMotion = useReducedMotion();
  // Build dots: largest near the bubble, shrinking down toward the brain
  const sizes = ['h-2 w-2', 'h-1.5 w-1.5', 'h-1.5 w-1.5', 'h-1 w-1', 'h-1 w-1'];
  const dots = Array.from({ length }, (_, i) => sizes[i] ?? 'h-1 w-1');

  return (
    <div className="flex flex-col items-center gap-1.5">
      {dots.map((size, i) => (
        <motion.span
          key={i}
          className={`${size} rounded-full bg-white/80 shadow-[0_0_8px_hsl(var(--secondary)/0.5)]`}
          style={{ opacity: 0.9 - i * 0.12 }}
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  scale: [1, 1.25, 1],
                  opacity: [0.9 - i * 0.12, 1 - i * 0.1, 0.9 - i * 0.12],
                }
          }
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: 'easeInOut',
            // Stagger from bubble downward so the trail looks like it's
            // continuously emanating from the brain.
            delay: delay + i * 0.18,
          }}
        />
      ))}
    </div>
  );
};

const ThoughtBubble = ({ bubble, index }: { bubble: Bubble; index: number }) => {
  const prefersReducedMotion = useReducedMotion();

  const tailPositionClass =
    bubble.tailAnchor === 'l'
      ? 'left-5 -bottom-2 translate-y-full'
      : bubble.tailAnchor === 'r'
        ? 'right-5 -bottom-2 translate-y-full'
        : 'left-1/2 -translate-x-1/2 -bottom-2 translate-y-full';

  return (
    <motion.div
      className={`pointer-events-none absolute z-[5] ${bubble.position} ${
        bubble.hideOnMobile ? 'hidden sm:block' : ''
      }`}
      initial={{ opacity: 0, scale: 0.4, y: -20, filter: 'blur(12px)' }}
      animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: bubble.delay }}
    >
      <motion.div
        animate={
          prefersReducedMotion
            ? undefined
            : {
                y: [0, -6, 0],
                rotate: index % 2 === 0 ? [0, 1, 0] : [0, -1, 0],
              }
        }
        transition={{
          duration: bubble.floatDuration,
          ease: 'easeInOut',
          repeat: Infinity,
          delay: bubble.delay + 0.5,
        }}
        className="relative"
      >
        {/* Hover wrapper */}
        <motion.div
          className="group pointer-events-auto relative cursor-default"
          whileHover={{ scale: 1.06, y: -4 }}
          transition={{ type: 'spring', stiffness: 280, damping: 18 }}
        >
          {/* Soft outer glow — intensifies on hover */}
          <div className="absolute -inset-3 rounded-[2.5rem] bg-secondary/20 blur-2xl opacity-60 transition-opacity duration-500 group-hover:opacity-100 group-hover:bg-secondary/40" />

          {/* Animated gradient ring on hover */}
          <div className="pointer-events-none absolute -inset-px rounded-[2rem] bg-[linear-gradient(135deg,hsl(var(--secondary)/0.7),hsl(var(--primary)/0.4)_60%,hsl(var(--secondary)/0.6))] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

          {/* Bubble body */}
          <div className="relative max-w-[170px] sm:max-w-[210px] lg:max-w-[240px] rounded-[2rem] border border-white/30 bg-white/85 px-4 py-3 sm:px-5 sm:py-3.5 shadow-[0_10px_40px_hsl(var(--background)/0.4)] backdrop-blur-md transition-all duration-500 group-hover:border-white/60 group-hover:bg-white group-hover:shadow-[0_18px_60px_hsl(var(--secondary)/0.35)]">
            <p className="text-[11px] sm:text-[13px] lg:text-[14px] font-bold leading-tight text-[hsl(220_50%_20%)] text-center">
              – {bubble.text}
            </p>
          </div>
        </motion.div>

        {/* Tail dots — descend toward the brain (looks like the thought is being pulled up from the brain) */}
        <div className={`absolute ${tailPositionClass}`}>
          <TailDots length={bubble.tailLength ?? 4} delay={bubble.delay} />
        </div>
      </motion.div>
    </motion.div>
  );
};

export const ThoughtBubbles = () => {
  return (
    <div className="pointer-events-none absolute inset-0 z-[6]" aria-hidden>
      {bubbles.map((bubble, i) => (
        <ThoughtBubble key={i} bubble={bubble} index={i} />
      ))}
    </div>
  );
};

export default ThoughtBubbles;
