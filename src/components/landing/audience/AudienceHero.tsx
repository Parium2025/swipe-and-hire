import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { audienceContent, type AudienceRole } from './content';
import { fadeUp, premiumEase, stagger } from './motionPresets';

const AudienceHero = ({ role }: { role: AudienceRole }) => {
  const navigate = useNavigate();
  const c = audienceContent[role];

  const handleStart = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register', role } });
  };

  return (
    <section className="relative overflow-hidden px-5 sm:px-6 md:px-12 lg:px-24">
      {/* Subtle floating glow */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-[-10%] h-[520px] w-[520px] rounded-full bg-secondary/15 blur-[140px]"
        animate={{ y: [0, -24, 0], opacity: [0.45, 0.7, 0.45] }}
        transition={{ duration: 8, ease: 'easeInOut', repeat: Infinity }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute bottom-[-15%] left-[-10%] h-[420px] w-[420px] rounded-full bg-primary-glow/20 blur-[120px]"
        animate={{ y: [0, 18, 0], opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 10, ease: 'easeInOut', repeat: Infinity, delay: 1 }}
      />

      <motion.div
        className="relative z-10 mx-auto flex min-h-[calc(100svh-8rem)] max-w-[1180px] flex-col items-center justify-center text-center"
        initial="hidden"
        animate="visible"
        variants={stagger(0.18, 0.1)}
      >
        <motion.span
          variants={fadeUp}
          className="text-xs font-bold uppercase tracking-[0.28em] text-secondary/80"
        >
          {c.eyebrow}
        </motion.span>

        <h1 className="mt-6 max-w-4xl text-[3.25rem] font-black leading-[0.94] tracking-[-0.03em] text-white sm:text-[5rem] lg:text-[6.25rem]">
          {c.hero.headline.map((line, i) => (
            <motion.span
              key={i}
              variants={fadeUp}
              className="block"
            >
              {line}
            </motion.span>
          ))}
        </h1>

        <motion.p
          variants={fadeUp}
          className="mt-7 max-w-xl text-base leading-8 text-white sm:text-lg"
        >
          {c.hero.subtitle}
        </motion.p>

        <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onPointerDown={handleStart}
            className="group inline-flex min-h-touch items-center justify-center gap-3 rounded-full border border-white/20 bg-white/10 px-7 py-3.5 text-sm font-bold text-white backdrop-blur-xl shadow-[0_18px_55px_hsl(var(--background)/0.4)] transition-all hover:bg-white/15 hover:shadow-[0_22px_70px_hsl(var(--background)/0.5)]"
          >
            {c.hero.cta}
            <ArrowRight className="h-4 w-4 text-white transition-transform group-hover:translate-x-1" />
          </button>
        </motion.div>
      </motion.div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 0.6, y: 0 }}
        transition={{ delay: 1.6, duration: 0.8, ease: premiumEase }}
        className="pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-[11px] font-medium uppercase tracking-[0.3em] text-white/55"
      >
        Scrolla
      </motion.div>
    </section>
  );
};

export default AudienceHero;
