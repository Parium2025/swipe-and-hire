import { motion } from 'framer-motion';
import { audienceContent, type AudienceRole } from './content';
import { inView, slideRight } from './motionPresets';

const STATEMENT_EASE = [0.22, 1, 0.36, 1] as const;

const AudienceStatement = ({ role }: { role: AudienceRole }) => {
  const c = audienceContent[role].statement;
  const words = c.title.split(' ');

  return (
    <section className="relative overflow-hidden px-5 py-24 sm:px-6 sm:py-32 md:px-12 md:[@media_(orientation:portrait)]:flex md:[@media_(orientation:portrait)]:min-h-[88svh] md:[@media_(orientation:portrait)]:items-center md:[@media_(orientation:portrait)]:py-40 lg:px-24">
      <div className="mx-auto grid max-w-[1180px] gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-end md:[@media_(orientation:portrait)]:grid-cols-1 md:[@media_(orientation:portrait)]:place-items-center md:[@media_(orientation:portrait)]:gap-14 md:[@media_(orientation:portrait)]:text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inView}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
          }}
        >
          <motion.span
            variants={{
              hidden: { opacity: 0, y: 12 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: STATEMENT_EASE } },
            }}
            className="text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary/70"
          >
            {c.kicker}
          </motion.span>
          <h2 className="wave-text mt-5 max-w-2xl text-4xl font-black leading-[0.98] tracking-[0] sm:text-5xl md:text-6xl md:[@media_(orientation:portrait)]:mx-auto md:[@media_(orientation:portrait)]:max-w-[14ch] md:[@media_(orientation:portrait)]:text-[clamp(3.5rem,7vw,5.5rem)]">
            {words.map((w, i) => (
              <motion.span
                key={`${w}-${i}`}
                variants={{
                  hidden: { opacity: 0, y: '0.5em', filter: 'blur(8px)' },
                  visible: {
                    opacity: 1,
                    y: 0,
                    filter: 'blur(0px)',
                    transition: { duration: 0.85, ease: STATEMENT_EASE },
                  },
                }}
                className="mr-[0.25em] inline-block"
              >
                {w}
              </motion.span>
            ))}
          </h2>
        </motion.div>
        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={inView}
          variants={slideRight}
          className="wave-text max-w-xl text-base leading-8 opacity-75 sm:text-lg md:[@media_(orientation:portrait)]:mx-auto md:[@media_(orientation:portrait)]:max-w-[52ch] md:[@media_(orientation:portrait)]:text-xl md:[@media_(orientation:portrait)]:leading-9"
        >
          {c.body}
        </motion.p>
      </div>
    </section>
  );
};

export default AudienceStatement;
