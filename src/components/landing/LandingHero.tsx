import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin, Briefcase, Clock } from 'lucide-react';

const ease = [0.22, 1, 0.36, 1] as const;

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14, delayChildren: 0.2 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.9, ease } },
};

/* Fake job cards for the swipe mockup */
const mockCards = [
  { title: 'UX Designer', company: 'Spotify', location: 'Stockholm', type: 'Heltid', color: 'from-emerald-500 to-teal-600' },
  { title: 'Frontend Dev', company: 'Klarna', location: 'Göteborg', type: 'Hybrid', color: 'from-pink-500 to-rose-600' },
  { title: 'Product Manager', company: 'Parium', location: 'Malmö', type: 'Remote', color: 'from-violet-500 to-purple-600' },
];

const SwipeMockup = () => (
  <div className="relative w-[260px] h-[340px] sm:w-[280px] sm:h-[370px]">
    {mockCards.map((card, i) => {
      const isTop = i === 2;
      const offset = (2 - i) * 8;
      const scale = 1 - (2 - i) * 0.04;
      return (
        <motion.div
          key={card.title}
          className="absolute inset-0 rounded-3xl border border-white/[0.1] bg-white/[0.04] backdrop-blur-xl overflow-hidden shadow-2xl"
          style={{ zIndex: i }}
          initial={isTop ? { x: 120, rotate: 8, opacity: 0 } : { y: offset, scale }}
          animate={
            isTop
              ? { x: 0, rotate: 0, opacity: 1, y: 0, scale: 1, transition: { duration: 1.2, ease, delay: 0.8 } }
              : { y: offset, scale, transition: { duration: 0.6, ease } }
          }
        >
          {/* Gradient header */}
          <div className={`h-28 sm:h-32 bg-gradient-to-br ${card.color} flex items-end p-5`}>
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm" />
          </div>
          <div className="p-5 space-y-3">
            <div>
              <h4 className="text-white font-semibold text-base tracking-tight">{card.title}</h4>
              <p className="text-white/50 text-sm">{card.company}</p>
            </div>
            <div className="flex items-center gap-3 text-white/40 text-xs">
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{card.location}</span>
              <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{card.type}</span>
            </div>
            {isTop && (
              <div className="flex gap-2 pt-2">
                <div className="flex-1 h-9 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-white/40 text-xs font-medium">
                  Skippa
                </div>
                <div className="flex-1 h-9 rounded-full bg-secondary/20 border border-secondary/30 flex items-center justify-center text-secondary text-xs font-semibold">
                  Ansök ✦
                </div>
              </div>
            )}
          </div>
        </motion.div>
      );
    })}

    {/* Swipe gesture indicator */}
    <motion.div
      className="absolute -right-3 top-1/2 -translate-y-1/2 z-20"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: [0, 0.6, 0], x: [-10, 16, 30] }}
      transition={{ duration: 2, delay: 2, repeat: Infinity, repeatDelay: 3 }}
    >
      <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
        <ArrowRight className="w-4 h-4 text-white/60" />
      </div>
    </motion.div>
  </div>
);

const LandingHero = () => {
  const navigate = useNavigate();

  const goTo = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register' } });
  };

  return (
    <section
      className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden pt-20 pb-16 sm:pb-24"
      aria-label="Parium – Rekrytering på 60 sekunder"
    >
      {/* Subtle gradient orbs */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-[hsl(250_60%_50%/0.08)] rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[hsl(200_80%_50%/0.06)] rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-6 md:px-12 w-full">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          {/* Left: Copy */}
          <motion.div
            className="flex-1 text-center lg:text-left space-y-6 sm:space-y-8"
            variants={stagger}
            initial="hidden"
            animate="show"
          >
            {/* Badge */}
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.1] text-[11px] font-medium text-white/50 tracking-widest uppercase">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
                </span>
                Early access öppen
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={fadeUp}
              className="text-[2.5rem] leading-[1.05] sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-[-0.04em] text-white"
            >
              Rekrytering.
              <br />
              <span className="bg-gradient-to-r from-[hsl(250_80%_70%)] via-[hsl(200_90%_70%)] to-[hsl(170_80%_60%)] bg-clip-text text-transparent">
                På 60 sekunder.
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              variants={fadeUp}
              className="text-lg sm:text-xl text-white/40 max-w-md mx-auto lg:mx-0 leading-relaxed font-medium"
            >
              Swipe. Matcha. Anställ.
            </motion.p>

            {/* CTA */}
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <button
                onClick={goTo}
                className="group flex items-center justify-center gap-2.5 px-8 py-4 rounded-full bg-white text-[hsl(220_40%_13%)] font-semibold text-base
                  shadow-[0_0_80px_rgba(255,255,255,0.08)] hover:shadow-[0_0_100px_rgba(255,255,255,0.15)] active:scale-[0.97]
                  transition-all duration-300 min-h-[52px]"
              >
                Kom igång gratis
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-300" />
              </button>
              <button
                onClick={() => {
                  const el = document.getElementById('hur-det-fungerar');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-white/[0.04] border border-white/[0.1] text-white/70 font-medium text-base
                  hover:bg-white/[0.08] hover:border-white/[0.2] active:scale-[0.97]
                  transition-all duration-300 min-h-[52px]"
              >
                Se hur det fungerar
              </button>
            </motion.div>

            {/* Micro social proof */}
            <motion.p variants={fadeUp} className="text-white/25 text-sm">
              Gratis under beta · Ingen kreditkort krävs
            </motion.p>
          </motion.div>

          {/* Right: Swipe mockup */}
          <motion.div
            className="flex-shrink-0 relative"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease, delay: 0.4 }}
          >
            <SwipeMockup />
            {/* Glow behind mockup */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[hsl(250_60%_50%/0.12)] rounded-full blur-[100px] pointer-events-none -z-10" />
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 hidden sm:block"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5, duration: 1 }}
      >
        <motion.div
          className="w-6 h-10 rounded-full border-2 border-white/15 flex justify-center pt-2"
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="w-1 h-2 rounded-full bg-white/30" />
        </motion.div>
      </motion.div>
    </section>
  );
};

export default LandingHero;
