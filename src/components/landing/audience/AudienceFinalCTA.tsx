import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { audienceContent, type AudienceRole } from './content';
import { fadeUp, inView, stagger } from './motionPresets';

const AudienceFinalCTA = ({ role }: { role: AudienceRole }) => {
  const navigate = useNavigate();
  const c = audienceContent[role].finalCta;

  const handleStart = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register', role } });
  };

  return (
    <section className="relative overflow-hidden px-5 pb-32 pt-24 sm:px-6 sm:pt-32 md:px-12 lg:px-24">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -z-0 h-[400px] -translate-y-1/2 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--secondary)/0.18),transparent_70%)]" />
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={inView}
        variants={stagger(0.15, 0.05)}
        className="relative mx-auto max-w-[920px] overflow-hidden rounded-[2.5rem] border border-white/12 bg-white/[0.04] p-10 text-center backdrop-blur-2xl sm:p-16"
      >
        <motion.h2
          variants={fadeUp}
          className="mx-auto max-w-2xl text-4xl font-black leading-[1.02] tracking-[-0.025em] text-white sm:text-5xl md:text-6xl"
        >
          {c.title}
        </motion.h2>
        <motion.p variants={fadeUp} className="mx-auto mt-6 max-w-xl text-base leading-8 text-white/60 sm:text-lg">
          {c.body}
        </motion.p>
        <motion.div variants={fadeUp} className="mt-10 flex justify-center">
          <button
            type="button"
            onPointerDown={handleStart}
            className="group inline-flex min-h-touch items-center justify-center gap-3 rounded-full bg-secondary px-8 py-4 text-sm font-bold text-secondary-foreground shadow-[0_22px_70px_hsl(var(--secondary)/0.36)] transition-shadow hover:shadow-[0_28px_90px_hsl(var(--secondary)/0.5)]"
          >
            {c.cta}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default AudienceFinalCTA;
