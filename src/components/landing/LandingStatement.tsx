import { motion } from 'framer-motion';

const ease = [0.22, 1, 0.36, 1] as const;

const LandingStatement = () => (
  <section className="relative py-24 sm:py-36 lg:py-48 px-5 sm:px-6 md:px-12 lg:px-24 overflow-hidden">
    {/* Flowing SVG decoration */}
    <div className="absolute inset-0 pointer-events-none opacity-[0.03]" aria-hidden="true">
      <svg className="w-full h-full" viewBox="0 0 800 600" fill="none" preserveAspectRatio="xMidYMid slice">
        <circle cx="400" cy="300" r="250" stroke="hsl(250 80% 70%)" strokeWidth="0.5" />
        <circle cx="400" cy="300" r="180" stroke="hsl(200 90% 70%)" strokeWidth="0.4" />
        <ellipse cx="400" cy="300" rx="350" ry="200" stroke="hsl(170 80% 60%)" strokeWidth="0.4" transform="rotate(15 400 300)" />
      </svg>
    </div>

    <div className="max-w-[1400px] mx-auto relative z-10">
      <motion.div
        className="text-center"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 1, ease }}
      >
        <motion.p
          className="text-[1.6rem] sm:text-[2.5rem] md:text-[3.5rem] lg:text-[4.5rem] font-black leading-[1.1] tracking-[-0.03em] text-white/90 uppercase"
          initial={{ y: 40 }}
          whileInView={{ y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease }}
        >
          <span className="italic text-white/25 line-through decoration-[hsl(250_80%_70%/0.4)] decoration-2">Omdefiniera</span>{' '}
          <span className="text-white">rekrytering,</span>
          <br />
          <span className="text-white/90">kämpa för </span>
          <span className="bg-gradient-to-r from-[hsl(250_80%_70%)] to-[hsl(200_90%_70%)] bg-clip-text text-transparent italic">matchningar</span>,
          <br />
          <span className="text-white/90">bygga en </span>
          <span className="bg-gradient-to-r from-[hsl(200_90%_70%)] to-[hsl(170_80%_60%)] bg-clip-text text-transparent italic">framtid</span>
          <br />
          <span className="text-white/30">i rekrytering — on &amp; off screen.</span>
        </motion.p>
      </motion.div>
    </div>
  </section>
);

export default LandingStatement;
