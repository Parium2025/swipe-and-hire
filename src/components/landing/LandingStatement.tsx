import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

const LandingStatement = () => {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 0.45, 1], [72, 0, -34]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.78, 1], [0, 1, 1, 0.35]);

  return (
    <section ref={ref} className="relative overflow-hidden px-5 py-24 sm:px-6 sm:py-32 md:px-12 lg:px-24">
      <motion.div style={{ y, opacity }} className="relative z-10 mx-auto max-w-[1150px] text-center">
        <p className="text-[2.4rem] font-black leading-[1.02] tracking-[-0.025em] text-white sm:text-[4rem] md:text-[5.6rem] lg:text-[6.6rem]">
          En tydlig väg från första intryck till rätt matchning.
        </p>
        <p className="mx-auto mt-8 max-w-3xl text-base leading-8 text-white/52 sm:text-lg">
          Byggd för människor som vill hitta varandra snabbare — med en upplevelse som känns lugn, premium och enkel från första klicket.
        </p>
      </motion.div>
    </section>
  );
};

export default LandingStatement;
