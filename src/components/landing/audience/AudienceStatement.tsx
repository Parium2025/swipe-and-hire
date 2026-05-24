import { motion } from 'framer-motion';
import { audienceContent, type AudienceRole } from './content';
import { inView, slideLeft, slideRight } from './motionPresets';

const AudienceStatement = ({ role }: { role: AudienceRole }) => {
  const c = audienceContent[role].statement;
  return (
    <section className="relative overflow-hidden px-5 py-24 sm:px-6 sm:py-32 md:px-12 md:[@media_(orientation:portrait)]:flex md:[@media_(orientation:portrait)]:min-h-[88svh] md:[@media_(orientation:portrait)]:items-center md:[@media_(orientation:portrait)]:py-40 lg:px-24">
      <div className="mx-auto grid max-w-[1180px] gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-end md:[@media_(orientation:portrait)]:grid-cols-1 md:[@media_(orientation:portrait)]:place-items-center md:[@media_(orientation:portrait)]:gap-14 md:[@media_(orientation:portrait)]:text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inView}
          variants={slideLeft}
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary/70">
            {c.kicker}
          </span>
          <h2 className="mt-5 max-w-2xl text-4xl font-black leading-[0.98] tracking-[-0.025em] text-white sm:text-5xl md:text-6xl md:[@media_(orientation:portrait)]:mx-auto md:[@media_(orientation:portrait)]:max-w-[14ch] md:[@media_(orientation:portrait)]:text-[clamp(3.5rem,7vw,5.5rem)]">
            {c.title}
          </h2>
        </motion.div>
        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={inView}
          variants={slideRight}
          className="max-w-xl text-base leading-8 text-white/55 sm:text-lg md:[@media_(orientation:portrait)]:mx-auto md:[@media_(orientation:portrait)]:max-w-[52ch] md:[@media_(orientation:portrait)]:text-xl md:[@media_(orientation:portrait)]:leading-9"
        >
          {c.body}
        </motion.p>
      </div>
    </section>
  );
};

export default AudienceStatement;
