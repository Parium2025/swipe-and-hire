import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { audienceContent, type AudienceRole } from './content';
import { fadeUp, inView, stagger } from './motionPresets';

const AudienceProof = ({ role }: { role: AudienceRole }) => {
  const c = audienceContent[role];
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const glowY = useTransform(scrollYProgress, [0, 1], [80, -80]);
  const glowOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.3, 0.7, 0.3]);

  return (
    <section ref={ref} className="relative overflow-hidden px-5 py-24 sm:px-6 sm:py-32 md:px-12 lg:px-24">
      <motion.div
        aria-hidden
        style={{ y: glowY, opacity: glowOpacity }}
        className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary/15 blur-[160px]"
      />
      <div className="relative mx-auto max-w-[1180px] text-center">
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={inView}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary/70"
        >
          I siffror
        </motion.span>
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={inView}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="mx-auto mt-5 max-w-3xl text-4xl font-black leading-[1] tracking-[-0.025em] text-white sm:text-5xl md:text-6xl"
        >
          Snabbare. Smartare. Tydligare.
        </motion.h2>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inView}
          variants={stagger(0.12, 0.15)}
          className="mt-16 grid gap-6 sm:grid-cols-3"
        >
          {c.proof.map((p) => (
            <motion.div
              key={p.label}
              variants={fadeUp}
              className="rounded-3xl border border-white/10 bg-white/[0.035] p-8 backdrop-blur-xl"
            >
              <div className="text-5xl font-black tracking-tight text-white sm:text-6xl">{p.value}</div>
              <div className="mt-3 text-sm font-medium text-white/55">{p.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default AudienceProof;
