import { motion, useReducedMotion } from 'framer-motion';
import { createElement, type ElementType } from 'react';

type Props = {
  text: string;
  as?: ElementType;
  className?: string;
  /** Visuellt lättare slut-ord (t.ex. "nu.") för Apple-känsla */
  emphasizeLast?: boolean;
  /** Trigger-tröskel för IntersectionObserver */
  amount?: number;
  /** Stagger-delay per ord */
  stagger?: number;
  /** Start-delay innan första ordet rör sig */
  delay?: number;
};

/**
 * SplitHeadline — delar upp en rubrik i ord och fade-up:ar varje ord med stagger.
 * Premium "wow"-känsla à la Apple/Linear. Använd ENBART på rubriker som inte är
 * en del av wave-text-systemet, eftersom per-ord-transforms krockar med wave-klippet.
 */
const SplitHeadline = ({
  text,
  as = 'h2',
  className,
  emphasizeLast = false,
  amount = 0.55,
  stagger = 0.08,
  delay = 0.05,
}: Props) => {
  const reduce = useReducedMotion();
  const words = text.split(/\s+/).filter(Boolean);
  const lastIdx = words.length - 1;

  const container = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reduce ? 0 : stagger,
        delayChildren: reduce ? 0 : delay,
      },
    },
  };

  const word = {
    hidden: reduce
      ? { opacity: 1, y: 0 }
      : { opacity: 0, y: '0.6em', filter: 'blur(8px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] as const },
    },
  };

  return createElement(
    motion[as as 'h2'] ?? motion.h2,
    {
      className,
      variants: container,
      initial: 'hidden',
      whileInView: 'visible',
      viewport: { once: true, amount },
      'aria-label': text,
    },
    words.map((w, i) => (
      <span
        key={`${w}-${i}`}
        aria-hidden
        className="inline-block overflow-hidden align-baseline pb-[0.08em]"
        style={{ marginRight: i === lastIdx ? 0 : '0.28em' }}
      >
        <motion.span
          variants={word}
          className={`inline-block ${
            emphasizeLast && i === lastIdx ? 'font-light italic opacity-90' : ''
          }`}
        >
          {w}
        </motion.span>
      </span>
    )),
  );
};

export default SplitHeadline;
