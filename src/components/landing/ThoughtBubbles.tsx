import { motion, useReducedMotion } from 'framer-motion';

/**
 * ThoughtBubbles — four floating thought clouds that frame the brain.
 *
 * Layout rules:
 *  - 2 bubbles in the upper area, 2 in the lower area — asymmetric placement.
 *  - Upper bubbles MUST NOT touch the navbar (Parium logo / FUNKTIONER / HUR DET FUNGERAR / Logga in).
 *    The navbar lives in the top ~5rem, and the hero adds pt-24 (6rem). We keep bubbles
 *    safely below that with `top-[18%]+`.
 *  - Lower bubbles MUST NOT touch the CTA buttons at the bottom of the hero.
 *    CTAs sit in the bottom ~6rem, so lower bubbles stay above with `bottom-[22%]+`.
 *  - Nothing sits behind the brain (brain occupies the horizontal middle band).
 *
 * Each bubble has a tail of dots that descend toward the brain so they
 * look like thoughts rising from / connected to it.
 */

type Bubble = {
  text: string;
  /** Tailwind position classes (mobile first → desktop) */
  position: string;
  /** Delay (s) for the entrance animation */
  delay: number;
  /** Float duration (s) for the idle loop */
  floatDuration: number;
  /** Where the tail attaches to the bubble — slants toward brain center */
  tailAnchor: 'l' | 'c' | 'r';
  /** Where the tail extends FROM the bubble */
  tailDirection: 'down' | 'up';
  /** Tail length (number of dots, 3-5) */
  tailLength?: number;
  /** Hide on small screens to keep mobile uncluttered */
  hideOnMobile?: boolean;
};

/**
 * Two bubbles in the upper area + two in the lower area.
 * Positions are intentionally off-axis (no two share a row) and well clear
 * of both the navbar and the bottom CTAs.
 */
const bubbles: Bubble[] = [
  // ── UPPER AREA (clear of navbar) ──────────────────────────────────────
  {
    text: 'Ska vi rekrytera en ny kollega?',
    position: 'left-[3%] top-[14%] sm:left-[8%] sm:top-[15%] lg:left-[16%] lg:top-[17%]',
    delay: 3.0,
    floatDuration: 7.5,
    tailAnchor: 'r',
    tailDirection: 'down',
    tailLength: 4,
  },
  {
    text: 'Hur går vi tillväga för att rekrytera?',
    position: 'right-[3%] top-[20%] sm:right-[8%] sm:top-[21%] lg:right-[16%] lg:top-[24%]',
    delay: 3.3,
    floatDuration: 8.5,
    tailAnchor: 'l',
    tailDirection: 'down',
    tailLength: 4,
  },

  // ── SIDE AREA (mid-height) — hidden on mobile to avoid covering the phone ─
  {
    text: 'Ska jag söka nytt jobb?',
    position: 'left-[6%] top-[41%] lg:left-[12%] lg:top-[43%]',
    delay: 3.45,
    floatDuration: 8.2,
    tailAnchor: 'r',
    tailDirection: 'down',
    tailLength: 3,
    hideOnMobile: true,
  },
  {
    text: 'Är det värt att anställa en till?',
    position: 'right-[6%] top-[47%] lg:right-[12%] lg:top-[49%]',
    delay: 3.75,
    floatDuration: 8.7,
    tailAnchor: 'l',
    tailDirection: 'down',
    tailLength: 3,
    hideOnMobile: true,
  },

  // ── LOWER AREA (clear of CTAs) ────────────────────────────────────────
  {
    text: 'Jag trivs inte där jag jobbar i dag.',
    position: 'left-[3%] bottom-[24%] sm:left-[8%] sm:bottom-[24%] lg:left-[16%] lg:bottom-[26%]',
    delay: 3.6,
    floatDuration: 8,
    tailAnchor: 'r',
    tailDirection: 'up',
    tailLength: 4,
  },
  {
    text: 'Det är jobbigt att söka jobb.',
    position: 'right-[3%] bottom-[18%] sm:right-[8%] sm:bottom-[18%] lg:right-[16%] lg:bottom-[20%]',
    delay: 3.9,
    floatDuration: 9,
    tailAnchor: 'l',
    tailDirection: 'up',
    tailLength: 4,
  },
];

const TailDots = ({ length, delay }: { length: number; delay: number }) => {
  const prefersReducedMotion = useReducedMotion();
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
            delay: delay + i * 0.18,
          }}
        />
      ))}
    </div>
  );
};

const ThoughtBubble = ({ bubble, index }: { bubble: Bubble; index: number }) => {
  const prefersReducedMotion = useReducedMotion();

  const horizontalAnchor =
    bubble.tailAnchor === 'l'
      ? 'left-5'
      : bubble.tailAnchor === 'r'
        ? 'right-5'
        : 'left-1/2 -translate-x-1/2';

  // Tail is rendered below the bubble (down) or above (up)
  const verticalAnchor =
    bubble.tailDirection === 'down'
      ? '-bottom-2 translate-y-full'
      : '-top-2 -translate-y-full';

  return (
    <motion.div
      className={`pointer-events-none absolute z-[15] ${bubble.position} ${bubble.hideOnMobile ? 'hidden lg:block' : ''}`}
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
          {/* Soft outer glow */}
          <div className="absolute -inset-3 rounded-[2.5rem] bg-secondary/20 blur-2xl opacity-60 transition-opacity duration-500 group-hover:opacity-100 group-hover:bg-secondary/40" />

          {/* Hover gradient ring */}
          <div className="pointer-events-none absolute -inset-px rounded-[2rem] bg-[linear-gradient(135deg,hsl(var(--secondary)/0.7),hsl(var(--primary)/0.4)_60%,hsl(var(--secondary)/0.6))] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

          {/* Bubble body */}
          <div className="relative max-w-[140px] sm:max-w-[180px] lg:max-w-[230px] rounded-[1.25rem] sm:rounded-[2rem] border border-white/30 bg-white/85 px-3 py-2 sm:px-4 sm:py-3 lg:px-5 lg:py-3.5 shadow-[0_10px_40px_hsl(var(--background)/0.4)] backdrop-blur-md transition-all duration-500 group-hover:border-white/60 group-hover:bg-white group-hover:shadow-[0_18px_60px_hsl(var(--secondary)/0.35)]">
            <p className="text-[10.5px] sm:text-[12px] lg:text-[14px] font-bold leading-tight text-[hsl(220_50%_20%)] text-center">
              – {bubble.text}
            </p>
          </div>
        </motion.div>

        {/* Tail dots toward the brain */}
        <div className={`absolute ${horizontalAnchor} ${verticalAnchor}`}>
          <TailDots length={bubble.tailLength ?? 4} delay={bubble.delay} />
        </div>
      </motion.div>
    </motion.div>
  );
};

export const ThoughtBubbles = () => {
  return (
    <div className="pointer-events-none absolute inset-0 z-[15]" aria-hidden>
      {bubbles.map((bubble, i) => (
        <ThoughtBubble key={i} bubble={bubble} index={i} />
      ))}
    </div>
  );
};

export default ThoughtBubbles;
