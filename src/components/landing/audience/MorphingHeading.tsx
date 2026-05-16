import { motion } from 'framer-motion';

/**
 * MorphingHeading
 * ---------------
 * Premium text-reveal för "Parium" rubriken i intro-sektionen.
 *
 * Effekter:
 *  • Per-letter stagger med klipp/mask (bokstäverna "stiger upp" från baseline)
 *  • Gradient-fill i brand-blå (samma som scrollbaren på 3:an)
 *  • Loopande shimmer/sheen som glider över texten
 *  • Subtil glow bakom hela ordet
 *
 * Ingen extern dependency utöver framer-motion (redan i projektet).
 */

const TEXT = 'Parium';

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

const letterVariants = {
  hidden: { y: '110%', opacity: 0 },
  visible: {
    y: '0%',
    opacity: 1,
    transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export const MorphingHeading = () => {
  return (
    <div className="relative mx-auto w-full max-w-3xl text-center">
      {/* Soft glow bakom rubriken */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 mx-auto blur-3xl"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 50%, hsl(var(--secondary) / 0.35) 0%, transparent 70%)',
        }}
      />

      <motion.h2
        aria-label={TEXT}
        className="morphing-heading select-none font-sans"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {TEXT.split('').map((ch, i) => (
          <span key={i} className="morphing-heading__slot" aria-hidden="true">
            <motion.span className="morphing-heading__letter" variants={letterVariants}>
              {ch}
            </motion.span>
          </span>
        ))}
      </motion.h2>

      <style>{`
        .morphing-heading {
          display: flex;
          justify-content: center;
          align-items: baseline;
          gap: 0.02em;
          margin: 0;
          font-weight: 900;
          font-size: clamp(3.5rem, 11vw, 8.5rem);
          line-height: 1;
          letter-spacing: -0.04em;
          background: linear-gradient(
            92deg,
            hsl(var(--secondary)) 0%,
            #9bd3ff 45%,
            #ffffff 50%,
            #9bd3ff 55%,
            hsl(var(--secondary)) 100%
          );
          background-size: 220% 100%;
          background-position: 100% 0;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
          animation: morphing-heading-sheen 5.5s cubic-bezier(0.45, 0.05, 0.55, 0.95) 1.6s infinite;
          filter: drop-shadow(0 6px 28px hsl(var(--secondary) / 0.35));
        }

        .morphing-heading__slot {
          display: inline-flex;
          overflow: hidden;
          line-height: 1;
          padding-bottom: 0.1em;
        }

        .morphing-heading__letter {
          display: inline-block;
          will-change: transform, opacity;
        }

        @keyframes morphing-heading-sheen {
          0%   { background-position: 100% 0; }
          55%  { background-position: -20% 0; }
          100% { background-position: -20% 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .morphing-heading { animation: none; }
        }
      `}</style>
    </div>
  );
};

export default MorphingHeading;
