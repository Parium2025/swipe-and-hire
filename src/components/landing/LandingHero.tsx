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

/* ─── Demo jobs ─── */
const demoJobs = [
  { title: 'Frontend Developer', company: 'TechCorp AB', location: 'Stockholm', type: 'Heltid', color: 'from-[hsl(200_100%_55%)] to-[hsl(220_80%_40%)]' },
  { title: 'UX Designer', company: 'Design Studio', location: 'Göteborg', type: 'Heltid', color: 'from-[hsl(190_90%_45%)] to-[hsl(210_80%_35%)]' },
  { title: 'Product Manager', company: 'StartUp Co', location: 'Malmö', type: 'Heltid', color: 'from-[hsl(210_85%_50%)] to-[hsl(230_70%_35%)]' },
];

/* ─── Realistic iPhone mockup ─── */
const PhoneMockup = ({ scrollYProgress }: { scrollYProgress: any }) => {
  const [currentCard, setCurrentCard] = useState(0);
  const [liked, setLiked] = useState(0);
  const [isAutoSwiping, setIsAutoSwiping] = useState(false);
  const x = useMotionValue(0);
  const cardRotate = useTransform(x, [-200, 0, 200], [-15, 0, 15]);
  const likeOpacity = useTransform(x, [0, 80], [0, 1]);
  const nopeOpacity = useTransform(x, [-80, 0], [1, 0]);

  const phoneY = useTransform(scrollYProgress, [0, 0.8], [0, -60]);
  const phoneRotateX = useTransform(scrollYProgress, [0, 0.6, 1], [2, -4, -12]);
  const phoneScale = useTransform(scrollYProgress, [0, 0.5, 1], [1, 1.02, 0.9]);

  useEffect(() => {
    const t = setTimeout(() => setIsAutoSwiping(true), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isAutoSwiping) return;
    const interval = setInterval(() => {
      const dir = Math.random() > 0.2 ? 1 : -1;
      animate(x, dir * 260, {
        type: 'spring', stiffness: 250, damping: 20,
        onComplete: () => {
          if (dir > 0) setLiked(p => p + 1);
          x.set(0);
          setCurrentCard(p => (p + 1) % demoJobs.length);
        },
      });
    }, 3200);
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
      className="relative"
      style={{ y: phoneY, rotateX: phoneRotateX, scale: phoneScale, transformPerspective: 1200, transformStyle: 'preserve-3d' }}
      initial={{ opacity: 0, y: 80, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 1.4, delay: 0.6, ease }}
    >
      {/* Ambient glow behind phone */}
      <div className="absolute -inset-8 sm:-inset-12 rounded-[4rem]"
        style={{ background: 'radial-gradient(ellipse, hsl(200 100% 60% / 0.2) 0%, hsl(210 100% 50% / 0.08) 40%, transparent 70%)', filter: 'blur(40px)' }} />

      {/* === iPhone frame === */}
      <div className="relative w-[200px] h-[410px] sm:w-[250px] sm:h-[510px] lg:w-[290px] lg:h-[590px]">
        {/* Outer shell — titanium/steel look */}
        <div className="absolute inset-0 rounded-[2.2rem] sm:rounded-[2.8rem] bg-[hsl(220_15%_12%)] shadow-[0_25px_80px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.06)]" />

        {/* Inner screen bezel */}
        <div className="absolute inset-[3px] sm:inset-[4px] rounded-[2rem] sm:rounded-[2.5rem] bg-black overflow-hidden">
          {/* Dynamic Island */}
          <div className="absolute top-[8px] sm:top-[10px] left-1/2 -translate-x-1/2 w-[70px] sm:w-[90px] h-[22px] sm:h-[28px] bg-black rounded-full z-30 shadow-[0_0_0_2px_rgba(0,0,0,0.8)]">
            {/* Camera dot */}
            <div className="absolute right-[12px] sm:right-[16px] top-1/2 -translate-y-1/2 w-[6px] h-[6px] sm:w-[8px] sm:h-[8px] rounded-full bg-[hsl(220_20%_8%)] border border-[hsl(220_10%_18%)]">
              <div className="absolute inset-[2px] rounded-full bg-[hsl(240_30%_15%)]" />
            </div>
          </div>

          {/* Screen content */}
          <div className="absolute inset-0 bg-gradient-to-b from-[hsl(215_60%_8%)] to-[hsl(215_70%_6%)]">
            {/* Status bar */}
            <div className="flex justify-between items-center px-5 sm:px-6 pt-[14px] sm:pt-[16px]">
              <span className="text-[8px] sm:text-[9px] text-white/50 font-semibold">9:41</span>
              <div className="w-[44px] h-[14px]" /> {/* Dynamic island spacer */}
              <div className="flex items-center gap-0.5">
                <div className="flex gap-[1px]">
                  {[4, 6, 8, 10].map(h => <div key={h} className="w-[2px] rounded-sm bg-white/40" style={{ height: h }} />)}
                </div>
                <div className="ml-1 w-[16px] h-[8px] rounded-[2px] border border-white/30 relative">
                  <div className="absolute inset-[1px] rounded-[1px] bg-white/40 w-[60%]" />
                </div>
              </div>
            </div>

            {/* App header */}
            <div className="px-4 sm:px-5 pt-3 sm:pt-4 pb-2">
              <p className="text-[9px] sm:text-[10px] text-white/30 font-semibold tracking-[0.15em] uppercase">Parium</p>
              <p className="text-[11px] sm:text-[13px] text-white font-bold mt-0.5">Utforska jobb</p>
            </div>

            {/* Card stack */}
            <div className="relative mx-3 sm:mx-4 h-[250px] sm:h-[310px] lg:h-[380px]">
              {/* Background card */}
              <div className={`absolute inset-2 rounded-xl sm:rounded-2xl bg-gradient-to-br ${nextJob.color} opacity-30 scale-[0.94]`} />

              {/* Active card */}
              <motion.div
                className={`absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-br ${job.color} cursor-grab active:cursor-grabbing overflow-hidden`}
                style={{ x, rotate: cardRotate }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.9}
                onDragEnd={handleDragEnd}
              >
                {/* Like/Nope stamps */}
                <motion.div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 border-2 border-[hsl(160_80%_55%)] rounded-md px-2 py-0.5 -rotate-12"
                  style={{ opacity: likeOpacity }}>
                  <span className="text-[hsl(160_80%_55%)] text-[10px] sm:text-xs font-black flex items-center gap-1">
                    <Check className="w-3 h-3" /> LIKE
                  </span>
                </motion.div>
                <motion.div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 border-2 border-red-400 rounded-md px-2 py-0.5 rotate-12"
                  style={{ opacity: nopeOpacity }}>
                  <span className="text-red-400 text-[10px] sm:text-xs font-black">NOPE</span>
                </motion.div>

                {/* Card gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Card content */}
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <span className="text-[7px] sm:text-[8px] font-bold text-white">{job.company[0]}</span>
                    </div>
                    <p className="text-white/70 text-[9px] sm:text-[10px] font-medium">{job.company}</p>
                  </div>
                  <h3 className="text-white text-base sm:text-lg font-bold leading-tight">{job.title}</h3>
                  <div className="flex gap-2 mt-2">
                    <span className="flex items-center gap-1 text-white/60 text-[8px] sm:text-[9px] bg-white/10 rounded-full px-2 py-0.5">
                      <MapPin className="w-2.5 h-2.5" />{job.location}
                    </span>
                    <span className="flex items-center gap-1 text-white/60 text-[8px] sm:text-[9px] bg-white/10 rounded-full px-2 py-0.5">
                      <Clock className="w-2.5 h-2.5" />{job.type}
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Bottom action bar */}
            <div className="flex items-center justify-center gap-3 sm:gap-4 mt-2 sm:mt-3 px-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                <span className="text-red-400 text-xs sm:text-sm">✕</span>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-secondary/20 border border-secondary/30 flex items-center justify-center">
                <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                <span className="text-white/40 text-xs sm:text-sm">⟳</span>
              </div>
            </div>

            {/* Liked counter */}
            <div className="flex justify-center mt-2">
              <div className="flex items-center gap-1 px-3 py-1 bg-white/[0.04] rounded-full">
                <Heart className="w-2.5 h-2.5 text-secondary fill-secondary" />
                <span className="text-white/50 text-[9px] font-semibold">{liked} matchningar</span>
              </div>
            </div>
          </div>

          {/* Home indicator */}
          <div className="absolute bottom-[4px] sm:bottom-[6px] left-1/2 -translate-x-1/2 w-[80px] sm:w-[100px] h-[3px] sm:h-[4px] rounded-full bg-white/20" />
        </div>

        {/* Side buttons */}
        <div className="absolute -right-[1px] top-[30%] w-[2px] h-[35px] sm:h-[45px] rounded-l-sm bg-[hsl(220_15%_18%)]" />
        <div className="absolute -left-[1px] top-[25%] w-[2px] h-[20px] sm:h-[25px] rounded-r-sm bg-[hsl(220_15%_18%)]" />
        <div className="absolute -left-[1px] top-[35%] w-[2px] h-[35px] sm:h-[45px] rounded-r-sm bg-[hsl(220_15%_18%)]" />
        <div className="absolute -left-[1px] top-[45%] w-[2px] h-[35px] sm:h-[45px] rounded-r-sm bg-[hsl(220_15%_18%)]" />

        {/* Screen glass reflection */}
        <div className="absolute inset-[3px] sm:inset-[4px] rounded-[2rem] sm:rounded-[2.5rem] pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent" />
          <div className="absolute top-0 left-[10%] w-[30%] h-[50%] bg-gradient-to-b from-white/[0.02] to-transparent rounded-full blur-xl" />
        </div>
      </div>

      {/* Floor reflection */}
      <div className="absolute -bottom-12 sm:-bottom-16 left-1/2 -translate-x-1/2 w-[80%] h-[50px] sm:h-[70px]"
        style={{ background: 'radial-gradient(ellipse, hsl(200 100% 60% / 0.12) 0%, transparent 70%)', filter: 'blur(20px)' }} />
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
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);

  const goTo = () => {
    sessionStorage.setItem('parium-skip-splash', '1');
    navigate('/auth', { state: { mode: 'register' } });
  };

  return (
    <section
      ref={heroRef}
      className="relative min-h-[100dvh] flex flex-col justify-center overflow-hidden"
    >
      {/* Background — Parium navy gradient */}
      <motion.div style={{ scale: bgScale }} className="absolute inset-0">
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse 120% 100% at 50% 0%, hsl(215 80% 18%) 0%, hsl(215 90% 10%) 50%, hsl(220 100% 6%) 100%)'
        }} />
        {/* Cyan glow orbs */}
        <div className="absolute w-[500px] h-[500px] rounded-full animate-landing-aurora opacity-60"
          style={{ background: 'radial-gradient(circle, hsl(200 100% 60% / 0.12) 0%, transparent 60%)', top: '-10%', left: '-10%', filter: 'blur(60px)', willChange: 'transform' }} />
        <div className="absolute w-[400px] h-[400px] rounded-full animate-landing-aurora-2 opacity-40"
          style={{ background: 'radial-gradient(circle, hsl(200 100% 55% / 0.1) 0%, transparent 60%)', bottom: '0%', right: '-5%', filter: 'blur(50px)', willChange: 'transform' }} />
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.02]"
          style={{ backgroundImage: 'linear-gradient(hsl(200 100% 60% / 0.4) 1px, transparent 1px), linear-gradient(90deg, hsl(200 100% 60% / 0.4) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
      </motion.div>

      <motion.div
        style={{ y: textY, opacity: textOpacity }}
        className="relative z-10 max-w-[1400px] mx-auto px-5 sm:px-6 md:px-12 w-full pt-20 sm:pt-24"
      >
        {/* Mobile: phone first, then text. Desktop: side by side */}
        <div className="flex flex-col items-center lg:flex-row lg:items-center gap-8 lg:gap-16">
          {/* Phone — shown first on mobile for impact */}
          <div className="flex-shrink-0 relative order-1 lg:order-2 mt-2 lg:mt-0" style={{ perspective: '1200px' }}>
            <PhoneMockup scrollYProgress={scrollYProgress} />
          </div>

          {/* Text */}
          <div className="flex-1 space-y-5 order-2 lg:order-1 text-center lg:text-left">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.1, ease }}>
              <span className="inline-flex items-center gap-3 text-[10px] sm:text-[11px] font-semibold tracking-[0.3em] uppercase text-secondary/70">
                <motion.span className="hidden lg:block w-0 h-px bg-gradient-to-r from-secondary to-transparent"
                  animate={{ width: 48 }} transition={{ duration: 1, delay: 0.5, ease }} />
                Framtidens rekrytering
              </span>
            </motion.div>

            <motion.div className="overflow-hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.2 }}>
              <motion.h1
                className="text-[2.6rem] leading-[0.9] sm:text-[3.5rem] md:text-[4.5rem] lg:text-[6rem] font-black tracking-[-0.04em] uppercase"
                initial={{ y: '100%' }} animate={{ y: 0 }}
                transition={{ duration: 1.1, delay: 0.25, ease }}
              >
                <span className="text-white block">Rekry</span>
                <span className="bg-gradient-to-r from-secondary via-[hsl(190_100%_55%)] to-secondary bg-clip-text text-transparent block">tering.</span>
                <span className="text-white/20 block text-[0.55em]">På 60 sekunder.</span>
              </motion.h1>
            </motion.div>

            <motion.p className="text-white/50 text-sm sm:text-base leading-relaxed font-medium max-w-md mx-auto lg:mx-0"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.8, ease }}>
              Swipe. Matcha. Anställ.{' '}
              <span className="text-white/30">Rekrytering som känns lika enkelt som att scrolla sociala medier.</span>
            </motion.p>

            <motion.div className="flex flex-col items-center lg:items-start gap-3 pt-1"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 1, ease }}>
              <button onClick={goTo}
                className="group relative flex items-center gap-3 px-7 py-3.5 rounded-full bg-secondary text-primary font-bold text-sm
                  hover:bg-[hsl(200_100%_65%)] active:scale-[0.97] transition-all duration-300
                  shadow-[0_0_40px_hsl(200_100%_60%/0.3),0_0_80px_hsl(200_100%_60%/0.1)]">
                <span className="absolute inset-0 rounded-full bg-secondary/30 animate-landing-cta-pulse" />
                <span className="relative z-10 flex items-center gap-3">
                  Kom igång gratis
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
              <span className="text-white/20 text-[10px] sm:text-xs tracking-wider">Inget kreditkort · Gratis under beta</span>
            </motion.div>

            <motion.div className="flex items-center justify-center lg:justify-start gap-8 pt-3"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3, duration: 1 }}>
              {[
                { value: '200+', label: 'I väntelistan' },
                { value: '60s', label: 'Matchningstid' },
                { value: '95%', label: 'Nöjda' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-white font-black text-lg sm:text-xl tracking-tight">{stat.value}</p>
                  <p className="text-white/25 text-[9px] sm:text-[10px] font-medium tracking-wider uppercase">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Bottom gradient line */}
      <motion.div className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, hsl(200 100% 60% / 0.2), transparent)' }}
        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 2, delay: 1.2, ease }} />

      {/* Scroll indicator */}
      <motion.div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5, duration: 1 }}>
        <div className="w-5 h-8 rounded-full border border-white/[0.1] flex justify-center pt-1.5 animate-landing-scroll-border">
          <div className="w-1 h-1.5 rounded-full bg-secondary/60 animate-landing-scroll-dot" />
        </div>
      </motion.div>
    </section>
  );
};

export default LandingHero;
