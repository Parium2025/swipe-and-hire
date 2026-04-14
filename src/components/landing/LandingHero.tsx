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

/* ─── Aurora background ─── */
const AuroraMesh = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    {/* Primary cyan blob */}
    <div
      className="absolute w-[60vw] h-[60vw] max-w-[900px] max-h-[900px] rounded-full animate-landing-aurora"
      style={{
        background: 'radial-gradient(circle, hsl(200 100% 60% / 0.18) 0%, hsl(200 100% 50% / 0.05) 50%, transparent 70%)',
        top: '-25%', left: '-20%', filter: 'blur(80px)', willChange: 'transform',
      }}
    />
    {/* Secondary blue blob */}
    <div
      className="absolute w-[50vw] h-[50vw] max-w-[700px] max-h-[700px] rounded-full animate-landing-aurora-2"
      style={{
        background: 'radial-gradient(circle, hsl(210 100% 50% / 0.14) 0%, transparent 60%)',
        bottom: '-15%', right: '-15%', filter: 'blur(100px)', willChange: 'transform',
      }}
    />
    {/* Teal accent blob */}
    <div
      className="absolute w-[30vw] h-[30vw] max-w-[500px] max-h-[500px] rounded-full animate-landing-aurora-3"
      style={{
        background: 'radial-gradient(circle, hsl(190 100% 55% / 0.12) 0%, transparent 60%)',
        top: '40%', left: '50%', transform: 'translateX(-50%)', filter: 'blur(60px)', willChange: 'transform',
      }}
    />
    {/* Grid overlay */}
    <div className="absolute inset-0 opacity-[0.015]"
      style={{ backgroundImage: 'linear-gradient(hsl(200 100% 60% / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(200 100% 60% / 0.5) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
    {/* Diagonal streak */}
    <div className="absolute w-[2px] h-[40vh] animate-landing-streak opacity-[0.06]"
      style={{ background: 'linear-gradient(to bottom, transparent, hsl(200 100% 70%), transparent)', top: 0, left: '25%', filter: 'blur(1px)' }} />
    <div className="absolute w-[1px] h-[30vh] animate-landing-streak opacity-[0.04]"
      style={{ background: 'linear-gradient(to bottom, transparent, hsl(190 100% 60%), transparent)', top: '15%', left: '65%', filter: 'blur(1px)', animationDelay: '3s' }} />
    {/* Scanline */}
    <div className="absolute w-full h-[1px] animate-landing-scanline opacity-[0.05]"
      style={{ background: 'linear-gradient(90deg, transparent 10%, hsl(200 100% 60% / 0.3) 50%, transparent 90%)', top: 0 }} />
  </div>
);

/* ─── Demo jobs ─── */
const demoJobs = [
  { title: 'Frontend Developer', company: 'TechCorp AB', location: 'Stockholm', type: 'Heltid', gradient: 'from-secondary to-primary' },
  { title: 'UX Designer', company: 'Design Studio', location: 'Göteborg', type: 'Heltid', gradient: 'from-[hsl(190_90%_45%)] to-primary' },
  { title: 'Product Manager', company: 'StartUp Co', location: 'Malmö', type: 'Heltid', gradient: 'from-[hsl(210_80%_50%)] to-primary' },
];

/* ─── Phone with auto-swipe + scroll-driven 3D ─── */
const PhoneMockup = ({ scrollYProgress }: { scrollYProgress: any }) => {
  const [currentCard, setCurrentCard] = useState(0);
  const [liked, setLiked] = useState(0);
  const [isAutoSwiping, setIsAutoSwiping] = useState(false);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-12, 0, 12]);
  const likeOpacity = useTransform(x, [0, 80], [0, 1]);
  const nopeOpacity = useTransform(x, [-80, 0], [1, 0]);

  const phoneY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const phoneRotateX = useTransform(scrollYProgress, [0, 0.5, 1], [0, -6, -15]);
  const phoneScale = useTransform(scrollYProgress, [0, 0.5, 1], [1, 1.03, 0.92]);

  useEffect(() => {
    const t = setTimeout(() => setIsAutoSwiping(true), 2200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isAutoSwiping) return;
    const interval = setInterval(() => {
      const dir = Math.random() > 0.2 ? 1 : -1;
      animate(x, dir * 280, {
        type: 'spring', stiffness: 280, damping: 22,
        onComplete: () => {
          if (dir > 0) setLiked(p => p + 1);
          x.set(0);
          setCurrentCard(p => (p + 1) % demoJobs.length);
        },
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [isAutoSwiping, x]);

  const handleDragEnd = useCallback((_: any, info: any) => {
    setIsAutoSwiping(false);
    if (Math.abs(info.offset.x) > 80) {
      const dir = info.offset.x > 0 ? 1 : -1;
      animate(x, dir * 400, { type: 'spring', stiffness: 500, damping: 30 });
      if (dir > 0) setLiked(p => p + 1);
      setTimeout(() => { x.set(0); setCurrentCard(p => (p + 1) % demoJobs.length); }, 300);
    } else {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 25 });
    }
  }, [x]);

  const job = demoJobs[currentCard];
  const nextJob = demoJobs[(currentCard + 1) % demoJobs.length];

  return (
    <motion.div
      className="relative w-[240px] h-[440px] sm:w-[280px] sm:h-[500px] lg:w-[320px] lg:h-[580px]"
      style={{ y: phoneY, rotateX: phoneRotateX, scale: phoneScale, transformPerspective: 1200, transformStyle: 'preserve-3d' }}
      initial={{ opacity: 0, y: 120, rotateY: -10, scale: 0.75 }}
      animate={{ opacity: 1, y: 0, rotateY: 0, scale: 1 }}
      transition={{ duration: 1.6, delay: 0.8, ease }}
    >
      {/* Glow */}
      <div className="absolute -inset-6 rounded-[3.5rem] animate-landing-glow-spin"
        style={{ background: 'conic-gradient(from 0deg, hsl(200 100% 60% / 0.25), transparent 30%, hsl(190 100% 55% / 0.2), transparent 60%, hsl(210 100% 50% / 0.15), transparent 90%)', filter: 'blur(30px)' }} />
      {/* Floor reflection */}
      <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-[70%] h-[80px] opacity-15"
        style={{ background: 'radial-gradient(ellipse, hsl(200 100% 60% / 0.4) 0%, transparent 70%)', filter: 'blur(25px)' }} />

      {/* Phone body */}
      <div className="absolute inset-0 rounded-[2.8rem] bg-primary border border-white/[0.1] shadow-[0_0_60px_hsl(200_100%_60%/0.15),0_30px_100px_rgba(0,0,0,0.7)] overflow-hidden">
        <div className="absolute inset-0 rounded-[2.8rem] border border-white/[0.04]" />

        {/* Status bar */}
        <div className="flex justify-between items-center px-6 pt-3.5 pb-2">
          <span className="text-[9px] text-white/25 font-medium tracking-wide">9:41</span>
          <div className="w-20 h-6 rounded-full bg-black/80 mx-auto" />
          <div className="w-4 h-2 rounded-sm bg-white/15" />
        </div>

        {/* Cards */}
        <div className="relative mx-3.5 h-[300px] sm:h-[340px] lg:h-[420px]">
          <div className={`absolute inset-1 rounded-2xl bg-gradient-to-br ${nextJob.gradient} opacity-25 scale-[0.93]`} />
          <motion.div
            className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${job.gradient} cursor-grab active:cursor-grabbing overflow-hidden shadow-2xl`}
            style={{ x, rotate }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.9}
            onDragEnd={handleDragEnd}
          >
            {/* Stamps */}
            <motion.div className="absolute top-5 left-5 z-20 border-2 border-[hsl(160_80%_50%)] rounded-lg px-3 py-0.5 -rotate-12"
              style={{ opacity: likeOpacity }}>
              <span className="text-[hsl(160_80%_50%)] text-sm font-black flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> SÖK!
              </span>
            </motion.div>
            <motion.div className="absolute top-5 right-5 z-20 border-2 border-red-400 rounded-lg px-3 py-0.5 rotate-12"
              style={{ opacity: nopeOpacity }}>
              <span className="text-red-400 text-xs font-black">NOPE</span>
            </motion.div>

            {/* Shimmer */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent animate-landing-shimmer" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

            <div className="absolute bottom-0 left-0 right-0 p-5">
              <p className="text-white/60 text-[11px] font-medium tracking-wide">{job.company}</p>
              <h3 className="text-white text-xl font-bold leading-tight mt-1">{job.title}</h3>
              <div className="flex gap-3 mt-2.5">
                <span className="flex items-center gap-1 text-white/50 text-[10px]"><MapPin className="w-3 h-3" />{job.location}</span>
                <span className="flex items-center gap-1 text-white/50 text-[10px]"><Clock className="w-3 h-3" />{job.type}</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom */}
        <div className="flex items-center justify-center gap-2 mt-3 px-4">
          <div className="flex items-center gap-1.5 px-4 py-1.5 bg-white/[0.05] rounded-full border border-white/[0.06]">
            <Heart className="w-3.5 h-3.5 text-secondary fill-secondary" />
            <span className="text-white/60 text-xs font-semibold">{liked}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════
   HERO
   ═══════════════════════════════════════════ */
const LandingHero = () => {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const textY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.2]);

  const goTo = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register' } });
  };

  return (
    <section
      ref={heroRef}
      className="relative min-h-[100dvh] flex flex-col justify-center overflow-hidden"
    >
      <motion.div style={{ scale: bgScale }} className="absolute inset-0">
        <AuroraMesh />
      </motion.div>

      <motion.div
        style={{ y: textY, opacity: textOpacity }}
        className="relative z-10 max-w-[1400px] mx-auto px-5 sm:px-6 md:px-12 w-full pt-20 sm:pt-24"
      >
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-20">
          {/* Text */}
          <div className="flex-1 space-y-6">
            <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, delay: 0.1, ease }}>
              <span className="inline-flex items-center gap-3 text-[10px] sm:text-[11px] font-semibold tracking-[0.3em] uppercase text-secondary/60">
                <motion.span className="w-0 h-px bg-gradient-to-r from-secondary to-transparent"
                  animate={{ width: 48 }} transition={{ duration: 1, delay: 0.5, ease }} />
                Framtidens rekrytering
              </span>
            </motion.div>

            <div className="overflow-hidden">
              <motion.h1
                className="text-[3rem] leading-[0.88] sm:text-[4.5rem] md:text-[6rem] lg:text-[7.5rem] font-black tracking-[-0.05em] uppercase"
                initial={{ y: '120%' }} animate={{ y: 0 }}
                transition={{ duration: 1.2, delay: 0.2, ease }}
              >
                <span className="text-white block">Swipe.</span>
                <span className="bg-gradient-to-r from-secondary via-[hsl(190_100%_55%)] to-secondary bg-clip-text text-transparent block">Matcha.</span>
                <span className="text-white/12 block">Anställ.</span>
              </motion.h1>
            </div>

            <motion.p className="text-white/40 text-sm sm:text-base leading-relaxed font-medium max-w-lg"
              initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.8, ease }}>
              Rekrytering som känns lika enkelt som att scrolla sociala medier.{' '}
              <span className="text-white/20">60 sekunder. Det är allt.</span>
            </motion.p>

            <motion.div className="flex flex-col gap-3 pt-2"
              initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 1, ease }}>
              <button onClick={goTo}
                className="group relative flex items-center gap-3 px-8 py-4 rounded-full bg-secondary text-primary font-bold text-sm w-fit
                  hover:bg-[hsl(200_100%_65%)] active:scale-[0.97] transition-all duration-300
                  shadow-[0_0_50px_hsl(200_100%_60%/0.25),0_0_100px_hsl(200_100%_60%/0.08)]">
                <span className="absolute inset-0 rounded-full bg-secondary/30 animate-landing-cta-pulse" />
                <span className="relative z-10 flex items-center gap-3">
                  Kom igång gratis
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                </span>
              </button>
              <span className="text-white/20 text-[10px] sm:text-xs tracking-wider">Inget kreditkort · Gratis under beta</span>
            </motion.div>

            <motion.div className="flex items-center gap-8 pt-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4, duration: 1 }}>
              {[
                { value: '200+', label: 'I väntelistan' },
                { value: '60s', label: 'Matchningstid' },
                { value: '95%', label: 'Nöjda' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-white font-black text-xl sm:text-2xl tracking-tight">{stat.value}</p>
                  <p className="text-white/25 text-[9px] sm:text-[10px] font-medium tracking-wider uppercase">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Phone */}
          <div className="flex-shrink-0 relative" style={{ perspective: '1200px' }}>
            <PhoneMockup scrollYProgress={scrollYProgress} />
          </div>
        </div>
      </motion.div>

      {/* Bottom gradient line */}
      <motion.div className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, hsl(200 100% 60% / 0.15), transparent)' }}
        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 2, delay: 1.2, ease }} />

      {/* Scroll indicator */}
      <motion.div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5, duration: 1 }}>
        <div className="w-5 h-8 rounded-full border border-white/[0.08] flex justify-center pt-1.5 animate-landing-scroll-border">
          <div className="w-1 h-1.5 rounded-full bg-secondary/60 animate-landing-scroll-dot" />
        </div>
      </motion.div>
    </section>
  );
};

export default LandingHero;
