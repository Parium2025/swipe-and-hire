import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useRef } from 'react';

const ease = [0.22, 1, 0.36, 1] as const;

const LandingCTA = () => {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 0.4], [80, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.25], [0, 1]);

  const handleStart = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register' } });
  };

  return (
    <section ref={sectionRef} className="relative overflow-hidden px-5 py-28 sm:px-6 sm:py-36 md:px-12 lg:px-24" aria-label="Kom igång">
      <motion.div style={{ y, opacity }} className="relative z-10 mx-auto max-w-[1100px] text-center">
        <h2 className="text-[2.8rem] font-black leading-[0.98] tracking-[-0.03em] text-white sm:text-[4.5rem] md:text-[6.2rem]">
          Börja med en bättre matchning.
        </h2>
        <p className="mx-auto mt-7 max-w-2xl text-base leading-8 text-white/55 sm:text-lg">
          Skapa konto gratis och upplev ett renare, snabbare sätt att mötas kring jobb.
        </p>
        <motion.button
          type="button"
          onPointerDown={handleStart}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ ease }}
          className="group mt-10 inline-flex min-h-touch items-center justify-center gap-3 rounded-full bg-secondary px-8 py-3.5 text-sm font-bold text-secondary-foreground shadow-[0_18px_55px_hsl(var(--secondary)/0.28)] transition-shadow hover:shadow-[0_22px_70px_hsl(var(--secondary)/0.36)]"
        >
          Kom igång gratis
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </motion.button>
      </motion.div>
    </section>
  );
};

export default LandingCTA;
