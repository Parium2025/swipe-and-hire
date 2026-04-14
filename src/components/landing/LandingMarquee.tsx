import { motion } from 'framer-motion';

const items = ['SWIPE', 'MATCHA', 'ANSTÄLL', 'AI-DRIVEN', 'MOBILE-FIRST', 'GDPR-SÄKER', '60 SEK'];

const LandingMarquee = () => (
  <section className="relative py-6 sm:py-8 overflow-hidden border-y border-white/[0.03]" aria-hidden="true">
    <div className="flex whitespace-nowrap">
      {[0, 1].map((loop) => (
        <motion.div
          key={loop}
          className="flex items-center gap-6 sm:gap-10 shrink-0 pr-6 sm:pr-10"
          animate={{ x: '-100%' }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        >
          {items.map((item, i) => (
            <span key={`${loop}-${i}`} className="flex items-center gap-6 sm:gap-10">
              <span className="text-[1.5rem] sm:text-[2rem] md:text-[2.8rem] font-black tracking-[-0.04em] text-white/[0.04] uppercase select-none">
                {item}
              </span>
              <span className="w-2 h-2 rounded-full bg-[hsl(250_80%_70%/0.2)] flex-shrink-0" />
            </span>
          ))}
        </motion.div>
      ))}
    </div>
  </section>
);

export default LandingMarquee;
