import { motion } from 'framer-motion';
import { audienceContent, type AudienceRole } from './content';
import { fadeUp, inView, slideLeft, slideRight, stagger } from './motionPresets';

const AudienceFeatures = ({ role }: { role: AudienceRole }) => {
  const c = audienceContent[role];
  return (
    <section className="relative overflow-hidden px-5 py-24 sm:px-6 sm:py-32 md:px-12 lg:px-24">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-14 grid gap-6 md:mb-20 md:grid-cols-[0.9fr_1.1fr] md:items-end">
          <motion.div initial="hidden" whileInView="visible" viewport={inView} variants={slideLeft}>
            <span className="inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary/70">
              <span className="h-px w-12 bg-gradient-to-r from-secondary to-transparent" />
              Funktioner
            </span>
            <h2 className="mt-5 text-4xl font-black tracking-[-0.025em] text-white sm:text-5xl md:text-6xl">
              Allt hänger ihop.
            </h2>
          </motion.div>
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={inView}
            variants={slideRight}
            className="max-w-2xl text-base leading-8 text-white/50"
          >
            Byggt för {role === 'job_seeker' ? 'dig som söker jobb' : 'dig som rekryterar'} — snabbt, mobilt och utan onödigt brus.
          </motion.p>
        </div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inView}
          variants={stagger(0.1)}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-5"
        >
          {c.features.map((f) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                variants={fadeUp}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] p-6 backdrop-blur-xl transition-colors duration-500 hover:border-secondary/30 hover:bg-white/[0.06]"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-secondary/25 bg-secondary/[0.08] text-secondary">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-white">{f.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/55">{f.description}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};

export default AudienceFeatures;
