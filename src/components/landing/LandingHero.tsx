import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { ArrowRight, MapPin, Clock, Heart } from 'lucide-react';
import { useState, useCallback } from 'react';

const ease = [0.22, 1, 0.36, 1] as const;

/* ── Decorative flowing SVG curves (like landonorris.com) ── */
const FlowingLines = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <svg
      className="absolute w-[200%] h-[200%] top-[-50%] left-[-50%] opacity-[0.04]"
      viewBox="0 0 1200 1200"
      fill="none"
    >
      <motion.circle
        cx="600" cy="600" r="300"
        stroke="url(#grad1)" strokeWidth="0.8"
        initial={{ pathLength: 0, rotate: 0 }}
        animate={{ pathLength: 1, rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
      />
      <motion.circle
        cx="600" cy="600" r="450"
        stroke="url(#grad1)" strokeWidth="0.5"
        initial={{ pathLength: 0, rotate: 0 }}
        animate={{ pathLength: 1, rotate: -360 }}
        transition={{ duration: 50, repeat: Infinity, ease: 'linear' }}
      />
      <motion.ellipse
        cx="600" cy="600" rx="550" ry="350"
        stroke="url(#grad2)" strokeWidth="0.6"
        initial={{ rotate: -20 }}
        animate={{ rotate: 340 }}
        transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
      />
      <motion.path
        d="M100,600 Q400,200 600,600 T1100,600"
        stroke="url(#grad2)" strokeWidth="0.7"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 4, ease }}
      />
      <motion.path
        d="M200,300 Q600,100 1000,400 Q800,800 300,900"
        stroke="url(#grad1)" strokeWidth="0.5"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 5, delay: 0.5, ease }}
      />
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(250 80% 70%)" />
          <stop offset="100%" stopColor="hsl(200 90% 70%)" />
        </linearGradient>
        <linearGradient id="grad2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(170 80% 60%)" />
          <stop offset="100%" stopColor="hsl(250 80% 70%)" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

/* ── Mini swipe card for the phone mockup ── */
const demoJobs = [
  { title: 'Frontend Developer', company: 'TechCorp AB', location: 'Stockholm', type: 'Heltid', color: 'from-indigo-600 to-purple-700' },
  { title: 'UX Designer', company: 'Design Studio', location: 'Göteborg', type: 'Heltid', color: 'from-emerald-600 to-teal-700' },
  { title: 'Product Manager', company: 'StartUp Co', location: 'Malmö', type: 'Heltid', color: 'from-orange-500 to-rose-600' },
];

const PhoneMockup = () => {
  const [currentCard, setCurrentCard] = useState(0);
  const [liked, setLiked] = useState(0);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-15, 0, 15]);
  const likeOpacity = useTransform(x, [0, 80], [0, 1]);
  const nopeOpacity = useTransform(x, [-80, 0], [1, 0]);

  const handleDragEnd = useCallback((_: any, info: any) => {
    if (Math.abs(info.offset.x) > 80) {
      const dir = info.offset.x > 0 ? 1 : -1;
      animate(x, dir * 400, { type: 'spring', stiffness: 500, damping: 30 });
      if (dir > 0) setLiked(p => p + 1);
      setTimeout(() => {
        x.set(0);
        setCurrentCard(p => (p + 1) % demoJobs.length);
      }, 300);
    } else {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 25 });
    }
  }, [x]);

  const job = demoJobs[currentCard];
  const nextJob = demoJobs[(currentCard + 1) % demoJobs.length];

  return (
    <motion.div
      className="relative w-[260px] h-[460px] sm:w-[280px] sm:h-[500px]"
      initial={{ opacity: 0, y: 40, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 1.2, delay: 0.6, ease }}
    >
      {/* Phone frame */}
      <div className="absolute inset-0 rounded-[2.5rem] bg-[hsl(220_20%_8%)] border border-white/[0.08] shadow-[0_0_80px_rgba(139,92,246,0.15),0_0_160px_rgba(139,92,246,0.05)] overflow-hidden">
        {/* Status bar */}
        <div className="flex justify-between items-center px-6 pt-3 pb-2">
          <span className="text-[9px] text-white/30 font-medium">9:41</span>
          <div className="flex gap-1">
            <div className="w-3 h-1.5 rounded-sm bg-white/20" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
          </div>
        </div>

        {/* Card area */}
        <div className="relative mx-3 h-[320px] sm:h-[360px]">
          {/* Background card */}
          <div className={`absolute inset-1 rounded-2xl bg-gradient-to-br ${nextJob.color} opacity-40 scale-[0.92]`} />

          {/* Active card */}
          <motion.div
            className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${job.color} cursor-grab active:cursor-grabbing overflow-hidden shadow-2xl`}
            style={{ x, rotate }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.9}
            onDragEnd={handleDragEnd}
          >
            {/* LIKE stamp */}
            <motion.div
              className="absolute top-4 left-4 z-20 border-2 border-green-400 rounded-lg px-3 py-0.5 -rotate-12"
              style={{ opacity: likeOpacity }}
            >
              <span className="text-green-400 text-sm font-black">SÖK!</span>
            </motion.div>
            {/* NOPE stamp */}
            <motion.div
              className="absolute top-4 right-4 z-20 border-2 border-red-400 rounded-lg px-3 py-0.5 rotate-12"
              style={{ opacity: nopeOpacity }}
            >
              <span className="text-red-400 text-xs font-black">NOPE</span>
            </motion.div>

            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <p className="text-white/70 text-xs font-medium">{job.company}</p>
              <h3 className="text-white text-lg font-bold leading-tight mt-0.5">{job.title}</h3>
              <div className="flex gap-3 mt-2">
                <span className="flex items-center gap-1 text-white/60 text-[10px]">
                  <MapPin className="w-3 h-3" />{job.location}
                </span>
                <span className="flex items-center gap-1 text-white/60 text-[10px]">
                  <Clock className="w-3 h-3" />{job.type}
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-center gap-2 mt-3 px-4">
          <div className="flex items-center gap-1.5 px-4 py-1.5 bg-white/[0.06] rounded-full border border-white/[0.08]">
            <Heart className="w-3.5 h-3.5 text-[hsl(250_80%_70%)] fill-[hsl(250_80%_70%)]" />
            <span className="text-white/70 text-xs font-semibold">{liked}</span>
          </div>
        </div>
      </div>

      {/* Glow behind phone */}
      <div className="absolute -inset-10 bg-[hsl(250_80%_50%/0.08)] rounded-full blur-[80px] -z-10" />
    </motion.div>
  );
};

const LandingHero = () => {
  const navigate = useNavigate();

  const goTo = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register' } });
  };

  return (
    <section className="relative min-h-[100dvh] flex flex-col justify-center overflow-hidden pt-20 pb-8">
      <FlowingLines />

      {/* Subtle gradient orbs */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-[hsl(250_70%_40%/0.08)] rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-[hsl(200_80%_45%/0.05)] rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-5 sm:px-6 md:px-12 w-full">
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
          {/* Left — text content */}
          <div className="flex-1 space-y-6">
            {/* Top label */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease }}
            >
              <span className="inline-flex items-center gap-3 text-[10px] sm:text-[11px] font-semibold tracking-[0.3em] uppercase text-white/30">
                <span className="w-8 sm:w-12 h-px bg-gradient-to-r from-[hsl(250_80%_70%)] to-transparent" />
                Framtidens rekrytering
              </span>
            </motion.div>

            {/* Giant headline */}
            <div className="overflow-hidden">
              <motion.h1
                className="text-[2.8rem] leading-[0.88] sm:text-[4rem] md:text-[5.5rem] lg:text-[6.5rem] font-black tracking-[-0.05em] text-white uppercase"
                initial={{ y: '110%' }}
                animate={{ y: 0 }}
                transition={{ duration: 1.2, ease, delay: 0.3 }}
              >
                Rekry
                <span className="bg-gradient-to-r from-[hsl(250_80%_70%)] via-[hsl(200_90%_70%)] to-[hsl(170_80%_60%)] bg-clip-text text-transparent">
                  tering
                </span>
              </motion.h1>
            </div>

            <div className="overflow-hidden">
              <motion.h2
                className="text-[1.8rem] leading-[0.9] sm:text-[2.5rem] md:text-[3.5rem] font-black tracking-[-0.04em] text-white/15 uppercase flex items-center gap-4"
                initial={{ y: '110%' }}
                animate={{ y: 0 }}
                transition={{ duration: 1.2, ease, delay: 0.45 }}
              >
                På 60 sek
                <motion.div
                  className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-[hsl(250_80%_70%)] flex-shrink-0"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5, delay: 1.2, ease }}
                />
              </motion.h2>
            </div>

            {/* Subline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8, ease }}
            >
              <p className="text-white/30 text-sm sm:text-base leading-relaxed font-medium max-w-md">
                Swipe. Matcha. Anställ.
                <br />
                <span className="text-white/15">
                  Rekrytering som känns lika enkelt som att scrolla sociala medier.
                </span>
              </p>
            </motion.div>

            {/* CTA */}
            <motion.div
              className="flex flex-col gap-3 pt-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.0, ease }}
            >
              <button
                onClick={goTo}
                className="group flex items-center gap-3 px-7 py-3.5 rounded-full bg-white text-[hsl(220_40%_10%)] font-semibold text-sm w-fit
                  hover:shadow-[0_0_80px_rgba(255,255,255,0.1)] active:scale-[0.97] transition-all duration-300"
              >
                Kom igång gratis
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <span className="text-white/15 text-[10px] sm:text-xs tracking-wide">
                Ingen kreditkort · Gratis under beta
              </span>
            </motion.div>
          </div>

          {/* Right — Phone mockup with interactive swipe */}
          <div className="flex-shrink-0 relative">
            <PhoneMockup />
          </div>
        </div>
      </div>

      {/* Bottom edge line */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.5, delay: 1.2, ease }}
      />
    </section>
  );
};

export default LandingHero;
