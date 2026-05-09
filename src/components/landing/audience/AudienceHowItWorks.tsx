import { motion } from 'framer-motion';
import { audienceContent, type AudienceRole } from './content';
import { fadeUp, inView, slideLeft, stagger } from './motionPresets';

const AudienceHowItWorks = ({ role }: { role: AudienceRole }) => {
  const c = audienceContent[role];
  return (
    <section className="relative overflow-hidden px-5 py-24 sm:px-6 sm:py-32 md:px-12 lg:px-24">
      <div className="mx-auto grid max-w-[1180px] gap-12 md:grid-cols-[0.9fr_1.1fr] md:gap-16">
        {/* Sticky left */}
        <div className="md:sticky md:top-28 md:self-start">
          <motion.div initial="hidden" whileInView="visible" viewport={inView} variants={slideLeft}>
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary/70">
              Så fungerar det
            </span>
            <h2 className="mt-5 text-4xl font-black leading-[0.98] tracking-[-0.025em] text-white sm:text-5xl md:text-6xl">
              {role === 'job_seeker' ? 'Från profil till jobb.' : 'Från roll till anställd.'}
            </h2>
            <p className="mt-6 max-w-md text-base leading-8 text-white/55 sm:text-lg">
              Fyra enkla steg. Ingen byråkrati. Bara det som faktiskt för dig framåt.
            </p>
          </motion.div>
        </div>

        {/* Right scroll cards */}
        <motion.ol
          initial="hidden"
          whileInView="visible"
          viewport={inView}
          variants={stagger(0.14, 0.05)}
          className="flex flex-col gap-5"
        >
          {c.steps.map((step, i) => (
            <motion.li
              key={step.title}
              variants={fadeUp}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] p-7 backdrop-blur-xl transition-colors duration-500 hover:border-secondary/30 hover:bg-white/[0.06] sm:p-8"
            >
              <div className="flex items-start gap-5">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-secondary/25 bg-secondary/[0.08] text-base font-black text-secondary">
                  0{i + 1}
                </span>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white sm:text-2xl">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-white/55 sm:text-base">
                    {step.description}
                  </p>
                </div>
              </div>
              <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-secondary/30 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
};

export default AudienceHowItWorks;
