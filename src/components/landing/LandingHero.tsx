import { useNavigate } from 'react-router-dom';
import {
  motion,
  useMotionValue,
  useTransform,
  useScroll,
  animate,
} from 'framer-motion';
import { ArrowRight, MapPin, Clock, Heart, Check } from 'lucide-react';
import { useState, useCallback, useRef, useEffect } from 'react';

const ease = [0.22, 1, 0.36, 1] as const;

/* ─── Aurora mesh — cinematic flowing gradient ─── */
const AuroraMesh = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div
      className="absolute w-[600px] h-[600px] md:w-[900px] md:h-[900px] rounded-full animate-landing-aurora"
      style={{
        background: 'radial-gradient(circle, hsl(200 100% 60% / 0.25) 0%, hsl(200 100% 50% / 0.08) 40%, transparent 70%)',
        top: '-20%', left: '-15%', filter: 'blur(80px)', willChange: 'transform',
      }}
    />
    <div
      className="absolute w-[500px] h-[500px] md:w-[700px] md:h-[700px] rounded-full animate-landing-aurora-2"
      style={{
        background: 'radial-gradient(circle, hsl(210 100% 50% / 0.2) 0%, hsl(220 100% 40% / 0.06) 45%, transparent 70%)',
        bottom: '-10%', right: '-10%', filter: 'blur(90px)', willChange: 'transform',
      }}
    />
    <div
      className="absolute w-[350px] h-[350px] md:w-[500px] md:h-[500px] rounded-full animate-landing-aurora-3"
      style={{
        background: 'radial-gradient(circle, hsl(190 100% 55% / 0.18) 0%, transparent 60%)',
        top: '30%', left: '50%', transform: 'translateX(-50%)', filter: 'blur(70px)', willChange: 'transform',
      }}
    />

    {/* Streaks */}
    <div className="absolute w-[2px] h-[300px] md:h-[500px] animate-landing-streak opacity-[0.08]"
      style={{ background: 'linear-gradient(to bottom, transparent, hsl(200 100% 70%), transparent)', top: 0, left: '30%', filter: 'blur(1px)' }} />
    <div className="absolute w-[1px] h-[250px] md:h-[400px] animate-landing-streak opacity-[0.06]"
      style={{ background: 'linear-gradient(to bottom, transparent, hsl(190 100% 60%), transparent)', top: '10%', left: '60%', filter: 'blur(1px)', animationDelay: '2s' }} />

    {/* Scanline */}
    <div className="absolute w-full h-[1px] animate-landing-scanline opacity-[0.07]"
      style={{ background: 'linear-gradient(90deg, transparent 10%, hsl(200 100% 60% / 0.4) 50%, transparent 90%)', top: 0, left: 0 }} />

    {/* Grid */}
    <div className="absolute inset-0 opacity-[0.02]"
      style={{ backgroundImage: 'linear-gradient(hsl(200 100% 60% / 0.4) 1px, transparent 1px), linear-gradient(90deg, hsl(200 100% 60% / 0.4) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

    {/* SVG rings */}
    <svg className="absolute w-full h-full opacity-[0.04]" viewBox="0 0 1200 800" fill="none" preserveAspectRatio="xMidYMid slice">
      <circle cx="600" cy="400" r="280" stroke="hsl(200 100% 60%)" strokeWidth="0.6" className="animate-landing-draw" />
      <circle cx="600" cy="400" r="200" stroke="hsl(190 100% 55%)" strokeWidth="0.3" className="animate-landing-draw" style={{ animationDelay: '0.5s' }} />
    </svg>
  </div>
);

/* ─── Word reveal ─── */
const WordReveal = ({ words, className, delay = 0 }: { words: string[]; className?: string; delay?: number }) => (
  <span className={`inline-flex flex-wrap gap-x-[0.3em] overflow-hidden ${className ?? ''}`}>
    {words.map((word, i) => (
      <motion.span key={i} className="inline-block"
        initial={{ y: '110%', opacity: 0 }}
        animate={{ y: '0%', opacity: 1 }}
        transition={{ duration: 0.7, delay: delay + i * 0.1, ease }}
      >{word}</motion.span>
    ))}
  </span>
);

/* ─── Demo jobs for the phone ─── */
const demoJobs = [
  { title: 'Frontend Developer', company: 'TechCorp AB', location: 'Stockholm', type: 'Heltid', gradient: 'from-secondary to-primary' },
  { title: 'UX Designer', company: 'Design Studio', location: 'Göteborg', type: 'Heltid', gradient: 'from-[hsl(190_90%_45%)] to-primary' },
  { title: 'Product Manager', company: 'StartUp Co', location: 'Malmö', type: 'Heltid', gradient: 'from-[hsl(210_80%_50%)] to-primary' },
];

/* ─── Phone mockup with AUTO-SWIPE + scroll-driven 3D ─── */
const PhoneMockup = ({ scrollYProgress }: { scrollYProgress: any }) => {
  const [currentCard, setCurrentCard] = useState(0);
  const [liked, setLiked] = useState(0);
  const [isAutoSwiping, setIsAutoSwiping] = useState(false);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-12, 0, 12]);
  const likeOpacity = useTransform(x, [0, 80], [0, 1]);
  const nopeOpacity = useTransform(x, [-80, 0], [1, 0]);

  // 3D scroll-driven transforms
  const phoneY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const phoneRotateX = useTransform(scrollYProgress, [0, 0.5, 1], [0, -8, -20]);
  const phoneScale = useTransform(scrollYProgress, [0, 0.5, 1], [1, 1.05, 0.9]);

  // Auto-swipe demo — swipes automatically every 2.5s
  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsAutoSwiping(true);
    }, 2000); // Start after 2s

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!isAutoSwiping) return;

    const interval = setInterval(() => {
      // Alternate between right (like) and occasionally left (nope)
      const dir = Math.random() > 0.25 ? 1 : -1;

      animate(x, dir * 300, {
        type: 'spring',
        stiffness: 300,
        damping: 25,
        onComplete: () => {
          if (dir > 0) setLiked(p => p + 1);
          x.set(0);
          setCurrentCard(p => (p + 1) % demoJobs.length);
        },
      });
    }, 2800);

    return () => clearInterval(interval);
  }, [isAutoSwiping, x]);

  const handleDragEnd = useCallback((_: any, info: any) => {
    setIsAutoSwiping(false); // Stop auto-swipe on manual interaction
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
      className="relative w-[220px] h-[400px] sm:w-[260px] sm:h-[460px] lg:w-[300px] lg:h-[540px]"
      style={{
        y: phoneY,
        rotateX: phoneRotateX,
        scale: phoneScale,
        transformPerspective: 1200,
        transformStyle: 'preserve-3d',
      }}
      initial={{ opacity: 0, y: 100, rotateY: -15, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, rotateY: 0, scale: 1 }}
      transition={{ duration: 1.4, delay: 0.5, ease }}
    >
      {/* Glow ring */}
      <div className="absolute -inset-5 rounded-[3rem] animate-landing-glow-spin"
        style={{
          background: 'conic-gradient(from 0deg, hsl(200 100% 60% / 0.3), transparent 25%, hsl(190 100% 55% / 0.25), transparent 50%, hsl(210 100% 50% / 0.2), transparent 75%)',
          filter: 'blur(25px)',
        }} />

      {/* Outer halo */}
      <div className="absolute -inset-12 rounded-[4rem] opacity-40"
        style={{ background: 'radial-gradient(ellipse, hsl(200 100% 60% / 0.15) 0%, transparent 70%)', filter: 'blur(40px)' }} />

      {/* Reflection on floor */}
      <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-[80%] h-[60px] opacity-20"
        style={{ background: 'radial-gradient(ellipse, hsl(200 100% 60% / 0.3) 0%, transparent 70%)', filter: 'blur(20px)' }} />

      {/* Phone frame */}
      <div className="absolute inset-0 rounded-[2.5rem] bg-primary border border-white/[0.12] shadow-[0_0_80px_hsl(200_100%_60%/0.2),0_0_160px_hsl(200_100%_50%/0.08),0_30px_80px_rgba(0,0,0,0.6)] overflow-hidden">
        <div className="absolute inset-0 rounded-[2.5rem] border border-white/[0.05]" />

        {/* Status bar */}
        <div className="flex justify-between items-center px-5 pt-3 pb-2">
          <span className="text-[9px] text-white/30 font-medium">9:41</span>
          <div className="w-16 h-5 rounded-full bg-black/80 mx-auto" />
          <div className="w-3 h-1.5 rounded-sm bg-white/20" />
        </div>

        {/* Card area */}
        <div className="relative mx-3 h-[275px] sm:h-[320px] lg:h-[390px]">
          <div className={`absolute inset-1 rounded-2xl bg-gradient-to-br ${nextJob.gradient} opacity-30 scale-[0.92]`} />

          <motion.div
            className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${job.gradient} cursor-grab active:cursor-grabbing overflow-hidden shadow-2xl`}
            style={{ x, rotate }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.9}
            onDragEnd={handleDragEnd}
          >
            {/* Stamps */}
            <motion.div className="absolute top-4 left-4 z-20 border-2 border-[hsl(160_80%_50%)] rounded-lg px-3 py-0.5 -rotate-12"
              style={{ opacity: likeOpacity }}>
              <span className="text-[hsl(160_80%_50%)] text-sm font-black flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> SÖK!
              </span>
            </motion.div>
            <motion.div className="absolute top-4 right-4 z-20 border-2 border-red-400 rounded-lg px-3 py-0.5 rotate-12"
              style={{ opacity: nopeOpacity }}>
              <span className="text-red-400 text-xs font-black">NOPE</span>
            </motion.div>

            {/* Shimmer */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent animate-landing-shimmer" />

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
            <Heart className="w-3.5 h-3.5 text-secondary fill-secondary" />
            <span className="text-white/70 text-xs font-semibold">{liked}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════
   HERO SECTION
   ═══════════════════════════════════════════ */
const LandingHero = () => {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const textY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);

  const goTo = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register' } });
  };

  return (
    <section
      ref={heroRef}
      className="relative min-h-[100dvh] flex flex-col justify-center overflow-hidden pt-16 pb-8 sm:pt-20 sm:pb-12"
    >
      {/* Aurora — scales up on scroll */}
      <motion.div style={{ scale: bgScale }} className="absolute inset-0">
        <AuroraMesh />
      </motion.div>

      <motion.div
        style={{ y: textY, opacity: textOpacity }}
        className="relative z-10 max-w-[1400px] mx-auto px-5 sm:px-6 md:px-12 w-full"
      >
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
          {/* Left — text */}
          <div className="flex-1 space-y-5 sm:space-y-6">
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.15, ease }}>
              <span className="inline-flex items-center gap-3 text-[10px] sm:text-[11px] font-semibold tracking-[0.25em] uppercase text-secondary/70">
                <motion.span className="w-0 h-px bg-gradient-to-r from-secondary to-transparent"
                  animate={{ width: 40 }} transition={{ duration: 0.8, delay: 0.4, ease }} />
                Framtidens rekrytering
              </span>
            </motion.div>

            <div className="space-y-1">
              <div className="overflow-hidden">
                <h1 className="text-[2.8rem] leading-[0.9] sm:text-[4rem] md:text-[5.5rem] lg:text-[7rem] font-black tracking-[-0.04em] uppercase">
                  <WordReveal words={['Rekry']} className="text-white" delay={0.2} />
                  <WordReveal words={['tering.']}
                    className="bg-gradient-to-r from-secondary via-[hsl(190_100%_55%)] to-secondary bg-clip-text text-transparent"
                    delay={0.35} />
                </h1>
              </div>
              <div className="overflow-hidden">
                <motion.p className="text-[1.5rem] leading-[1] sm:text-[2.2rem] md:text-[3rem] font-black tracking-[-0.03em] text-white/15 uppercase flex items-center gap-3"
                  initial={{ y: '110%' }} animate={{ y: 0 }} transition={{ duration: 0.9, ease, delay: 0.5 }}>
                  På 60 sekunder
                  <motion.span className="inline-block w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-secondary flex-shrink-0 shadow-[0_0_12px_hsl(200_100%_60%/0.5)]"
                    initial={{ scale: 0 }} animate={{ scale: [0, 1.4, 1] }} transition={{ duration: 0.5, delay: 1.2, ease }} />
                </motion.p>
              </div>
            </div>

            <motion.p className="text-white/50 text-sm sm:text-base leading-relaxed font-medium max-w-md"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7, ease }}>
              Swipe. Matcha. Anställ.{' '}
              <span className="text-white/30">Rekrytering som känns lika enkelt som att scrolla sociala medier.</span>
            </motion.p>

            <motion.div className="flex flex-col gap-3 pt-1"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.9, ease }}>
              <button onClick={goTo}
                className="group relative flex items-center gap-3 px-7 py-3.5 rounded-full bg-secondary text-primary font-bold text-sm w-fit
                  hover:bg-[hsl(200_100%_65%)] active:scale-[0.97] transition-all duration-300 shadow-[0_0_40px_hsl(200_100%_60%/0.3),0_0_80px_hsl(200_100%_60%/0.1)]">
                <span className="absolute inset-0 rounded-full bg-secondary/40 animate-landing-cta-pulse" />
                <span className="relative z-10 flex items-center gap-3">
                  Kom igång gratis
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
              <span className="text-white/25 text-[10px] sm:text-xs tracking-wide">Inget kreditkort · Gratis under beta</span>
            </motion.div>

            <motion.div className="flex items-center gap-6 sm:gap-8 pt-2"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 0.8 }}>
              {[
                { value: '200+', label: 'I väntelistan' },
                { value: '60s', label: 'Snittmatchning' },
                { value: '95%', label: 'Nöjda användare' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-white font-black text-lg sm:text-xl">{stat.value}</p>
                  <p className="text-white/30 text-[9px] sm:text-[10px] font-medium">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — Phone with 3D perspective */}
          <div className="flex-shrink-0 relative" style={{ perspective: '1200px' }}>
            <PhoneMockup scrollYProgress={scrollYProgress} />
          </div>
        </div>
      </motion.div>

      {/* Bottom line */}
      <motion.div className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, hsl(200 100% 60% / 0.2), transparent)' }}
        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.5, delay: 1, ease }} />

      {/* Scroll indicator */}
      <motion.div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2, duration: 0.8 }}>
        <div className="w-5 h-8 rounded-full border border-white/10 flex justify-center pt-1.5 animate-landing-scroll-border">
          <div className="w-1 h-1.5 rounded-full bg-secondary animate-landing-scroll-dot" />
        </div>
      </motion.div>
    </section>
  );
};

export default LandingHero;
