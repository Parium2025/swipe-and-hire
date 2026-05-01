import { motion, useReducedMotion } from 'framer-motion';

/**
 * ThoughtBubbles — six floating thought clouds positioned around the
 * 3D brain. Each bubble fades + scales in with a staggered delay, then
 * gently floats with a slow infinite loop to feel alive.
 *
 * Bubbles are positioned absolutely relative to the hero section so they
 * frame the brain (which sits centered in the middle of the hero).
 */

type Bubble = {
  text: string;
  /** Tailwind position classes (mobile first → desktop) */
  position: string;
  /** Delay (s) for the entrance animation */
  delay: number;
  /** Float duration (s) for the idle loop */
  floatDuration: number;
  /** Tail orientation: which corner the small dots descend from */
  tail: 'bl' | 'br';
  /** Hidden on small screens to avoid clutter */
  hideOnMobile?: boolean;
};

const bubbles: Bubble[] = [
  {
    text: 'Ska vi rekrytera en ny kollega?',
    position: 'left-[2%] top-[6%] sm:left-[4%] sm:top-[8%] lg:left-[6%] lg:top-[10%]',
    delay: 3.0,
    floatDuration: 7.5,
    tail: 'bl',
  },
  {
    text: 'Ska jag söka nytt jobb?',
    position: 'left-1/2 -translate-x-1/2 top-[2%] sm:top-[4%]',
    delay: 3.4,
    floatDuration: 8.5,
    tail: 'bl',
    hideOnMobile: true,
  },
  {
    text: 'Hur går vi tillväga för att rekrytera?',
    position: 'right-[2%] top-[6%] sm:right-[4%] sm:top-[8%] lg:right-[6%] lg:top-[10%]',
    delay: 3.2,
    floatDuration: 9,
    tail: 'br',
  },
  {
    text: 'Jag trivs inte där jag jobbar i dag.',
    position: 'left-[1%] bottom-[22%] sm:left-[3%] sm:bottom-[24%] lg:left-[5%] lg:bottom-[20%]',
    delay: 3.6,
    floatDuration: 8,
    tail: 'bl',
  },
  {
    text: 'Är det värt att anställa en till?',
    position: 'left-1/2 -translate-x-1/2 bottom-[18%] sm:bottom-[20%]',
    delay: 4.0,
    floatDuration: 7,
    tail: 'br',
    hideOnMobile: true,
  },
  {
    text: 'Det är jobbigt att söka jobb.',
    position: 'right-[1%] bottom-[22%] sm:right-[3%] sm:bottom-[24%] lg:right-[5%] lg:bottom-[20%]',
    delay: 3.8,
    floatDuration: 9.5,
    tail: 'br',
  },
];

const ThoughtBubble = ({ bubble, index }: { bubble: Bubble; index: number }) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={`pointer-events-none absolute z-[5] ${bubble.position} ${
        bubble.hideOnMobile ? 'hidden sm:block' : ''
      }`}
      initial={{ opacity: 0, scale: 0.4, y: 20, filter: 'blur(12px)' }}
      animate={{
        opacity: 1,
        scale: 1,
        y: 0,
        filter: 'blur(0px)',
      }}
      transition={{
        duration: 1.4,
        ease: [0.16, 1, 0.3, 1],
        delay: bubble.delay,
      }}
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
        {/* Soft outer glow */}
        <div className="absolute -inset-3 rounded-[2.5rem] bg-white/15 blur-2xl" />

        {/* Bubble body — glassmorphic cloud */}
        <div className="relative max-w-[160px] sm:max-w-[200px] lg:max-w-[240px] rounded-[2rem] border border-white/30 bg-white/85 px-4 py-3 sm:px-5 sm:py-3.5 shadow-[0_10px_40px_hsl(var(--background)/0.4)] backdrop-blur-md">
          <p className="text-[11px] sm:text-[13px] lg:text-[14px] font-bold leading-tight text-[hsl(220_50%_20%)] text-center">
            – {bubble.text}
          </p>
        </div>

        {/* Tail dots (descending circles) */}
        <div
          className={`absolute flex flex-col items-center gap-1 ${
            bubble.tail === 'bl' ? 'left-4 -bottom-5' : 'right-4 -bottom-5'
          }`}
        >
          <motion.div
            className="h-2 w-2 rounded-full border border-white/40 bg-white/80 shadow-[0_2px_6px_hsl(var(--background)/0.3)]"
            animate={prefersReducedMotion ? undefined : { scale: [1, 1.15, 1], opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: bubble.delay }}
          />
          <motion.div
            className="h-1.5 w-1.5 rounded-full border border-white/40 bg-white/70"
            animate={prefersReducedMotion ? undefined : { scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: bubble.delay + 0.2 }}
          />
          <motion.div
            className="h-1 w-1 rounded-full bg-white/60"
            animate={prefersReducedMotion ? undefined : { scale: [1, 1.25, 1], opacity: [0.55, 0.9, 0.55] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: bubble.delay + 0.4 }}
          />
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
