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
    <section className="relative overflow-hidden px-5 pb-24 pt-28 sm:px-6 sm:pt-32 md:px-12 md:pb-32 lg:px-24">
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
        className="relative z-10 mx-auto grid min-h-[calc(100svh-8rem)] max-w-[1180px] grid-cols-1 items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]"
        initial="hidden"
        animate="visible"
        variants={stagger(0.18, 0.1)}
      >
        <div className="flex flex-col">
          <motion.span
            variants={fadeUp}
            className="text-xs font-bold uppercase tracking-[0.28em] text-secondary/80"
          >
            {c.eyebrow}
          </motion.span>

          <h1 className="mt-6 max-w-3xl text-[3.25rem] font-black leading-[0.94] tracking-[-0.03em] text-white sm:text-[5rem] lg:text-[6.25rem]">
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
            className="mt-7 max-w-xl text-base leading-8 text-white/65 sm:text-lg"
          >
            {c.hero.subtitle}
          </motion.p>

          <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onPointerDown={handleStart}
              className="group inline-flex min-h-touch items-center justify-center gap-3 rounded-full bg-secondary px-7 py-3.5 text-sm font-bold text-secondary-foreground shadow-[0_18px_55px_hsl(var(--secondary)/0.32)] transition-shadow hover:shadow-[0_22px_70px_hsl(var(--secondary)/0.45)]"
            >
              {c.hero.cta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </motion.div>
        </div>

        {/* Floating mockup placeholder card */}
        <motion.div
          variants={fadeUp}
          className="relative hidden lg:block"
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 6, ease: 'easeInOut', repeat: Infinity }}
            className="relative mx-auto aspect-[9/16] max-w-[340px] overflow-hidden rounded-[2.5rem] border border-white/12 bg-gradient-to-br from-white/[0.07] to-white/[0.02] shadow-[0_40px_120px_hsl(var(--background)/0.6)] backdrop-blur-2xl"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--secondary)/0.18),transparent_60%)]" />
            <div className="relative flex h-full flex-col gap-4 p-6">
              <div className="h-3 w-20 rounded-full bg-white/15" />
              <div className="h-6 w-40 rounded-full bg-white/25" />
              <div className="mt-4 flex-1 rounded-2xl border border-white/10 bg-white/[0.04]" />
              <div className="flex gap-2">
                <div className="h-11 flex-1 rounded-full bg-white/10" />
                <div className="h-11 flex-1 rounded-full bg-secondary/80" />
              </div>
            </div>
          </motion.div>
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
