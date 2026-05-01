import { motion, useReducedMotion } from 'framer-motion';

/**
 * ThoughtBubbles — six floating thought clouds positioned around the
 * 3D brain. Bubbles are spread evenly so they never overlap each other
 * or the brain in the center. Each bubble has:
 *  - a staggered fade/scale entrance
 *  - a slow infinite float loop
 *  - a hover effect (lift, glow, brighten)
 *  - a "tail" of descending dots that point toward the brain's center
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
   * Where the bubble sits relative to the brain — controls which corner
   * the tail dots descend from so they always point INWARD toward the brain.
   */
  quadrant: 'tl' | 'tr' | 'bl' | 'br' | 'l' | 'r';
  /** Hidden on small screens to avoid clutter */
  hideOnMobile?: boolean;
};

const bubbles: Bubble[] = [
  // Top-left
  {
    text: 'Ska vi rekrytera en ny kollega?',
    position: 'left-[2%] top-[14%] sm:left-[4%] sm:top-[16%] lg:left-[6%] lg:top-[18%]',
    delay: 3.0,
    floatDuration: 7.5,
    quadrant: 'tl',
  },
  // Top-right
  {
    text: 'Hur går vi tillväga för att rekrytera?',
    position: 'right-[2%] top-[14%] sm:right-[4%] sm:top-[16%] lg:right-[6%] lg:top-[18%]',
    delay: 3.2,
    floatDuration: 9,
    quadrant: 'tr',
  },
  // Middle-left (desktop only — keeps mobile breathing)
  {
    text: 'Ska jag söka nytt jobb?',
    position: 'left-[1%] top-[44%] sm:left-[3%] lg:left-[4%]',
    delay: 3.4,
    floatDuration: 8.5,
    quadrant: 'l',
    hideOnMobile: true,
  },
  // Middle-right (desktop only)
  {
    text: 'Är det värt att anställa en till?',
    position: 'right-[1%] top-[44%] sm:right-[3%] lg:right-[4%]',
    delay: 3.6,
    floatDuration: 7.8,
    quadrant: 'r',
    hideOnMobile: true,
  },
  // Bottom-left
  {
    text: 'Jag trivs inte där jag jobbar i dag.',
    position: 'left-[2%] bottom-[8%] sm:left-[5%] sm:bottom-[10%] lg:left-[8%] lg:bottom-[12%]',
    delay: 3.8,
    floatDuration: 8,
    quadrant: 'bl',
  },
  // Bottom-right
  {
    text: 'Det är jobbigt att söka jobb.',
    position: 'right-[2%] bottom-[8%] sm:right-[5%] sm:bottom-[10%] lg:right-[8%] lg:bottom-[12%]',
    delay: 4.0,
    floatDuration: 9.5,
    quadrant: 'br',
  },
];

/**
 * Compute tail position + direction. Tails always point INWARD
 * toward the brain in the center of the hero.
 */
const tailPlacement = (q: Bubble['quadrant']) => {
  switch (q) {
    case 'tl':
      // bubble top-left of brain → tail descends from bottom-right of bubble, pointing down-right
      return { side: 'right-5 -bottom-6', dir: 'down-right' };
    case 'tr':
      return { side: 'left-5 -bottom-6', dir: 'down-left' };
    case 'l':
      return { side: '-right-6 top-1/2 -translate-y-1/2', dir: 'right' };
    case 'r':
      return { side: '-left-6 top-1/2 -translate-y-1/2', dir: 'left' };
    case 'bl':
      // bubble below-left of brain → tail rises from top-right, pointing up-right
      return { side: 'right-5 -top-6', dir: 'up-right' };
    case 'br':
      return { side: 'left-5 -top-6', dir: 'up-left' };
  }
};

const TailDots = ({ direction, delay }: { direction: string; delay: number }) => {
  const prefersReducedMotion = useReducedMotion();
  const isHorizontal = direction === 'left' || direction === 'right';
  const flexClass = isHorizontal ? 'flex-row' : 'flex-col';

  // Order dots so the largest is closest to the bubble and they shrink toward the brain
  return (
    <div className={`flex ${flexClass} items-center gap-1`}>
      <motion.span
        className="h-2 w-2 rounded-full border border-white/40 bg-white/85 shadow-[0_2px_8px_hsl(var(--secondary)/0.4)]"
        animate={prefersReducedMotion ? undefined : { scale: [1, 1.18, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay }}
      />
      <motion.span
        className="h-1.5 w-1.5 rounded-full border border-white/35 bg-white/75"
        animate={prefersReducedMotion ? undefined : { scale: [1, 1.22, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: delay + 0.18 }}
      />
      <motion.span
        className="h-1 w-1 rounded-full bg-white/60"
        animate={prefersReducedMotion ? undefined : { scale: [1, 1.28, 1], opacity: [0.55, 0.95, 0.55] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: delay + 0.36 }}
      />
    </div>
  );
};

const ThoughtBubble = ({ bubble, index }: { bubble: Bubble; index: number }) => {
  const prefersReducedMotion = useReducedMotion();
  const tail = tailPlacement(bubble.quadrant);

  return (
    <motion.div
      className={`pointer-events-none absolute z-[5] ${bubble.position} ${
        bubble.hideOnMobile ? 'hidden sm:block' : ''
      }`}
      initial={{ opacity: 0, scale: 0.4, y: 20, filter: 'blur(12px)' }}
      animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: bubble.delay }}
    >
      <motion.div
        animate={
          prefersReducedMotion
            ? undefined
            : {
                y: [0, -8, 0],
                rotate: index % 2 === 0 ? [0, 1.2, 0] : [0, -1.2, 0],
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
        {/* Hover-enabled wrapper (re-enable pointer events just here) */}
        <motion.div
          className="group pointer-events-auto relative cursor-default"
          whileHover={{ scale: 1.06, y: -4 }}
          transition={{ type: 'spring', stiffness: 280, damping: 18 }}
        >
          {/* Soft outer glow — intensifies on hover */}
          <div className="absolute -inset-3 rounded-[2.5rem] bg-secondary/20 blur-2xl opacity-60 transition-opacity duration-500 group-hover:opacity-100 group-hover:bg-secondary/40" />

          {/* Animated gradient ring on hover */}
          <div className="pointer-events-none absolute -inset-px rounded-[2rem] bg-[linear-gradient(135deg,hsl(var(--secondary)/0.7),hsl(var(--primary)/0.4)_60%,hsl(var(--secondary)/0.6))] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

          {/* Bubble body — glassmorphic cloud */}
          <div className="relative max-w-[170px] sm:max-w-[210px] lg:max-w-[240px] rounded-[2rem] border border-white/30 bg-white/85 px-4 py-3 sm:px-5 sm:py-3.5 shadow-[0_10px_40px_hsl(var(--background)/0.4)] backdrop-blur-md transition-all duration-500 group-hover:border-white/60 group-hover:bg-white group-hover:shadow-[0_18px_60px_hsl(var(--secondary)/0.35)]">
            <p className="text-[11px] sm:text-[13px] lg:text-[14px] font-bold leading-tight text-[hsl(220_50%_20%)] text-center">
              – {bubble.text}
            </p>
          </div>
        </motion.div>

        {/* Tail dots — point toward the brain */}
        <div className={`absolute ${tail.side}`}>
          <TailDots direction={tail.dir} delay={bubble.delay} />
        </div>
      </motion.div>
    </motion.div>
  );
};

export const ThoughtBubbles = () => {
  return (
    <div className="pointer-events-none absolute inset-0 z-[4]" aria-hidden>
      {bubbles.map((bubble, i) => (
        <ThoughtBubble key={i} bubble={bubble} index={i} />
      ))}
    </div>
  );
};

export default ThoughtBubbles;
